const InventoryModel = require('../models/InventoryModel');
const { scopedLocationId } = require('../middleware/roleAccess');
const QuotationPdfService = require('./QuotationPdfService');
const SaleDocumentPdfService = require('./SaleDocumentPdfService');
const CompanyProfileService = require('./CompanyProfileService');

function scopedSellerId(user) {
  return user?.role && user.role !== 'admin' ? user.id : null;
}

function required(data, fields) {
  const missing = fields.filter((field) => data[field] === undefined || data[field] === null || data[field] === '');
  if (missing.length) {
    const error = new Error(`Campos obligatorios: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
}

function validateDetails(details) {
  if (!Array.isArray(details) || details.length === 0) {
    const error = new Error('Debes agregar al menos un producto');
    error.status = 400;
    throw error;
  }

  details.forEach((item) => {
    required(item, ['productId', 'quantity']);
    if (Number(item.quantity) <= 0) {
      const error = new Error('La cantidad debe ser mayor que cero');
      error.status = 400;
      throw error;
    }
  });
}

class InventoryService {
  static listSuppliers() {
    return InventoryModel.listSuppliers();
  }

  static createSupplier(data) {
    required(data, ['name']);
    return InventoryModel.createSupplier(data);
  }

  static updateSupplier(id, data) {
    required(data, ['name']);
    return InventoryModel.updateSupplier(id, data);
  }

  static deleteSupplier(id) {
    return InventoryModel.deleteSupplier(id);
  }

  static listPaymentMethods() {
    return InventoryModel.listPaymentMethods();
  }

  static createPaymentMethod(data) {
    required(data, ['companyName', 'name']);
    return InventoryModel.createPaymentMethod(data);
  }

  static updatePaymentMethod(id, data) {
    required(data, ['companyName', 'name']);
    return InventoryModel.updatePaymentMethod(id, data);
  }

  static deletePaymentMethod(id) {
    return InventoryModel.deletePaymentMethod(id);
  }

  static listLocations(user) {
    return InventoryModel.listLocations(scopedLocationId(user));
  }

  static createLocation(data) {
    required(data, ['name']);
    return InventoryModel.createLocation(data);
  }

  static updateLocation(id, data) {
    required(data, ['name']);
    return InventoryModel.updateLocation(id, data);
  }

  static deleteLocation(id) {
    return InventoryModel.deleteLocation(id);
  }

  static listShelves(user) {
    return InventoryModel.listShelves(scopedLocationId(user));
  }

  static createShelf(data) {
    required(data, ['locationId', 'name']);
    return InventoryModel.createShelf(data);
  }

  static updateShelf(id, data) {
    required(data, ['locationId', 'name']);
    return InventoryModel.updateShelf(id, data);
  }

  static deleteShelf(id) {
    return InventoryModel.deleteShelf(id);
  }

  static listProducts() {
    return InventoryModel.listProducts();
  }

  static createProduct(data) {
    required(data, ['sku', 'name']);
    return InventoryModel.createProduct(data);
  }

  static updateProduct(id, data) {
    required(data, ['sku', 'name']);
    return InventoryModel.updateProduct(id, data);
  }

  static deleteProduct(id) {
    return InventoryModel.deleteProduct(id);
  }

  static listSellableItems(user) {
    return InventoryModel.listSellableItems(scopedLocationId(user));
  }

  static listCustomers() {
    return InventoryModel.listCustomers();
  }

  static createCustomer(data) {
    required(data, ['name']);
    const documentType = String(data.documentType || '').toUpperCase();
    const documentNumber = String(data.documentNumber || '').replace(/\s/g, '');
    if (documentType === 'RUC' && !/^\d{11}$/.test(documentNumber)) {
      const error = new Error('El RUC debe tener 11 digitos');
      error.status = 400;
      throw error;
    }
    return InventoryModel.createCustomer({ ...data, documentType, documentNumber });
  }

  static updateCustomer(id, data) {
    required(data, ['name']);
    const documentType = String(data.documentType || '').toUpperCase();
    const documentNumber = String(data.documentNumber || '').replace(/\s/g, '');
    if (documentType === 'RUC' && !/^\d{11}$/.test(documentNumber)) {
      const error = new Error('El RUC debe tener 11 digitos');
      error.status = 400;
      throw error;
    }
    return InventoryModel.updateCustomer(id, { ...data, documentType, documentNumber });
  }

  static deleteCustomer(id) {
    return InventoryModel.deleteCustomer(id);
  }

  static listSellers(user) {
    const sellerId = scopedSellerId(user);
    return InventoryModel.listSellers(sellerId);
  }

  static getNextQuotationNumber() {
    return InventoryModel.getNextQuotationNumber();
  }

  static listQuotations(user) {
    const sellerId = scopedSellerId(user);
    return InventoryModel.listQuotations(sellerId);
  }

  static createQuotation(data, user) {
    if (scopedSellerId(user)) {
      data.sellerId = user.id;
    }
    required(data, ['quotationDate', 'currency', 'customerId', 'sellerId']);
    validateDetails(data.details);
    return InventoryModel.createQuotation(data);
  }

  static getQuotation(id, user) {
    const sellerId = scopedSellerId(user);
    return InventoryModel.getQuotation(id, sellerId);
  }

  static updateQuotation(id, data, user) {
    if (scopedSellerId(user)) {
      data.sellerId = user.id;
    }
    required(data, ['quotationDate', 'currency', 'customerId', 'sellerId']);
    validateDetails(data.details);
    const sellerId = scopedSellerId(user);
    return InventoryModel.updateQuotation(id, data, sellerId);
  }

  static async getQuotationPdf(id, user) {
    const sellerId = scopedSellerId(user);
    const documentData = await InventoryModel.getQuotationDocument(id, sellerId);
    const company = await CompanyProfileService.getProfile();
    const buffer = await QuotationPdfService.build({ ...documentData, company });
    return {
      buffer,
      filename: `cotizacion-${documentData.header.quotationNumber}.pdf`,
    };
  }

  static approveQuotation(id, user) {
    return InventoryModel.approveQuotation(id, scopedSellerId(user));
  }

  static listStock(user) {
    return InventoryModel.listStock(scopedLocationId(user));
  }

  static moveStockShelf(id, data, user) {
    const stockId = Number(id);
    if (!Number.isInteger(stockId) || stockId <= 0) {
      const error = new Error('Existencia invalida');
      error.status = 400;
      throw error;
    }
    return InventoryModel.moveStockShelf(stockId, data.targetShelfId, scopedLocationId(user));
  }

  static adjustStock(data, user) {
    required(data, ['productId', 'locationId', 'quantity']);
    return InventoryModel.adjustStock(data, scopedLocationId(user));
  }

  static listPurchases() {
    return InventoryModel.listPurchases();
  }

  static createPurchase(data) {
    required(data, ['locationId']);
    validateDetails(data.details);
    return InventoryModel.createPurchase(data);
  }

  static listTransfers() {
    return InventoryModel.listTransfers();
  }

  static createTransfer(data) {
    required(data, ['sourceLocationId', 'targetLocationId']);
    if (Number(data.sourceLocationId) === Number(data.targetLocationId) && String(data.sourceShelfId || '') === String(data.targetShelfId || '')) {
      const error = new Error('El origen y destino del traslado no pueden ser iguales');
      error.status = 400;
      throw error;
    }
    validateDetails(data.details);
    return InventoryModel.createTransfer(data);
  }

  static listKardex(user) {
    return InventoryModel.listKardex(scopedLocationId(user));
  }

  static listSales(user) {
    return InventoryModel.listSales(scopedLocationId(user));
  }

  static getSale(id, user) {
    return InventoryModel.getSale(id, scopedLocationId(user));
  }

  static createSaleDocument(saleId, data, user) {
    return InventoryModel.createSaleDocument(saleId, data, scopedLocationId(user));
  }

  static async getSaleDocumentPdf(documentId, user) {
    const documentData = await InventoryModel.getSaleDocument(documentId, scopedLocationId(user));
    const company = await CompanyProfileService.getProfile();
    const buffer = await SaleDocumentPdfService.build({ ...documentData, company });
    return {
      buffer,
      filename: `${documentData.document.documentType}-${documentData.document.fullNumber}.pdf`,
    };
  }

  static createSale(data, user) {
    required(data, ['locationId']);
    InventoryService.ensureLocationScope(data.locationId, user);
    data.sellerId = user?.id || data.sellerId || null;
    validateDetails(data.details);
    return InventoryModel.createSale(data);
  }

  static closeSale(id, data, user) {
    required(data, ['locationId']);
    InventoryService.ensureLocationScope(data.locationId, user);
    return InventoryModel.closeSale(id, data);
  }

  static ensureLocationScope(locationId, user) {
    const assignedLocationId = scopedLocationId(user);
    if (assignedLocationId && Number(locationId) !== Number(assignedLocationId)) {
      const error = new Error('Solo puedes operar con la tienda asignada');
      error.status = 403;
      throw error;
    }
    if (['admin_tienda', 'vendedor_tienda'].includes(user?.role) && !assignedLocationId) {
      const error = new Error('Tu usuario no tiene una tienda asignada');
      error.status = 403;
      throw error;
    }
  }
}

module.exports = InventoryService;
