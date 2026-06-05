const express = require('express');
const CompanyController = require('../controllers/CompanyController');
const authMiddleware = require('../middleware/authMiddleware');
const platformAdminMiddleware = require('../middleware/platformAdminMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(platformAdminMiddleware);

router.get('/', CompanyController.getCompanies);
router.put('/:id', CompanyController.updateCompany);

module.exports = router;
