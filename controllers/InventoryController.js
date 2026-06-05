const InventoryService = require('../services/InventoryService');

function controller(action) {
  return async (req, res, next) => {
    try {
      const result = await action(req);
      res.status(req.method === 'POST' ? 201 : 200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

class InventoryController {
  static listSuppliers = controller(() => InventoryService.listSuppliers());
  static createSupplier = controller((req) => InventoryService.createSupplier(req.body));
  static updateSupplier = controller((req) => InventoryService.updateSupplier(parseInt(req.params.id, 10), req.body));
  static deleteSupplier = async (req, res, next) => {
    try {
      await InventoryService.deleteSupplier(parseInt(req.params.id, 10));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  static listPaymentMethods = controller(() => InventoryService.listPaymentMethods());
  static createPaymentMethod = controller((req) => InventoryService.createPaymentMethod(req.body));
  static updatePaymentMethod = controller((req) => InventoryService.updatePaymentMethod(parseInt(req.params.id, 10), req.body));
  static deletePaymentMethod = async (req, res, next) => {
    try {
      await InventoryService.deletePaymentMethod(parseInt(req.params.id, 10));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  static listLocations = controller((req) => InventoryService.listLocations(req.user));
  static createLocation = controller((req) => InventoryService.createLocation(req.body));
  static updateLocation = controller((req) => InventoryService.updateLocation(parseInt(req.params.id, 10), req.body));
  static deleteLocation = async (req, res, next) => {
    try {
      await InventoryService.deleteLocation(parseInt(req.params.id, 10));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  static listShelves = controller((req) => InventoryService.listShelves(req.user));
  static createShelf = controller((req) => InventoryService.createShelf(req.body));
  static updateShelf = controller((req) => InventoryService.updateShelf(parseInt(req.params.id, 10), req.body));
  static deleteShelf = async (req, res, next) => {
    try {
      await InventoryService.deleteShelf(parseInt(req.params.id, 10));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  static listProducts = controller(() => InventoryService.listProducts());
  static createProduct = controller((req) => InventoryService.createProduct(req.body));
  static updateProduct = controller((req) => InventoryService.updateProduct(parseInt(req.params.id, 10), req.body));
  static listSellableItems = controller((req) => InventoryService.listSellableItems(req.user));
  static deleteProduct = async (req, res, next) => {
    try {
      await InventoryService.deleteProduct(parseInt(req.params.id, 10));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  static listCustomers = controller(() => InventoryService.listCustomers());
  static createCustomer = controller((req) => InventoryService.createCustomer(req.body));
  static updateCustomer = controller((req) => InventoryService.updateCustomer(parseInt(req.params.id, 10), req.body));
  static deleteCustomer = async (req, res, next) => {
    try {
      await InventoryService.deleteCustomer(parseInt(req.params.id, 10));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  static listSellers = controller((req) => InventoryService.listSellers(req.user));
  static getNextQuotationNumber = controller(() => InventoryService.getNextQuotationNumber());
  static listQuotations = controller((req) => InventoryService.listQuotations(req.user));
  static getQuotation = controller((req) => InventoryService.getQuotation(parseInt(req.params.id, 10), req.user));
  static createQuotation = controller((req) => InventoryService.createQuotation(req.body, req.user));
  static updateQuotation = controller((req) => InventoryService.updateQuotation(parseInt(req.params.id, 10), req.body, req.user));
  static getQuotationPdf = async (req, res, next) => {
    try {
      const pdf = await InventoryService.getQuotationPdf(parseInt(req.params.id, 10), req.user);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
      res.send(pdf.buffer);
    } catch (err) {
      next(err);
    }
  };
  static approveQuotation = controller((req) => InventoryService.approveQuotation(parseInt(req.params.id, 10), req.user));

  static listStock = controller((req) => InventoryService.listStock(req.user));
  static listPurchases = controller(() => InventoryService.listPurchases());
  static createPurchase = controller((req) => InventoryService.createPurchase(req.body));
  static listTransfers = controller(() => InventoryService.listTransfers());
  static createTransfer = controller((req) => InventoryService.createTransfer(req.body));
  static listKardex = controller((req) => InventoryService.listKardex(req.user));
  static listSales = controller((req) => InventoryService.listSales(req.user));
  static getSale = controller((req) => InventoryService.getSale(parseInt(req.params.id, 10), req.user));
  static createSaleDocument = controller((req) => InventoryService.createSaleDocument(parseInt(req.params.id, 10), req.body, req.user));
  static getSaleDocumentPdf = async (req, res, next) => {
    try {
      const pdf = await InventoryService.getSaleDocumentPdf(parseInt(req.params.id, 10), req.user);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
      res.send(pdf.buffer);
    } catch (err) {
      next(err);
    }
  };
  static createSale = controller((req) => InventoryService.createSale(req.body, req.user));
  static closeSale = controller((req) => InventoryService.closeSale(parseInt(req.params.id, 10), req.body, req.user));
}

module.exports = InventoryController;
