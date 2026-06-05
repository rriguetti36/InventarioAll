function normalizeRole(role) {
  return role || 'user';
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const role = normalizeRole(req.user?.role);
    if (role === 'admin' || roles.includes(role)) {
      return next();
    }
    return res.status(403).json({ error: 'Acceso denegado para este perfil' });
  };
}

function scopedLocationId(user) {
  const role = normalizeRole(user?.role);
  if (['admin_tienda', 'vendedor_tienda'].includes(role)) {
    return user?.assignedLocationId || null;
  }
  return null;
}

module.exports = {
  requireRoles,
  scopedLocationId,
};
