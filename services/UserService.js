const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/UserModel');
const CompanyService = require('./CompanyService');
const { runWithDatabase } = require('../config/tenantContext');

const tiendaRoles = ['admin_tienda', 'vendedor_tienda'];

class UserService {
  static async getAllUsers() {
    return await UserModel.getAll();
  }

  static async getUserById(id) {
    const user = await UserModel.getById(id);
    if (!user) {
      const error = new Error('Usuario no encontrado');
      error.status = 404;
      throw error;
    }
    return user;
  }

  static async createUser(data, actor = null) {
    if (!data.name || !data.email || !data.password) {
      const error = new Error('Los campos name, email y password son obligatorios');
      error.status = 400;
      throw error;
    }
    const hashed = await bcrypt.hash(data.password, 10);
    const role = data.role ?? 'user';
    if (tiendaRoles.includes(role) && !data.assignedLocationId) {
      const error = new Error('Debes asignar una tienda para este perfil');
      error.status = 400;
      throw error;
    }
    const created = await UserModel.create({
      name: data.name,
      email: data.email,
      password: hashed,
      estado: data.estado ?? 1,
      role,
      assignedLocationId: tiendaRoles.includes(role) ? data.assignedLocationId : null,
    });
    if (actor?.companyId) {
      await CompanyService.linkUserToCompany(actor.companyId, created.email);
    }
    return created;
  }

  static async updateUser(id, data, actor = null) {
    const existingUser = await UserModel.getById(id);
    if (!existingUser) {
      const error = new Error('Usuario no encontrado');
      error.status = 404;
      throw error;
    }
    if (!data.name || !data.email) {
      const error = new Error('Los campos name y email son obligatorios');
      error.status = 400;
      throw error;
    }
    const role = data.role ?? existingUser.role;
    if (tiendaRoles.includes(role) && !data.assignedLocationId) {
      const error = new Error('Debes asignar una tienda para este perfil');
      error.status = 400;
      throw error;
    }
    const updated = await UserModel.update(id, {
      name: data.name,
      email: data.email,
      estado: data.estado ?? existingUser.estado,
      role,
      assignedLocationId: tiendaRoles.includes(role) ? data.assignedLocationId : null,
    });
    if (actor?.companyId) {
      if (existingUser.email !== updated.email) {
        await CompanyService.unlinkUserFromCompany(actor.companyId, existingUser.email);
      }
      if (updated.estado) {
        await CompanyService.linkUserToCompany(actor.companyId, updated.email);
      } else {
        await CompanyService.unlinkUserFromCompany(actor.companyId, updated.email);
      }
    }
    return updated;
  }

  static async changePassword(id, data) {
    const existingUser = await UserModel.getById(id);
    if (!existingUser) {
      const error = new Error('Usuario no encontrado');
      error.status = 404;
      throw error;
    }
    if (!data.password) {
      const error = new Error('La nueva contraseña es obligatoria');
      error.status = 400;
      throw error;
    }
    const hashed = await bcrypt.hash(data.password, 10);
    return await UserModel.updatePassword(id, hashed);
  }

  static async deleteUser(id, actor = null) {
    const existingUser = await UserModel.getById(id);
    if (!existingUser) {
      const error = new Error('Usuario no encontrado');
      error.status = 404;
      throw error;
    }
    const deleted = await UserModel.delete(id);
    if (actor?.companyId) {
      await CompanyService.unlinkUserFromCompany(actor.companyId, existingUser.email);
    }
    return deleted;
  }

  static async loginUser(email, password, companySlug = null) {
    if (!email || !password) {
      const error = new Error('Email y password son requeridos');
      error.status = 400;
      throw error;
    }

    let company = null;
    if (companySlug) {
      company = await CompanyService.validateCompanyAccess(companySlug);
    } else {
      const companies = await CompanyService.getCompaniesByUserEmail(email);
      if (companies.length === 1) {
        company = await CompanyService.validateCompanyAccess(companies[0].slug);
      } else if (companies.length > 1) {
        const error = new Error('Tu usuario pertenece a varias empresas. Ingresa el codigo de empresa para continuar.');
        error.status = 400;
        error.companies = companies.map((item) => ({ name: item.name, slug: item.slug }));
        throw error;
      }
    }

    const user = company
      ? await runWithDatabase(company.databaseName, () => UserModel.getByEmail(email))
      : await UserModel.getByEmail(email);

    if (!user) {
      const error = new Error('Usuario no encontrado');
      error.status = 404;
      throw error;
    }
    if (!user.estado) {
      const error = new Error('Acceso denegado: usuario inactivo');
      error.status = 403;
      throw error;
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      const error = new Error('Credenciales inválidas');
      error.status = 401;
      throw error;
    }
    const companyPayload = company ? {
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug,
      companyDatabase: company.databaseName,
      modules: company.modules || {},
    } : {};
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      assignedLocationId: user.assignedLocationId || null,
      ...companyPayload,
    };
    const secret = process.env.JWT_SECRET || 'change_this_secret';
    const token = jwt.sign(payload, secret, { expiresIn: '8h' });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      assignedLocationId: user.assignedLocationId || null,
      companyId: company?.id || null,
      companyName: company?.name || null,
      companySlug: company?.slug || null,
      modules: company?.modules || {},
      token,
    };
  }
}

module.exports = UserService;
