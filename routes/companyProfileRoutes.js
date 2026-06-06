const express = require('express');
const CompanyProfileController = require('../controllers/CompanyProfileController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleAccess');

const router = express.Router();

function requireTenantCompany(req, res, next) {
  if (!req.user?.companySlug || !req.user?.companyDatabase) {
    return res.status(403).json({ error: 'Esta configuracion solo esta disponible dentro de una compania' });
  }
  return next();
}

router.use(authMiddleware);
router.use(requireTenantCompany);
router.get('/', requireRoles(), CompanyProfileController.getProfile);
router.put('/', requireRoles(), CompanyProfileController.saveProfile);

module.exports = router;
