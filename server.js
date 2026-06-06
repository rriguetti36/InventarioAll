const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const { migrateAddRoleColumn } = require('./migrations/addRoleColumn');
const CompanyService = require('./services/CompanyService');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const companyRoutes = require('./routes/companyRoutes');
const companyProfileRoutes = require('./routes/companyProfileRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const path = require('path');

// Ejecutar migraciones
migrateAddRoleColumn();
CompanyService.ensureMasterSchema().catch((err) => {
  console.error('Error preparando esquema maestro de empresas:', err);
});
CompanyService.syncCompanyUserIndex().catch((err) => {
  console.error('Error sincronizando usuarios de companias:', err);
});

const app = express();
const allowedOrigin = process.env.CLIENT_ORIGIN || /http:\/\/localhost:\d+/;
app.use(cors({ origin: allowedOrigin, credentials: true }));
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3001;

app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads/products', express.static(path.join(__dirname, 'uploads', 'products')));
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
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
