const jwt = require('jsonwebtoken');
const { runWithDatabase } = require('../config/tenantContext');
const CompanyService = require('../services/CompanyService');

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid Authorization format' });
  }
  const token = parts[1];
  try {
    const secret = process.env.JWT_SECRET || 'change_this_secret';
    const payload = jwt.verify(token, secret);
    if (payload.companySlug) {
      await CompanyService.validateCompanyAccess(payload.companySlug);
    }
    req.user = payload;
    if (payload.companyDatabase) {
      return runWithDatabase(payload.companyDatabase, () => next());
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
