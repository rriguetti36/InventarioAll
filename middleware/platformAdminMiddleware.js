function platformAdminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: se requieren permisos de administrador' });
  }

  if (req.user?.companyDatabase) {
    return res.status(403).json({ error: 'Acceso denegado: usa una sesion de plataforma' });
  }

  return next();
}

module.exports = platformAdminMiddleware;
