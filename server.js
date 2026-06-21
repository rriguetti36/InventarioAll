const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const { migrateAddRoleColumn } = require('./migrations/addRoleColumn');
const CompanyService = require('./services/CompanyService');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const posRoutes = require('./routes/posRoutes');
const companyRoutes = require('./routes/companyRoutes');
const companyProfileRoutes = require('./routes/companyProfileRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const path = require('path');

// Ejecutar migraciones
migrateAddRoleColumn();
CompanyService.ensureMasterSchema()
  .then(() => CompanyService.syncCompanyUserIndex())
  .catch((err) => {
    console.error('Error preparando empresas:', err);
  });

const app = express();
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const localhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
app.use(cors({
  origin(origin, callback) {
    if (!origin || localhostOrigin.test(origin) || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3001;

app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company-profile', companyProfileRoutes);
app.use('/api/uploads', uploadRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API Express + SQL Server Express funcionando' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

function startServer(port = DEFAULT_PORT) {
  const server = app.listen(port, () => {
    console.log(`Servidor iniciado en http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Puerto ${port} en uso, probando el siguiente puerto...`);
      startServer(port + 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

startServer();
