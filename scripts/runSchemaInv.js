const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const sql = require('mssql');

dotenv.config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

async function run() {
  const pool = await sql.connect(dbConfig);
  const scriptPath = path.join(__dirname, '..', 'db', 'schemaInv.sql');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const batches = script.split(/^GO\s*$/gim).map((batch) => batch.trim()).filter(Boolean);

  for (const batch of batches) {
    await pool.request().batch(batch);
  }

  await pool.close();
  console.log('schemaInv.sql ejecutado correctamente');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
