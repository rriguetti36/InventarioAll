const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const CompanyModel = require('../models/CompanyModel');
const UserModel = require('../models/UserModel');
const { getMasterPool, getPool } = require('../config/db');
const { runWithDatabase } = require('../config/tenantContext');

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function assertDatabaseName(databaseName) {
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error('Nombre de base de datos invalido');
  }
  return `[${databaseName.replace(/]/g, ']]')}]`;
}

function stripUseStatements(script) {
  return script.replace(/^\s*USE\s+\[?[A-Za-z0-9_]+\]?;\s*$/gim, '');
}

function splitBatches(script) {
  return stripUseStatements(script)
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

async function executeBatches(databaseName, script) {
  const pool = await getPool(databaseName);
  for (const batch of splitBatches(script)) {
    await pool.request().batch(batch);
  }
}

class CompanyService {
  static async ensureMasterSchema() {
    await CompanyModel.ensureSchema();
  }

  static async syncCompanyUserIndex() {
    await CompanyModel.ensureSchema();
    const companies = await CompanyModel.getAll();
    for (const company of companies) {
      try {
        const pool = await getPool(company.databaseName);
        const result = await pool.request().query('SELECT email FROM dbo.Users WHERE estado = 1');
        for (const user of result.recordset) {
          await CompanyModel.linkUser(company.id, user.email);
        }
      } catch (err) {
        console.warn(`No se pudo sincronizar usuarios de ${company.slug}:`, err.message);
      }
    }
  }

  static async getAllCompanies() {
    await CompanyModel.ensureSchema();
    return CompanyModel.getAll();
  }

  static async getCompanyBySlug(slug) {
    if (!slug) return null;
    await CompanyModel.ensureSchema();
    return CompanyModel.getBySlug(slugify(slug));
  }

  static async getCompaniesByUserEmail(email) {
    if (!email) return [];
    await CompanyModel.ensureSchema();
    return CompanyModel.getByUserEmail(email);
  }

  static async linkUserToCompany(companyId, email) {
    if (!companyId || !email) return;
    await CompanyModel.ensureSchema();
    await CompanyModel.linkUser(companyId, email);
  }

  static async unlinkUserFromCompany(companyId, email) {
    if (!companyId || !email) return;
    await CompanyModel.ensureSchema();
    await CompanyModel.unlinkUser(companyId, email);
  }

  static async validateCompanyAccess(slug) {
    const company = await this.getCompanyBySlug(slug);
    if (!company || !company.estado) {
      const error = new Error('Empresa no encontrada o sin acceso');
      error.status = 403;
      throw error;
    }

    if (['suspendida', 'vencida'].includes(company.licenseStatus)) {
      const error = new Error('Licencia de empresa suspendida o vencida');
      error.status = 403;
      throw error;
    }

    if (company.licenseExpiresAt && new Date(company.licenseExpiresAt) < new Date()) {
      const error = new Error('Licencia de empresa vencida');
      error.status = 403;
      throw error;
    }

    return company;
  }

  static async updateCompany(id, data) {
    await CompanyModel.ensureSchema();
    const existing = await CompanyModel.getById(id);
    if (!existing) {
      const error = new Error('Empresa no encontrada');
      error.status = 404;
      throw error;
    }

    const licenseStatus = data.licenseStatus || existing.licenseStatus || 'trial';
    const paymentStatus = data.paymentStatus || existing.paymentStatus || 'pendiente';
    const validLicenses = ['trial', 'activa', 'suspendida', 'vencida'];
    const validPayments = ['pendiente', 'al_dia', 'vencido', 'exonerado'];

    if (!validLicenses.includes(licenseStatus)) {
      const error = new Error('Estado de licencia invalido');
      error.status = 400;
      throw error;
    }

    if (!validPayments.includes(paymentStatus)) {
      const error = new Error('Estado de pago invalido');
      error.status = 400;
      throw error;
    }

    return CompanyModel.update(id, {
      name: data.name || existing.name,
      planName: data.planName ?? existing.planName,
      licenseStatus,
      licenseExpiresAt: data.licenseExpiresAt ?? existing.licenseExpiresAt,
      paymentStatus,
      notes: data.notes ?? existing.notes,
      estado: data.estado ?? existing.estado,
    });
  }

  static async registerCompany(data) {
    const name = String(data.companyName || data.name || '').trim();
    const adminName = String(data.adminName || '').trim();
    const adminEmail = String(data.adminEmail || data.email || '').trim().toLowerCase();
    const adminPassword = data.adminPassword || data.password;
    const slug = slugify(data.slug || name);

    if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
      const error = new Error('Empresa, slug, adminName, adminEmail y adminPassword son obligatorios');
      error.status = 400;
      throw error;
    }

    await CompanyModel.ensureSchema();
    const existing = await CompanyModel.getBySlug(slug);
    if (existing) {
      const error = new Error('Ya existe una empresa con ese codigo');
      error.status = 409;
      throw error;
    }

    const databasePrefix = process.env.DB_TENANT_PREFIX || 'INV_';
    const databaseName = `${databasePrefix}${slug.replace(/-/g, '_')}`.slice(0, 128);
    const quotedDatabase = assertDatabaseName(databaseName);
    const masterPool = await getMasterPool();

    await masterPool.request().query(`
      IF DB_ID(N'${databaseName.replace(/'/g, "''")}') IS NULL
      BEGIN
        CREATE DATABASE ${quotedDatabase};
      END
    `);

    await executeBatches(databaseName, `
      IF OBJECT_ID('dbo.Users', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.Users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(100) NOT NULL,
          email NVARCHAR(150) NOT NULL UNIQUE,
          password NVARCHAR(255) NOT NULL,
          role NVARCHAR(30) NOT NULL DEFAULT 'user',
          assignedLocationId INT NULL,
          estado BIT NOT NULL DEFAULT 1,
          createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      END
    `);

    const inventorySchema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schemaInv.sql'), 'utf8');
    await executeBatches(databaseName, inventorySchema);

    const company = await CompanyModel.create({ name, slug, databaseName });
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await runWithDatabase(databaseName, async () => {
      await UserModel.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        estado: 1,
        assignedLocationId: null,
      });
    });
    await CompanyModel.linkUser(company.id, adminEmail);

    return company;
  }
}

module.exports = CompanyService;
