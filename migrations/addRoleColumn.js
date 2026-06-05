const { poolPromise } = require('../config/db');

async function migrateAddRoleColumn() {
  try {
    const pool = await poolPromise;

    const checkRole = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'role'
    `);

    if (checkRole.recordset.length === 0) {
      await pool.request().query("ALTER TABLE Users ADD role NVARCHAR(30) DEFAULT 'user'");
      console.log('Columna role agregada a tabla Users');
    } else {
      await pool.request().query('ALTER TABLE Users ALTER COLUMN role NVARCHAR(30) NULL');
      console.log('Columna role ya existe en tabla Users');
    }

    const checkAssignedLocation = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'assignedLocationId'
    `);

    if (checkAssignedLocation.recordset.length === 0) {
      await pool.request().query('ALTER TABLE Users ADD assignedLocationId INT NULL');
      console.log('Columna assignedLocationId agregada a tabla Users');
    }
  } catch (err) {
    console.error('Error en migracion:', err.message);
  }
}

migrateAddRoleColumn();

module.exports = { migrateAddRoleColumn };
