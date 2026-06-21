function hasModule(user, moduleCode) {
  if (!user?.companySlug) return true;
  const modules = user.modules || {};
  return Boolean(modules[moduleCode]);
}

function requireModule(moduleCode) {
  return (req, res, next) => {
    if (hasModule(req.user, moduleCode)) return next();
    return res.status(403).json({ error: `Modulo ${moduleCode} no contratado para esta empresa` });
  };
}

module.exports = { requireModule, hasModule };
