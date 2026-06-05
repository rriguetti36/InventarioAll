const sql = require('mssql');
const { getCurrentDatabase } = require('./tenantContext');

const pools = new Map();

function buildConfig(database) {
  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database,
    options: {
      encrypt: false,
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

function getPool(database = getCurrentDatabase()) {
  if (!database) {
    throw new Error('DB_DATABASE no configurado');
  }

  if (!pools.has(database)) {
    const pool = new sql.ConnectionPool(buildConfig(database))
      .connect()
      .then((connectedPool) => {
        console.log(`Conectado a SQL Server (${database})`);
        return connectedPool;
      })
      .catch((err) => {
        pools.delete(database);
        console.error(`Error de conexion SQL Server (${database}):`, err);
        throw err;
      });

    pools.set(database, pool);
  }

  return pools.get(database);
}

const poolPromise = {
  then(resolve, reject) {
    return getPool().then(resolve, reject);
  },
  catch(reject) {
    return getPool().catch(reject);
  },
  finally(callback) {
    return getPool().finally(callback);
  },
};

function getMasterPool() {
  return getPool(process.env.DB_MASTER_DATABASE || process.env.DB_DATABASE);
}

module.exports = {
  sql,
  poolPromise,
  getPool,
  getMasterPool,
};
