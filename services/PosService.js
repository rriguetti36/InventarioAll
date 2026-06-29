const bcrypt = require('bcryptjs');
const PosModel = require('../models/PosModel');
const UserModel = require('../models/UserModel');
const InventoryModel = require('../models/InventoryModel');
const CompanyProfileService = require('./CompanyProfileService');
const PosReceiptPdfService = require('./PosReceiptPdfService');
const { scopedLocationId } = require('../middleware/roleAccess');

function required(data, fields) {
  const missing = fields.filter((field) => data[field] === undefined || data[field] === null || data[field] === '');
  if (missing.length) {
    const error = new Error(`Campos obligatorios: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Debes agregar al menos un producto');
    error.status = 400;
    throw error;
  }
  items.forEach((item) => {
    required(item, ['productId', 'quantity', 'unitPrice']);
    if (Number(item.quantity) <= 0) {
      const error = new Error('La cantidad debe ser mayor que cero');
      error.status = 400;
      throw error;
    }
  });
}

function validatePayments(payments) {
  if (!Array.isArray(payments) || payments.length === 0) {
    const error = new Error('Debes registrar al menos un pago');
    error.status = 400;
    throw error;
  }
  payments.forEach((payment) => {
    required(payment, ['methodName', 'amount']);
    if (Number(payment.amount) <= 0) {
      const error = new Error('El importe de pago debe ser mayor que cero');
      error.status = 400;
      throw error;
    }
    const methodName = String(payment.methodName || '').toLowerCase();
    const needsReference = ['yape', 'plin', 'transferencia', 'deposito', 'depósito', 'tarjeta', 'card', 'visa', 'mastercard']
      .some((term) => methodName.includes(term));
    const isCard = ['tarjeta', 'card', 'visa', 'mastercard'].some((term) => methodName.includes(term));
    const needsVoucherImage = ['transferencia', 'deposito', 'depósito'].some((term) => methodName.includes(term));
    if (needsReference && !payment.referenceNumber) {
      const error = new Error(isCard ? 'Debes registrar el codigo de autorizacion del POS' : 'Debes registrar el numero de operacion');
      error.status = 400;
      throw error;
    }
    if (needsVoucherImage && !payment.voucherImageUrl) {
      const error = new Error('Las transferencias y depositos requieren foto del voucher');
      error.status = 400;
      throw error;
    }
  });
}

function isStoreRole(role) {
  return ['admin_tienda', 'vendedor_tienda'].includes(role);
}

function isSupervisorForLocation(authorizer, locationId) {
  if (['admin', 'administrativo'].includes(authorizer?.role)) return true;
  return authorizer?.role === 'admin_tienda' && Number(authorizer.assignedLocationId) === Number(locationId);
}

class PosService {
  static ensureLocationScope(locationId, user) {
    const assignedLocationId = scopedLocationId(user);
    if (assignedLocationId && Number(locationId) !== Number(assignedLocationId)) {
      const error = new Error('Solo puedes operar con la tienda asignada');
      error.status = 403;
      throw error;
    }
    if (isStoreRole(user?.role) && !assignedLocationId) {
      const error = new Error('Tu usuario no tiene una tienda asignada');
      error.status = 403;
      throw error;
    }
  }

  static async authorizeSupervisor(data, user, locationId) {
    if (user?.role !== 'vendedor_tienda') return null;
    required(data, ['authorizerEmail', 'authorizerPassword']);

    const authorizer = await UserModel.getByEmail(data.authorizerEmail);
    if (!authorizer || !authorizer.estado) {
      const error = new Error('Usuario autorizador no valido');
      error.status = 403;
      throw error;
    }
    if (!isSupervisorForLocation(authorizer, locationId)) {
      const error = new Error('El usuario autorizador no tiene permisos para esta tienda');
      error.status = 403;
      throw error;
    }
    const match = await bcrypt.compare(String(data.authorizerPassword), authorizer.password);
    if (!match) {
      const error = new Error('Password de autorizacion invalido');
      error.status = 401;
      throw error;
    }
    return authorizer;
  }

  static async bootstrap(user) {
    const locationId = scopedLocationId(user);
    const [terminals, openShift, sellableItems, paymentMethods, customers, locations] = await Promise.all([
      PosModel.listTerminals(locationId),
      PosModel.getOpenShift(null, user?.id, locationId),
      InventoryModel.listSellableItems(locationId),
      InventoryModel.listPaymentMethods(),
      InventoryModel.listCustomers(),
      InventoryModel.listLocations(locationId),
    ]);
    return { terminals, openShift, sellableItems, paymentMethods, customers, locations };
  }

  static listTerminals(user) {
    return PosModel.listTerminals(scopedLocationId(user));
  }

  static createTerminal(data, user) {
    required(data, ['locationId', 'name', 'code']);
    PosService.ensureLocationScope(data.locationId, user);
    return PosModel.createTerminal(data);
  }

  static updateTerminal(id, data, user) {
    required(data, ['locationId', 'name', 'code']);
    PosService.ensureLocationScope(data.locationId, user);
    return PosModel.updateTerminal(id, data);
  }

  static getOpenShift(query, user) {
    return PosModel.getOpenShift(query.terminalId, query.mine === '1' ? user?.id : null, scopedLocationId(user));
  }

  static openShift(data, user) {
    required(data, ['terminalId']);
    return PosModel.openShift(data, user.id, scopedLocationId(user));
  }

  static async terminalScopeForSales(query, user) {
    const locationId = scopedLocationId(user);
    if (user?.role !== 'vendedor_tienda') {
      return query.terminalId || null;
    }
    const openShift = await PosModel.getOpenShift(null, user.id, locationId);
    return openShift?.terminalId || 0;
  }

  static async listSales(query, user) {
    const terminalId = await PosService.terminalScopeForSales(query, user);
    return PosModel.listSales({
      locationId: scopedLocationId(user),
      terminalId,
      shiftId: query.shiftId,
    });
  }

  static async dailySalesSummary(query, user) {
    const terminalId = await PosService.terminalScopeForSales(query, user);
    return PosModel.dailySalesSummary({
      locationId: scopedLocationId(user),
      terminalId,
      date: query.date,
    });
  }

  static getSale(id, user) {
    return PosModel.getSale(id, scopedLocationId(user));
  }

  static async getSalePdf(id, user) {
    const [receipt, company] = await Promise.all([
      PosModel.getSale(id, scopedLocationId(user)),
      CompanyProfileService.getProfile(),
    ]);
    const buffer = await PosReceiptPdfService.build({ receipt, company });
    const filename = `${receipt.sale.receiptFullNumber || `POS-${id}`}.pdf`;
    return { buffer, filename };
  }

  static async createSale(data, user) {
    required(data, ['shiftId']);
    const items = data.items || data.details || [];
    validateItems(items);
    validatePayments(data.payments);
    const customer = data.customerId ? await InventoryModel.getCustomer(data.customerId) : null;
    if (data.customerId && !customer) {
      const error = new Error('Cliente no encontrado');
      error.status = 404;
      throw error;
    }
    if (customer && !customer.estado) {
      const error = new Error('El cliente seleccionado esta deshabilitado');
      error.status = 400;
      throw error;
    }
    if (data.receiptType === 'factura') {
      if (!customer) {
        const error = new Error('Selecciona un cliente para emitir factura');
        error.status = 400;
        throw error;
      }
      if (String(customer.documentType || '').toUpperCase() !== 'RUC' || !/^\d{11}$/.test(String(customer.documentNumber || ''))) {
        const error = new Error('Para emitir factura el cliente debe tener un RUC valido de 11 digitos');
        error.status = 400;
        throw error;
      }
      if (!String(customer.address || '').trim()) {
        const error = new Error('Para emitir factura el cliente debe tener direccion fiscal');
        error.status = 400;
        throw error;
      }
    }
    return PosModel.createSale({
      ...data,
      items,
      customerNameSnapshot: customer?.name || null,
      customerPhone: data.customerPhone || customer?.phone || null,
      customerDocumentType: customer?.documentType || null,
      customerDocumentNumber: customer?.documentNumber || null,
      customerAddress: customer?.address || null,
    }, user.id, scopedLocationId(user));
  }

  static async createCashMovement(data, user) {
    required(data, ['shiftId', 'movementType', 'amount', 'reason']);
    if (!['income', 'expense', 'withdrawal', 'adjustment'].includes(data.movementType)) {
      const error = new Error('Tipo de movimiento de caja invalido');
      error.status = 400;
      throw error;
    }
    const locationId = scopedLocationId(user);
    const shift = await PosModel.getShift(data.shiftId, locationId);
    const approvalRequired = ['withdrawal', 'expense', 'adjustment'].includes(data.movementType);
    const authorizer = approvalRequired ? await PosService.authorizeSupervisor(data, user, shift.locationId) : null;
    return PosModel.createCashMovement({ ...data, authorizedByUserId: authorizer?.id || null }, user.id, locationId);
  }

  static listCashMovements(shiftId, user) {
    return PosModel.listCashMovements(shiftId, scopedLocationId(user));
  }

  static async closeShift(id, data, user) {
    required(data, ['countedCash']);
    const locationId = scopedLocationId(user);
    const shift = await PosModel.getShift(id, locationId);
    const authorizer = await PosService.authorizeSupervisor(data, user, shift.locationId);
    return PosModel.closeShift(id, { ...data, authorizedByUserId: authorizer?.id || null }, user.id, locationId);
  }
}

module.exports = PosService;
