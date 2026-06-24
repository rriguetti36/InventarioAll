function normalizeRole(role) {
  return role || 'user';
}

function isPosStoreAdmin(user) {
  const modules = user?.modules || {};
  return normalizeRole(user?.role) === 'admin_tienda' && Boolean(modules.pos) && !modules.inventory;
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const role = normalizeRole(req.user?.role);
    if (role === 'admin' || isPosStoreAdmin(req.user) || roles.includes(role)) {
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
  isPosStoreAdmin,
  scopedLocationId,
};
