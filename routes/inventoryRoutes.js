const express = require('express');
const InventoryController = require('../controllers/InventoryController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleAccess');

const router = express.Router();

router.use(authMiddleware);

router.get('/suppliers', requireRoles(), InventoryController.listSuppliers);
router.post('/suppliers', requireRoles(), InventoryController.createSupplier);
router.put('/suppliers/:id', requireRoles(), InventoryController.updateSupplier);
router.delete('/suppliers/:id', requireRoles(), InventoryController.deleteSupplier);

router.get('/payment-methods', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.listPaymentMethods);
router.post('/payment-methods', requireRoles('admin_tienda', 'comercial'), InventoryController.createPaymentMethod);
router.put('/payment-methods/:id', requireRoles('admin_tienda', 'comercial'), InventoryController.updatePaymentMethod);
router.delete('/payment-methods/:id', requireRoles('admin_tienda', 'comercial'), InventoryController.deletePaymentMethod);

router.get('/locations', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.listLocations);
router.post('/locations', requireRoles(), InventoryController.createLocation);
router.put('/locations/:id', requireRoles(), InventoryController.updateLocation);
router.delete('/locations/:id', requireRoles(), InventoryController.deleteLocation);

router.get('/shelves', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.listShelves);
router.post('/shelves', requireRoles(), InventoryController.createShelf);
router.put('/shelves/:id', requireRoles(), InventoryController.updateShelf);
router.delete('/shelves/:id', requireRoles(), InventoryController.deleteShelf);

router.get('/products', requireRoles(), InventoryController.listProducts);
router.get('/sellable-items', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.listSellableItems);
router.post('/products', requireRoles(), InventoryController.createProduct);
router.put('/products/:id', requireRoles(), InventoryController.updateProduct);
router.delete('/products/:id', requireRoles(), InventoryController.deleteProduct);

router.get('/customers', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.listCustomers);
router.post('/customers', requireRoles('admin_tienda', 'vendedor_tienda'), InventoryController.createCustomer);
router.put('/customers/:id', requireRoles('admin_tienda', 'vendedor_tienda'), InventoryController.updateCustomer);
router.delete('/customers/:id', requireRoles('admin_tienda', 'vendedor_tienda'), InventoryController.deleteCustomer);

router.get('/sellers', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.listSellers);
router.get('/quotations/next-number', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.getNextQuotationNumber);
router.get('/quotations', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.listQuotations);
router.post('/quotations', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.createQuotation);
router.get('/quotations/:id', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.getQuotation);
router.put('/quotations/:id', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.updateQuotation);
router.get('/quotations/:id/pdf', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.getQuotationPdf);
router.post('/quotations/:id/approve', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.approveQuotation);

router.get('/stock', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.listStock);

router.get('/purchases', requireRoles(), InventoryController.listPurchases);
router.post('/purchases', requireRoles(), InventoryController.createPurchase);

router.get('/transfers', requireRoles(), InventoryController.listTransfers);
router.post('/transfers', requireRoles(), InventoryController.createTransfer);

router.get('/kardex', requireRoles('admin_tienda', 'comercial', 'vendedor_tienda'), InventoryController.listKardex);

router.get('/sales', requireRoles('admin_tienda', 'vendedor_tienda'), InventoryController.listSales);
router.get('/sales/:id', requireRoles('admin_tienda', 'vendedor_tienda'), InventoryController.getSale);
router.post('/sales/:id/documents', requireRoles('admin_tienda', 'vendedor_tienda'), InventoryController.createSaleDocument);
router.post('/sales', requireRoles('admin_tienda', 'vendedor_tienda'), InventoryController.createSale);
router.post('/sales/:id/close', requireRoles('admin_tienda', 'vendedor_tienda'), InventoryController.closeSale);
router.get('/sale-documents/:id/pdf', requireRoles('admin_tienda', 'vendedor_tienda'), InventoryController.getSaleDocumentPdf);

module.exports = router;
