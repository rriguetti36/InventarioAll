const { poolPromise, sql } = require('../config/db');

class UserModel {
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT u.id, u.name, u.email, u.estado, u.role, u.assignedLocationId,
             l.name AS assignedLocationName, u.createdAt, u.updatedAt
      FROM Users u
      LEFT JOIN InventoryLocations l ON l.id = u.assignedLocationId
      ORDER BY u.name
    `);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT id, name, email, estado, role, assignedLocationId, createdAt, updatedAt FROM Users WHERE id = @id');
    return result.recordset[0];
  }

  static async getByEmail(email) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('email', sql.NVarChar(150), email)
      .query('SELECT id, name, email, password, estado, role, assignedLocationId FROM Users WHERE email = @email');
    return result.recordset[0];
  }

  static async create(user) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('name', sql.NVarChar(100), user.name)
      .input('email', sql.NVarChar(150), user.email)
      .input('password', sql.NVarChar(255), user.password)
      .input('estado', sql.Bit, user.estado ?? 1)
      .input('role', sql.NVarChar(30), user.role ?? 'user')
      .input('assignedLocationId', sql.Int, user.assignedLocationId || null)
      .query(
        'INSERT INTO Users (name, email, password, estado, role, assignedLocationId) OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role, INSERTED.assignedLocationId VALUES (@name, @email, @password, @estado, @role, @assignedLocationId)'
      );
    return result.recordset[0];
  }

  static async update(id, user) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(100), user.name)
      .input('email', sql.NVarChar(150), user.email)
      .input('estado', sql.Bit, user.estado ?? 1)
      .input('role', sql.NVarChar(30), user.role ?? 'user')
      .input('assignedLocationId', sql.Int, user.assignedLocationId || null)
      .query(
        'UPDATE Users SET name = @name, email = @email, estado = @estado, role = @role, assignedLocationId = @assignedLocationId WHERE id = @id; SELECT id, name, email, estado, role, assignedLocationId, createdAt, updatedAt FROM Users WHERE id = @id'
      );
    return result.recordset[0];
  }

  static async updatePassword(id, password) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('password', sql.NVarChar(255), password)
      .query(
        'UPDATE Users SET password = @password WHERE id = @id; SELECT id, name, email, estado, role, assignedLocationId, createdAt, updatedAt FROM Users WHERE id = @id'
      );
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Users WHERE id = @id');
    return { deleted: true };
  }
}

module.exports = UserModel;
