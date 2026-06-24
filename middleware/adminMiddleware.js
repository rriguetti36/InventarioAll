const jwt = require('jsonwebtoken');
const { runWithDatabase } = require('../config/tenantContext');
const { isPosStoreAdmin } = require('./roleAccess');

function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'change_this_secret';
    const decoded = jwt.verify(token, secret);
    
    if (decoded.role !== 'admin' && !isPosStoreAdmin(decoded)) {
      return res.status(403).json({ error: 'Acceso denegado: se requieren permisos de administrador' });
    }

    req.user = decoded;
    if (decoded.companyDatabase) {
      return runWithDatabase(decoded.companyDatabase, () => next());
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = adminMiddleware;
