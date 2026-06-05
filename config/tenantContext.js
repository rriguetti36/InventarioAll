const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

function normalizeDatabaseName(databaseName) {
  return databaseName || process.env.DB_DATABASE;
}

function getCurrentDatabase() {
  const context = tenantStorage.getStore();
  return normalizeDatabaseName(context?.databaseName);
}

function runWithDatabase(databaseName, callback) {
  return tenantStorage.run({ databaseName: normalizeDatabaseName(databaseName) }, callback);
}

module.exports = {
  getCurrentDatabase,
  runWithDatabase,
};
