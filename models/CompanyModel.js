const { getMasterPool, sql } = require('../config/db');

class CompanyModel {
  static async ensureSchema() {
    const pool = await getMasterPool();
    await pool.request().query(`
      IF OBJECT_ID('dbo.Companies', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.Companies (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(150) NOT NULL,
          slug NVARCHAR(80) NOT NULL UNIQUE,
          databaseName NVARCHAR(128) NOT NULL UNIQUE,
          planName NVARCHAR(80) NULL,
          licenseStatus NVARCHAR(30) NOT NULL DEFAULT 'trial',
          licenseExpiresAt DATETIME2 NULL,
          paymentStatus NVARCHAR(30) NOT NULL DEFAULT 'pendiente',
          notes NVARCHAR(500) NULL,
          estado BIT NOT NULL DEFAULT 1,
          createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      END

      IF COL_LENGTH('dbo.Companies', 'planName') IS NULL
        ALTER TABLE dbo.Companies ADD planName NVARCHAR(80) NULL;
      IF COL_LENGTH('dbo.Companies', 'licenseStatus') IS NULL
        ALTER TABLE dbo.Companies ADD licenseStatus NVARCHAR(30) NOT NULL CONSTRAINT DF_Companies_LicenseStatus DEFAULT 'trial';
      IF COL_LENGTH('dbo.Companies', 'licenseExpiresAt') IS NULL
        ALTER TABLE dbo.Companies ADD licenseExpiresAt DATETIME2 NULL;
      IF COL_LENGTH('dbo.Companies', 'paymentStatus') IS NULL
        ALTER TABLE dbo.Companies ADD paymentStatus NVARCHAR(30) NOT NULL CONSTRAINT DF_Companies_PaymentStatus DEFAULT 'pendiente';
      IF COL_LENGTH('dbo.Companies', 'notes') IS NULL
        ALTER TABLE dbo.Companies ADD notes NVARCHAR(500) NULL;

      IF OBJECT_ID('dbo.CompanyUsers', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.CompanyUsers (
          id INT IDENTITY(1,1) PRIMARY KEY,
          companyId INT NOT NULL,
          email NVARCHAR(150) NOT NULL,
          estado BIT NOT NULL DEFAULT 1,
          createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_CompanyUsers_Companies FOREIGN KEY (companyId) REFERENCES dbo.Companies(id),
          CONSTRAINT UQ_CompanyUsers_Company_Email UNIQUE (companyId, email)
        );
      END

      IF OBJECT_ID('dbo.CompanyModules', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.CompanyModules (
          id INT IDENTITY(1,1) PRIMARY KEY,
          companyId INT NOT NULL,
          moduleCode NVARCHAR(40) NOT NULL,
          enabled BIT NOT NULL DEFAULT 1,
          planCode NVARCHAR(80) NULL,
          startsAt DATETIME2 NULL,
          expiresAt DATETIME2 NULL,
          createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_CompanyModules_Companies FOREIGN KEY (companyId) REFERENCES dbo.Companies(id),
          CONSTRAINT CK_CompanyModules_Code CHECK (moduleCode IN ('inventory', 'pos')),
          CONSTRAINT UQ_CompanyModules_Company_Module UNIQUE (companyId, moduleCode)
        );
      END

      INSERT INTO dbo.CompanyModules (companyId, moduleCode, enabled)
      SELECT c.id, m.moduleCode, 1
      FROM dbo.Companies c
      CROSS JOIN (VALUES ('inventory'), ('pos')) AS m(moduleCode)
      WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.CompanyModules cm
        WHERE cm.companyId = c.id AND cm.moduleCode = m.moduleCode
      );
    `);
  }

  static async getAll() {
    const pool = await getMasterPool();
    const result = await pool.request().query(`
      SELECT *
      FROM dbo.Companies
      ORDER BY createdAt DESC
    `);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await getMasterPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.Companies WHERE id = @id');
    return result.recordset[0];
  }

  static async getBySlug(slug) {
    const pool = await getMasterPool();
    const result = await pool.request()
      .input('slug', sql.NVarChar(80), slug)
      .query('SELECT * FROM dbo.Companies WHERE slug = @slug');
    return result.recordset[0];
  }

  static async getByUserEmail(email) {
    const pool = await getMasterPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(150), String(email || '').trim().toLowerCase())
      .query(`
        SELECT c.*
        FROM dbo.CompanyUsers cu
        INNER JOIN dbo.Companies c ON c.id = cu.companyId
        WHERE cu.email = @email AND cu.estado = 1
        ORDER BY c.name
      `);
    return result.recordset;
  }

  static async getModules(companyId) {
    const pool = await getMasterPool();
    const result = await pool.request()
      .input('companyId', sql.Int, companyId)
      .query(`
        SELECT moduleCode, enabled, planCode, startsAt, expiresAt
        FROM dbo.CompanyModules
        WHERE companyId = @companyId
        ORDER BY moduleCode
      `);
    return result.recordset;
  }

  static async setModules(companyId, modules = {}, planCode = null) {
    const pool = await getMasterPool();
    const normalized = {
      inventory: Boolean(modules.inventory),
      pos: Boolean(modules.pos),
    };
    for (const [moduleCode, enabled] of Object.entries(normalized)) {
      await pool.request()
        .input('companyId', sql.Int, companyId)
        .input('moduleCode', sql.NVarChar(40), moduleCode)
        .input('enabled', sql.Bit, enabled ? 1 : 0)
        .input('planCode', sql.NVarChar(80), planCode || null)
        .query(`
          MERGE dbo.CompanyModules AS target
          USING (SELECT @companyId AS companyId, @moduleCode AS moduleCode) AS source
          ON target.companyId = source.companyId AND target.moduleCode = source.moduleCode
          WHEN MATCHED THEN
            UPDATE SET enabled = @enabled, planCode = @planCode, updatedAt = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (companyId, moduleCode, enabled, planCode)
            VALUES (@companyId, @moduleCode, @enabled, @planCode);
        `);
    }
  }

  static async linkUser(companyId, email) {
    const pool = await getMasterPool();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    await pool.request()
      .input('companyId', sql.Int, companyId)
      .input('email', sql.NVarChar(150), normalizedEmail)
      .query(`
        MERGE dbo.CompanyUsers AS target
        USING (SELECT @companyId AS companyId, @email AS email) AS source
        ON target.companyId = source.companyId AND target.email = source.email
        WHEN MATCHED THEN
          UPDATE SET estado = 1, updatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (companyId, email, estado)
          VALUES (source.companyId, source.email, 1);
      `);
  }

  static async unlinkUser(companyId, email) {
    const pool = await getMasterPool();
    await pool.request()
      .input('companyId', sql.Int, companyId)
      .input('email', sql.NVarChar(150), String(email || '').trim().toLowerCase())
      .query(`
        UPDATE dbo.CompanyUsers
        SET estado = 0, updatedAt = SYSUTCDATETIME()
        WHERE companyId = @companyId AND email = @email
      `);
  }

  static async create(company) {
    const pool = await getMasterPool();
    const result = await pool.request()
      .input('name', sql.NVarChar(150), company.name)
      .input('slug', sql.NVarChar(80), company.slug)
      .input('databaseName', sql.NVarChar(128), company.databaseName)
      .input('planName', sql.NVarChar(80), company.planName || null)
      .query(`
        INSERT INTO dbo.Companies (name, slug, databaseName, planName)
        OUTPUT INSERTED.*
        VALUES (@name, @slug, @databaseName, @planName)
      `);
    return result.recordset[0];
  }

  static async update(id, company) {
    const pool = await getMasterPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(150), company.name)
      .input('planName', sql.NVarChar(80), company.planName || null)
      .input('licenseStatus', sql.NVarChar(30), company.licenseStatus)
      .input('licenseExpiresAt', sql.DateTime2, company.licenseExpiresAt || null)
      .input('paymentStatus', sql.NVarChar(30), company.paymentStatus)
      .input('notes', sql.NVarChar(500), company.notes || null)
      .input('estado', sql.Bit, company.estado ?? 1)
      .query(`
        UPDATE dbo.Companies
        SET name = @name,
            planName = @planName,
            licenseStatus = @licenseStatus,
            licenseExpiresAt = @licenseExpiresAt,
            paymentStatus = @paymentStatus,
            notes = @notes,
            estado = @estado,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @id;

        SELECT * FROM dbo.Companies WHERE id = @id;
      `);
    return result.recordset[0];
  }
}

module.exports = CompanyModel;
