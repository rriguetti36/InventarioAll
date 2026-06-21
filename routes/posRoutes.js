const express = require('express');
const PosController = require('../controllers/PosController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleAccess');
const { requireModule } = require('../middleware/moduleAccess');

const router = express.Router();

router.use(authMiddleware);
router.use(requireModule('pos'));

const POS_OPERATORS = ['admin_tienda', 'administrativo', 'vendedor_tienda'];
const POS_ADMIN = ['admin_tienda', 'administrativo'];

router.get('/bootstrap', requireRoles(...POS_OPERATORS), PosController.bootstrap);

router.get('/terminals', requireRoles(...POS_OPERATORS), PosController.listTerminals);
router.post('/terminals', requireRoles(...POS_ADMIN), PosController.createTerminal);
router.put('/terminals/:id', requireRoles(...POS_ADMIN), PosController.updateTerminal);

router.get('/shifts/open', requireRoles(...POS_OPERATORS), PosController.getOpenShift);
router.post('/shifts/open', requireRoles(...POS_OPERATORS), PosController.openShift);
router.post('/shifts/:id/close', requireRoles(...POS_OPERATORS), PosController.closeShift);

router.get('/shifts/:shiftId/cash-movements', requireRoles(...POS_OPERATORS), PosController.listCashMovements);
router.post('/cash-movements', requireRoles(...POS_OPERATORS), PosController.createCashMovement);

router.get('/sales', requireRoles(...POS_OPERATORS), PosController.listSales);
router.get('/sales/daily-summary', requireRoles(...POS_OPERATORS), PosController.dailySalesSummary);
router.get('/sales/:id/pdf', requireRoles(...POS_OPERATORS), PosController.getSalePdf);
router.get('/sales/:id', requireRoles(...POS_OPERATORS), PosController.getSale);
router.post('/sales', requireRoles(...POS_OPERATORS), PosController.createSale);

module.exports = router;
