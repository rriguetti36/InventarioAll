const express = require('express');
const InventoryController = require('../controllers/InventoryController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleAccess');
const { hasModule } = require('../middleware/moduleAccess');

const router = express.Router();

router.use(authMiddleware);

const POS_ALLOWED_INVENTORY_PATHS = [
  { method: 'GET', pattern: /^\/products\/?$/ },
  { method: 'POST', pattern: /^\/products\/?$/ },
  { method: 'PUT', pattern: /^\/products\/\d+\/?$/ },
  { method: 'DELETE', pattern: /^\/products\/\d+\/?$/ },
  { method: 'GET', pattern: /^\/locations\/?$/ },
  { method: 'POST', pattern: /^\/locations\/?$/ },
  { method: 'PUT', pattern: /^\/locations\/\d+\/?$/ },
  { method: 'DELETE', pattern: /^\/locations\/\d+\/?$/ },
  { method: 'GET', pattern: /^\/suppliers\/?$/ },
  { method: 'GET', pattern: /^\/shelves\/?$/ },
  { method: 'GET', pattern: /^\/customers\/?$/ },
  { method: 'POST', pattern: /^\/customers\/?$/ },
  { method: 'GET', pattern: /^\/sellable-items\/?$/ },
  { method: 'GET', pattern: /^\/payment-methods\/?$/ },
  { method: 'GET', pattern: /^\/stock\/?$/ },
  { method: 'POST', pattern: /^\/stock\/adjust\/?$/ },
];

function isPosAllowedInventoryRequest(req) {
  return POS_ALLOWED_INVENTORY_PATHS.some((route) => (
    route.method === req.method && route.pattern.test(req.path)
  ));
}

function requireInventoryOrPosCatalog(req, res, next) {
  if (hasModule(req.user, 'inventory')) return next();
  if (hasModule(req.user, 'pos') && isPosAllowedInventoryRequest(req)) return next();
  return res.status(403).json({ error: 'Modulo inventory no contratado para esta empresa' });
}

router.use(requireInventoryOrPosCatalog);

const CATALOG_PRODUCTS = ['administrativo', 'operativo'];
const CATALOG_SUPPLIERS = ['administrativo', 'operativo'];
const CATALOG_LOCATIONS = ['administrativo', 'operativo'];
const CATALOG_SHELVES = ['admin_tienda', 'administrativo', 'operativo'];
const CATALOG_CUSTOMERS = ['admin_tienda', 'administrativo', 'operativo', 'comercial', 'vendedor_tienda'];
const QUOTATIONS = ['admin_tienda', 'administrativo', 'comercial', 'vendedor_tienda'];
const SALES = ['admin_tienda', 'administrativo', 'vendedor_tienda'];
const STOCK = ['admin_tienda', 'administrativo', 'operativo'];
const PURCHASES = ['administrativo', 'operativo'];
const TRANSFERS = ['admin_tienda', 'administrativo', 'operativo'];
const KARDEX = ['admin_tienda', 'administrativo', 'operativo'];
const PAYMENT_METHOD_READ = ['admin_tienda', 'administrativo', 'comercial', 'vendedor_tienda'];

router.get('/suppliers', requireRoles(...CATALOG_SUPPLIERS), InventoryController.listSuppliers);
router.post('/suppliers', requireRoles(...CATALOG_SUPPLIERS), InventoryController.createSupplier);
router.put('/suppliers/:id', requireRoles(...CATALOG_SUPPLIERS), InventoryController.updateSupplier);
router.delete('/suppliers/:id', requireRoles(...CATALOG_SUPPLIERS), InventoryController.deleteSupplier);

router.get('/payment-methods', requireRoles(...PAYMENT_METHOD_READ), InventoryController.listPaymentMethods);
router.post('/payment-methods', requireRoles(), InventoryController.createPaymentMethod);
router.put('/payment-methods/:id', requireRoles(), InventoryController.updatePaymentMethod);
router.delete('/payment-methods/:id', requireRoles(), InventoryController.deletePaymentMethod);

router.get('/locations', requireRoles(...CATALOG_LOCATIONS, 'admin_tienda', 'vendedor_tienda'), InventoryController.listLocations);
router.post('/locations', requireRoles(...CATALOG_LOCATIONS), InventoryController.createLocation);
router.put('/locations/:id', requireRoles(...CATALOG_LOCATIONS), InventoryController.updateLocation);
router.delete('/locations/:id', requireRoles(...CATALOG_LOCATIONS), InventoryController.deleteLocation);

router.get('/shelves', requireRoles(...CATALOG_SHELVES, 'vendedor_tienda'), InventoryController.listShelves);
router.post('/shelves', requireRoles(...CATALOG_SHELVES), InventoryController.createShelf);
router.put('/shelves/:id', requireRoles(...CATALOG_SHELVES), InventoryController.updateShelf);
router.delete('/shelves/:id', requireRoles(...CATALOG_SHELVES), InventoryController.deleteShelf);

router.get('/products', requireRoles(...CATALOG_PRODUCTS), InventoryController.listProducts);
router.get('/sellable-items', requireRoles(...QUOTATIONS, ...SALES), InventoryController.listSellableItems);
router.post('/products', requireRoles(...CATALOG_PRODUCTS), InventoryController.createProduct);
router.put('/products/:id', requireRoles(...CATALOG_PRODUCTS), InventoryController.updateProduct);
router.delete('/products/:id', requireRoles(...CATALOG_PRODUCTS), InventoryController.deleteProduct);

router.get('/customers', requireRoles(...CATALOG_CUSTOMERS), InventoryController.listCustomers);
router.post('/customers', requireRoles(...CATALOG_CUSTOMERS), InventoryController.createCustomer);
router.put('/customers/:id', requireRoles(...CATALOG_CUSTOMERS), InventoryController.updateCustomer);
router.delete('/customers/:id', requireRoles(...CATALOG_CUSTOMERS), InventoryController.deleteCustomer);

router.get('/sellers', requireRoles(...QUOTATIONS), InventoryController.listSellers);
router.get('/quotations/next-number', requireRoles(...QUOTATIONS), InventoryController.getNextQuotationNumber);
router.get('/quotations', requireRoles(...QUOTATIONS), InventoryController.listQuotations);
router.post('/quotations', requireRoles(...QUOTATIONS), InventoryController.createQuotation);
router.get('/quotations/:id', requireRoles(...QUOTATIONS), InventoryController.getQuotation);
router.put('/quotations/:id', requireRoles(...QUOTATIONS), InventoryController.updateQuotation);
router.get('/quotations/:id/pdf', requireRoles(...QUOTATIONS), InventoryController.getQuotationPdf);
router.post('/quotations/:id/approve', requireRoles(...QUOTATIONS), InventoryController.approveQuotation);

router.get('/stock', requireRoles(...STOCK), InventoryController.listStock);
router.post('/stock/adjust', requireRoles(...STOCK), InventoryController.adjustStock);
router.put('/stock/:id/shelf', requireRoles(...STOCK), InventoryController.moveStockShelf);

router.get('/purchases', requireRoles(...PURCHASES), InventoryController.listPurchases);
router.post('/purchases', requireRoles(...PURCHASES), InventoryController.createPurchase);

router.get('/transfers', requireRoles(...TRANSFERS), InventoryController.listTransfers);
router.post('/transfers', requireRoles(...TRANSFERS), InventoryController.createTransfer);

router.get('/kardex', requireRoles(...KARDEX), InventoryController.listKardex);

router.get('/sales', requireRoles(...SALES), InventoryController.listSales);
router.get('/sales/:id', requireRoles(...SALES), InventoryController.getSale);
router.post('/sales/:id/documents', requireRoles(...SALES), InventoryController.createSaleDocument);
router.post('/sales', requireRoles(...SALES), InventoryController.createSale);
router.post('/sales/:id/close', requireRoles(...SALES), InventoryController.closeSale);
router.get('/sale-documents/:id/pdf', requireRoles(...SALES), InventoryController.getSaleDocumentPdf);

module.exports = router;
