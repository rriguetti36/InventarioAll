const { poolPromise, sql } = require('../config/db');
const InventoryModel = require('./InventoryModel');

function nullableInt(value) {
  return value === undefined || value === null || value === '' ? null : Number(value);
}

function decimal(value, fallback = 0) {
  return value === undefined || value === null || value === '' ? fallback : Number(value);
}

function text(value) {
  return value === undefined || value === null || value === '' ? null : String(value);
}

function bit(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return Number(value) === 1 ? 1 : 0;
}

function isServiceType(value) {
  return String(value || '').toLowerCase() === 'servicio';
}

function isCashMethod(methodName) {
  return ['efectivo', 'contado', 'cash'].some((term) => String(methodName || '').toLowerCase().includes(term));
}

function peruDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function defaultReceiptSeries(receiptType) {
  if (receiptType === 'factura') return 'F001';
  if (receiptType === 'boleta') return 'B001';
  return 'T001';
}

function taxableLine(quantity, unitPrice, discountAmount, affectsTax) {
  const gross = Number(quantity || 0) * Number(unitPrice || 0);
  const total = Math.max(0, gross - Number(discountAmount || 0));
  if (!bit(affectsTax)) {
    return { subtotal: total, taxAmount: 0, total };
  }
  const subtotal = total / 1.18;
  return { subtotal, taxAmount: total - subtotal, total };
}

async function getProductTypes(transaction, details) {
  return InventoryModel.productTypeMap(transaction, details);
}

class PosModel {
  static async listTerminals(locationId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
        SELECT t.*, l.name AS locationName, pm.name AS defaultPaymentMethodName
        FROM PosTerminals t
        INNER JOIN InventoryLocations l ON l.id = t.locationId
        LEFT JOIN PaymentMethods pm ON pm.id = t.defaultPaymentMethodId
        WHERE (@locationId IS NULL OR t.locationId = @locationId)
        ORDER BY l.name, t.name
      `);
    return result.recordset;
  }

  static async createTerminal(data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('locationId', sql.Int, Number(data.locationId))
      .input('name', sql.NVarChar(120), data.name)
      .input('code', sql.NVarChar(50), data.code)
      .input('receiptSeries', sql.NVarChar(10), text(data.receiptSeries))
      .input('defaultPaymentMethodId', sql.Int, nullableInt(data.defaultPaymentMethodId))
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        INSERT INTO PosTerminals (locationId, name, code, receiptSeries, defaultPaymentMethodId, estado)
        OUTPUT INSERTED.*
        VALUES (@locationId, @name, @code, @receiptSeries, @defaultPaymentMethodId, @estado)
      `);
    return result.recordset[0];
  }

  static async updateTerminal(id, data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, Number(id))
      .input('locationId', sql.Int, Number(data.locationId))
      .input('name', sql.NVarChar(120), data.name)
      .input('code', sql.NVarChar(50), data.code)
      .input('receiptSeries', sql.NVarChar(10), text(data.receiptSeries))
      .input('defaultPaymentMethodId', sql.Int, nullableInt(data.defaultPaymentMethodId))
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        UPDATE PosTerminals
        SET locationId = @locationId,
            name = @name,
            code = @code,
            receiptSeries = @receiptSeries,
            defaultPaymentMethodId = @defaultPaymentMethodId,
            estado = @estado,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @id;

        SELECT * FROM PosTerminals WHERE id = @id;
      `);
    return result.recordset[0];
  }

  static async getOpenShift(terminalId = null, userId = null, locationId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('terminalId', sql.Int, nullableInt(terminalId))
      .input('userId', sql.Int, nullableInt(userId))
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
        SELECT TOP 1 s.*, t.name AS terminalName, t.code AS terminalCode, l.name AS locationName,
               u.name AS openedByName
        FROM PosShifts s
        INNER JOIN PosTerminals t ON t.id = s.terminalId
        INNER JOIN InventoryLocations l ON l.id = s.locationId
        INNER JOIN Users u ON u.id = s.openedByUserId
        WHERE s.status = 'open'
          AND (@terminalId IS NULL OR s.terminalId = @terminalId)
          AND (@userId IS NULL OR s.openedByUserId = @userId)
          AND (@locationId IS NULL OR s.locationId = @locationId)
        ORDER BY s.openedAt DESC
      `);
    return result.recordset[0] || null;
  }

  static async getShift(id, expectedLocationId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('shiftId', sql.Int, Number(id))
      .input('locationId', sql.Int, nullableInt(expectedLocationId))
      .query(`
        SELECT s.*, t.name AS terminalName, t.code AS terminalCode, l.name AS locationName
        FROM PosShifts s
        INNER JOIN PosTerminals t ON t.id = s.terminalId
        INNER JOIN InventoryLocations l ON l.id = s.locationId
        WHERE s.id = @shiftId
          AND (@locationId IS NULL OR s.locationId = @locationId)
      `);
    const shift = result.recordset[0];
    if (!shift) {
      const error = new Error('Turno POS no encontrado');
      error.status = 404;
      throw error;
    }
    return shift;
  }

  static async openShift(data, userId, expectedLocationId = null) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const terminalResult = await new sql.Request(transaction)
        .input('terminalId', sql.Int, Number(data.terminalId))
        .query('SELECT * FROM PosTerminals WHERE id = @terminalId AND estado = 1');
      const terminal = terminalResult.recordset[0];
      if (!terminal) {
        const error = new Error('Terminal POS no encontrada');
        error.status = 404;
        throw error;
      }
      if (expectedLocationId && Number(terminal.locationId) !== Number(expectedLocationId)) {
        const error = new Error('Solo puedes operar con la tienda asignada');
        error.status = 403;
        throw error;
      }

      const openResult = await new sql.Request(transaction)
        .input('terminalId', sql.Int, terminal.id)
        .query("SELECT TOP 1 id FROM PosShifts WHERE terminalId = @terminalId AND status = 'open'");
      if (openResult.recordset[0]) {
        const error = new Error('Esta terminal ya tiene un turno abierto');
        error.status = 400;
        throw error;
      }

      const shiftResult = await new sql.Request(transaction)
        .input('terminalId', sql.Int, terminal.id)
        .input('locationId', sql.Int, terminal.locationId)
        .input('openedByUserId', sql.Int, Number(userId))
        .input('openingCash', sql.Decimal(18, 2), decimal(data.openingCash))
        .input('notes', sql.NVarChar(500), text(data.notes))
        .query(`
          INSERT INTO PosShifts (terminalId, locationId, openedByUserId, openingCash, expectedCash, notes)
          OUTPUT INSERTED.*
          VALUES (@terminalId, @locationId, @openedByUserId, @openingCash, @openingCash, @notes)
        `);
      const shift = shiftResult.recordset[0];

      await new sql.Request(transaction)
        .input('shiftId', sql.Int, shift.id)
        .input('userId', sql.Int, Number(userId))
        .input('amount', sql.Decimal(18, 2), decimal(data.openingCash))
        .query(`
          INSERT INTO PosCashMovements (shiftId, userId, movementType, amount, reason, referenceType, referenceId)
          VALUES (@shiftId, @userId, 'opening', @amount, 'Apertura de caja', 'pos_shift', @shiftId)
        `);

      await transaction.commit();
      return shift;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async listSales(filters = {}) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('locationId', sql.Int, nullableInt(filters.locationId))
      .input('terminalId', sql.Int, nullableInt(filters.terminalId))
      .input('shiftId', sql.Int, nullableInt(filters.shiftId))
      .query(`
        SELECT s.*, t.name AS terminalName, l.name AS locationName,
               COALESCE(s.customerNameSnapshot, c.name) AS customerName,
               COALESCE(s.customerPhone, c.phone) AS customerPhone,
               u.name AS sellerName,
               pay.methodName AS paymentMethodName,
               pay.referenceNumber AS paymentReferenceNumber,
               pay.voucherImageUrl AS paymentVoucherImageUrl
        FROM PosSales s
        INNER JOIN PosTerminals t ON t.id = s.terminalId
        INNER JOIN InventoryLocations l ON l.id = s.locationId
        LEFT JOIN Customers c ON c.id = s.customerId
        INNER JOIN Users u ON u.id = s.sellerId
        OUTER APPLY (
          SELECT TOP 1 methodName, referenceNumber, voucherImageUrl
          FROM PosSalePayments
          WHERE saleId = s.id
          ORDER BY id
        ) pay
        WHERE (@locationId IS NULL OR s.locationId = @locationId)
          AND (@terminalId IS NULL OR s.terminalId = @terminalId)
          AND (@shiftId IS NULL OR s.shiftId = @shiftId)
        ORDER BY s.saleDate DESC, s.id DESC
      `);
    return result.recordset;
  }

  static async dailySalesSummary(filters = {}) {
    const pool = await poolPromise;
    const businessDate = filters.date || peruDate();
    const baseRequest = () => pool.request()
      .input('locationId', sql.Int, nullableInt(filters.locationId))
      .input('terminalId', sql.Int, nullableInt(filters.terminalId))
      .input('businessDate', sql.Date, businessDate);

    const totalsResult = await baseRequest().query(`
      SELECT
        COUNT(1) AS saleCount,
        ISNULL(SUM(s.total), 0) AS total,
        ISNULL(SUM(s.paidTotal), 0) AS paidTotal,
        ISNULL(SUM(s.changeAmount), 0) AS changeTotal
      FROM PosSales s
      WHERE s.status IN ('paid', 'partial_refund')
        AND CONVERT(date, DATEADD(hour, -5, s.saleDate)) = @businessDate
        AND (@locationId IS NULL OR s.locationId = @locationId)
        AND (@terminalId IS NULL OR s.terminalId = @terminalId)
    `);

    const terminalsResult = await baseRequest().query(`
      SELECT
        t.id AS terminalId,
        t.name AS terminalName,
        t.code AS terminalCode,
        l.name AS locationName,
        COUNT(s.id) AS saleCount,
        ISNULL(SUM(s.total), 0) AS total,
        ISNULL(SUM(s.paidTotal), 0) AS paidTotal,
        ISNULL(SUM(s.changeAmount), 0) AS changeTotal
      FROM PosSales s
      INNER JOIN PosTerminals t ON t.id = s.terminalId
      INNER JOIN InventoryLocations l ON l.id = s.locationId
      WHERE s.status IN ('paid', 'partial_refund')
        AND CONVERT(date, DATEADD(hour, -5, s.saleDate)) = @businessDate
        AND (@locationId IS NULL OR s.locationId = @locationId)
        AND (@terminalId IS NULL OR s.terminalId = @terminalId)
      GROUP BY t.id, t.name, t.code, l.name
      ORDER BY l.name, t.name
    `);

    const paymentsResult = await baseRequest().query(`
      SELECT
        s.terminalId,
        p.methodName,
        COUNT(DISTINCT s.id) AS saleCount,
        ISNULL(SUM(p.amount), 0) AS amount
      FROM PosSalePayments p
      INNER JOIN PosSales s ON s.id = p.saleId
      WHERE s.status IN ('paid', 'partial_refund')
        AND CONVERT(date, DATEADD(hour, -5, s.saleDate)) = @businessDate
        AND (@locationId IS NULL OR s.locationId = @locationId)
        AND (@terminalId IS NULL OR s.terminalId = @terminalId)
      GROUP BY s.terminalId, p.methodName
      ORDER BY s.terminalId, p.methodName
    `);

    const terminals = terminalsResult.recordset.map((terminal) => ({
      ...terminal,
      payments: paymentsResult.recordset.filter((payment) => Number(payment.terminalId) === Number(terminal.terminalId)),
    }));

    return {
      date: businessDate,
      totals: totalsResult.recordset[0] || { saleCount: 0, total: 0, paidTotal: 0, changeTotal: 0 },
      terminals,
      payments: paymentsResult.recordset,
    };
  }

  static async getSale(id, locationId = null) {
    const pool = await poolPromise;
    const saleResult = await pool.request()
      .input('id', sql.Int, Number(id))
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
        SELECT s.*, t.name AS terminalName, l.name AS locationName,
               COALESCE(s.customerNameSnapshot, c.name) AS customerName,
               COALESCE(s.customerPhone, c.phone) AS customerPhone,
               u.name AS sellerName
        FROM PosSales s
        INNER JOIN PosTerminals t ON t.id = s.terminalId
        INNER JOIN InventoryLocations l ON l.id = s.locationId
        LEFT JOIN Customers c ON c.id = s.customerId
        INNER JOIN Users u ON u.id = s.sellerId
        WHERE s.id = @id AND (@locationId IS NULL OR s.locationId = @locationId)
      `);
    const sale = saleResult.recordset[0];
    if (!sale) {
      const error = new Error('Venta POS no encontrada');
      error.status = 404;
      throw error;
    }

    const itemsResult = await pool.request()
      .input('saleId', sql.Int, Number(id))
      .query(`
        SELECT i.*, p.sku AS productSku, v.sku AS variantSku, v.displayName AS variantName
        FROM PosSaleItems i
        INNER JOIN Products p ON p.id = i.productId
        LEFT JOIN ProductVariants v ON v.id = i.variantId
        WHERE i.saleId = @saleId
        ORDER BY i.id
      `);
    const paymentsResult = await pool.request()
      .input('saleId', sql.Int, Number(id))
      .query('SELECT * FROM PosSalePayments WHERE saleId = @saleId ORDER BY id');

    return { sale, items: itemsResult.recordset, payments: paymentsResult.recordset };
  }

  static async nextReceipt(transaction, locationId, receiptType, requestedSeries) {
    const series = requestedSeries || defaultReceiptSeries(receiptType);
    const sequenceResult = await new sql.Request(transaction)
      .input('locationId', sql.Int, Number(locationId))
      .input('documentType', sql.NVarChar(20), receiptType)
      .input('series', sql.NVarChar(10), series)
      .query(`
        MERGE PosReceiptSequences AS target
        USING (
          SELECT @locationId AS locationId,
                 @documentType AS documentType,
                 @series AS series,
                 ISNULL((
                   SELECT MAX(receiptNumber)
                   FROM PosSales
                   WHERE locationId = @locationId
                     AND receiptType = @documentType
                     AND receiptSeries = @series
                 ), 0) AS lastNumber
        ) AS source
        ON target.locationId = source.locationId AND target.documentType = source.documentType AND target.series = source.series
        WHEN MATCHED THEN
          UPDATE SET currentNumber = CASE
              WHEN target.currentNumber < source.lastNumber THEN source.lastNumber + 1
              ELSE target.currentNumber + 1
            END,
            updatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (locationId, documentType, series, currentNumber)
          VALUES (@locationId, @documentType, @series, source.lastNumber + 1)
        OUTPUT INSERTED.currentNumber;
      `);
    const number = Number(sequenceResult.recordset[0].currentNumber);
    return {
      series,
      number,
      fullNumber: `${series}-${String(number).padStart(8, '0')}`,
    };
  }

  static async insertInventoryMovement(transaction, item, locationId, movementType, quantity, sourceType, sourceId, notes) {
    const result = await new sql.Request(transaction)
      .input('productId', sql.Int, Number(item.productId))
      .input('variantId', sql.Int, nullableInt(item.variantId))
      .input('locationId', sql.Int, Number(locationId))
      .input('shelfId', sql.Int, nullableInt(item.shelfId))
      .input('movementType', sql.NVarChar(20), movementType)
      .input('quantity', sql.Decimal(18, 2), quantity)
      .input('sourceType', sql.NVarChar(30), sourceType)
      .input('sourceId', sql.Int, Number(sourceId))
      .input('notes', sql.NVarChar(500), text(notes))
      .query(`
        INSERT INTO InventoryMovements (productId, variantId, locationId, shelfId, movementType, quantity, sourceType, sourceId, notes)
        OUTPUT INSERTED.id
        VALUES (@productId, @variantId, @locationId, @shelfId, @movementType, @quantity, @sourceType, @sourceId, @notes)
      `);
    return result.recordset[0].id;
  }

  static async inventorySalesEnabled(transaction) {
    const result = await new sql.Request(transaction).query(`
      SELECT
        CASE WHEN OBJECT_ID('dbo.SaleHeaders', 'U') IS NOT NULL
               AND OBJECT_ID('dbo.SaleDetails', 'U') IS NOT NULL
             THEN 1 ELSE 0 END AS enabled
    `);
    return Number(result.recordset[0]?.enabled || 0) === 1;
  }

  static async createInventorySaleMirror(transaction, sale, details, data, userId) {
    if (!(await PosModel.inventorySalesEnabled(transaction))) return null;

    const existingResult = await new sql.Request(transaction)
      .input('sourceModule', sql.NVarChar(30), 'pos')
      .input('sourceId', sql.Int, sale.id)
      .query('SELECT TOP 1 id FROM SaleHeaders WHERE sourceModule = @sourceModule AND sourceId = @sourceId');
    if (existingResult.recordset[0]) return existingResult.recordset[0].id;

    const customerName = text(data.customerNameSnapshot || data.customerName) || 'Cliente varios';
    const saleHeaderResult = await new sql.Request(transaction)
      .input('customerName', sql.NVarChar(150), customerName)
      .input('customerId', sql.Int, nullableInt(data.customerId))
      .input('sellerId', sql.Int, Number(userId))
      .input('locationId', sql.Int, sale.locationId)
      .input('documentNumber', sql.NVarChar(80), sale.receiptFullNumber || null)
      .input('saleDate', sql.Date, peruDate())
      .input('notes', sql.NVarChar(500), text(data.notes || `Venta POS ${sale.receiptFullNumber || sale.id}`))
      .input('subtotal', sql.Decimal(18, 2), decimal(sale.subtotal))
      .input('taxTotal', sql.Decimal(18, 2), decimal(sale.taxTotal))
      .input('total', sql.Decimal(18, 2), decimal(sale.total))
      .input('sourceModule', sql.NVarChar(30), 'pos')
      .input('sourceId', sql.Int, sale.id)
      .input('sourceReference', sql.NVarChar(80), sale.receiptFullNumber || null)
      .query(`
        INSERT INTO SaleHeaders
          (customerName, customerId, sellerId, saleType, status, locationId, documentNumber, saleDate, notes,
           subtotal, taxTotal, total, sourceModule, sourceId, sourceReference)
        OUTPUT INSERTED.*
        VALUES
          (@customerName, @customerId, @sellerId, 'pos', 'cerrada', @locationId, @documentNumber, @saleDate, @notes,
           @subtotal, @taxTotal, @total, @sourceModule, @sourceId, @sourceReference)
      `);
    const inventorySale = saleHeaderResult.recordset[0];

    for (const item of details) {
      const quantity = Number(item.quantity || 0);
      const line = taxableLine(item.quantity, item.unitPrice, item.discountAmount, item.affectsTax);
      const effectiveUnitPrice = quantity > 0 ? line.total / quantity : Number(item.unitPrice || 0);
      await new sql.Request(transaction)
        .input('saleId', sql.Int, inventorySale.id)
        .input('productId', sql.Int, Number(item.productId))
        .input('variantId', sql.Int, nullableInt(item.variantId))
        .input('productDescription', sql.NVarChar(500), item.productDescription || item.displayName || item.name)
        .input('detailNotes', sql.NVarChar(sql.MAX), text(item.detailNotes))
        .input('unit', sql.NVarChar(30), item.unit || 'unidad')
        .input('quantity', sql.Decimal(18, 2), quantity)
        .input('listPrice', sql.Decimal(18, 2), decimal(item.unitPrice))
        .input('unitPrice', sql.Decimal(18, 2), effectiveUnitPrice)
        .input('affectsTax', sql.Bit, bit(item.affectsTax))
        .input('taxRate', sql.Decimal(5, 2), 18)
        .input('subtotal', sql.Decimal(18, 2), line.subtotal)
        .input('taxAmount', sql.Decimal(18, 2), line.taxAmount)
        .input('total', sql.Decimal(18, 2), line.total)
        .query(`
          INSERT INTO SaleDetails
            (saleId, productId, variantId, productDescription, detailNotes, unit, quantity,
             listPrice, unitPrice, affectsTax, taxRate, subtotal, taxAmount, total)
          VALUES
            (@saleId, @productId, @variantId, @productDescription, @detailNotes, @unit, @quantity,
             @listPrice, @unitPrice, @affectsTax, @taxRate, @subtotal, @taxAmount, @total)
        `);
    }

    const documentsResult = await new sql.Request(transaction).query("SELECT CASE WHEN OBJECT_ID('dbo.SaleDocuments', 'U') IS NOT NULL THEN 1 ELSE 0 END AS enabled");
    const documentsEnabled = Number(documentsResult.recordset[0]?.enabled || 0) === 1;

    if (documentsEnabled && ['boleta', 'factura'].includes(sale.receiptType)) {
      await new sql.Request(transaction)
        .input('saleId', sql.Int, inventorySale.id)
        .input('documentType', sql.NVarChar(20), sale.receiptType)
        .input('series', sql.NVarChar(10), sale.receiptSeries)
        .input('documentNumber', sql.Int, sale.receiptNumber)
        .input('fullNumber', sql.NVarChar(30), sale.receiptFullNumber)
        .input('issueDate', sql.Date, peruDate())
        .input('currency', sql.NVarChar(10), sale.currency || 'PEN')
        .input('customerName', sql.NVarChar(180), customerName)
        .input('subtotal', sql.Decimal(18, 2), decimal(sale.subtotal))
        .input('taxTotal', sql.Decimal(18, 2), decimal(sale.taxTotal))
        .input('total', sql.Decimal(18, 2), decimal(sale.total))
        .query(`
          IF NOT EXISTS (SELECT 1 FROM SaleDocuments WHERE fullNumber = @fullNumber)
          BEGIN
            INSERT INTO SaleDocuments
              (saleId, documentType, series, documentNumber, fullNumber, issueDate, currency,
               customerName, subtotal, taxTotal, total)
            VALUES
              (@saleId, @documentType, @series, @documentNumber, @fullNumber, @issueDate, @currency,
               @customerName, @subtotal, @taxTotal, @total)
          END
        `);
    }

    return inventorySale.id;
  }

  static async createSale(data, userId, expectedLocationId = null) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const shiftResult = await new sql.Request(transaction)
        .input('shiftId', sql.Int, Number(data.shiftId))
        .query(`
          SELECT s.*, t.receiptSeries
          FROM PosShifts s
          INNER JOIN PosTerminals t ON t.id = s.terminalId
          WHERE s.id = @shiftId AND s.status = 'open'
        `);
      const shift = shiftResult.recordset[0];
      if (!shift) {
        const error = new Error('Debes tener un turno POS abierto');
        error.status = 400;
        throw error;
      }
      if (expectedLocationId && Number(shift.locationId) !== Number(expectedLocationId)) {
        const error = new Error('Solo puedes operar con la tienda asignada');
        error.status = 403;
        throw error;
      }

      const details = data.items || data.details || [];
      const payments = data.payments || [];
      const productTypes = await getProductTypes(transaction, details);

      for (const item of details) {
        if (isServiceType(productTypes.get(Number(item.productId)))) continue;
        const stock = await InventoryModel.getStock(
          transaction,
          item.productId,
          item.variantId,
          shift.locationId,
          nullableInt(item.shelfId),
        );
        if (Number(stock) < Number(item.quantity)) {
          const error = new Error(`Stock insuficiente para ${item.productDescription || 'un producto'}`);
          error.status = 400;
          throw error;
        }
      }

      const totals = details.reduce((acc, item) => {
        const line = taxableLine(item.quantity, item.unitPrice, item.discountAmount, item.affectsTax);
        return {
          subtotal: acc.subtotal + line.subtotal,
          discountTotal: acc.discountTotal + Number(item.discountAmount || 0),
          taxTotal: acc.taxTotal + line.taxAmount,
          total: acc.total + line.total,
        };
      }, { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 });
      const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      if (paidTotal < totals.total) {
        const error = new Error('El pago no cubre el total de la venta');
        error.status = 400;
        throw error;
      }

      const receiptType = data.receiptType || 'boleta';
      const requestedSeries = data.receiptSeries || (receiptType === 'ticket' ? shift.receiptSeries : null);
      const receipt = await PosModel.nextReceipt(transaction, shift.locationId, receiptType, requestedSeries);
      const saleResult = await new sql.Request(transaction)
        .input('shiftId', sql.Int, shift.id)
        .input('terminalId', sql.Int, shift.terminalId)
        .input('locationId', sql.Int, shift.locationId)
        .input('customerId', sql.Int, nullableInt(data.customerId))
        .input('customerNameSnapshot', sql.NVarChar(180), text(data.customerNameSnapshot || data.customerName))
        .input('customerPhone', sql.NVarChar(50), text(data.customerPhone))
        .input('sellerId', sql.Int, Number(userId))
        .input('receiptType', sql.NVarChar(20), receiptType)
        .input('receiptSeries', sql.NVarChar(10), receipt.series)
        .input('receiptNumber', sql.Int, receipt.number)
        .input('receiptFullNumber', sql.NVarChar(30), receipt.fullNumber)
        .input('currency', sql.NVarChar(10), data.currency || 'PEN')
        .input('subtotal', sql.Decimal(18, 2), totals.subtotal)
        .input('discountTotal', sql.Decimal(18, 2), totals.discountTotal)
        .input('taxTotal', sql.Decimal(18, 2), totals.taxTotal)
        .input('total', sql.Decimal(18, 2), totals.total)
        .input('paidTotal', sql.Decimal(18, 2), paidTotal)
        .input('changeAmount', sql.Decimal(18, 2), Math.max(0, paidTotal - totals.total))
        .input('notes', sql.NVarChar(500), text(data.notes))
        .query(`
          INSERT INTO PosSales
            (shiftId, terminalId, locationId, customerId, customerNameSnapshot, customerPhone, sellerId, receiptType, receiptSeries, receiptNumber,
             receiptFullNumber, currency, subtotal, discountTotal, taxTotal, total, paidTotal, changeAmount, notes)
          OUTPUT INSERTED.*
          VALUES
            (@shiftId, @terminalId, @locationId, @customerId, @customerNameSnapshot, @customerPhone, @sellerId, @receiptType, @receiptSeries, @receiptNumber,
             @receiptFullNumber, @currency, @subtotal, @discountTotal, @taxTotal, @total, @paidTotal, @changeAmount, @notes)
        `);
      const sale = saleResult.recordset[0];

      for (const item of details) {
        const line = taxableLine(item.quantity, item.unitPrice, item.discountAmount, item.affectsTax);
        let movementId = null;
        if (!isServiceType(productTypes.get(Number(item.productId)))) {
          await InventoryModel.addStock(transaction, item.productId, item.variantId, shift.locationId, nullableInt(item.shelfId), Number(item.quantity) * -1);
          movementId = await PosModel.insertInventoryMovement(transaction, item, shift.locationId, 'salida', Number(item.quantity), 'pos_sale', sale.id, data.notes || null);
        }

        await new sql.Request(transaction)
          .input('saleId', sql.Int, sale.id)
          .input('productId', sql.Int, Number(item.productId))
          .input('variantId', sql.Int, nullableInt(item.variantId))
          .input('productDescription', sql.NVarChar(500), item.productDescription || item.displayName || item.name)
          .input('unit', sql.NVarChar(30), item.unit || 'unidad')
          .input('quantity', sql.Decimal(18, 2), Number(item.quantity))
          .input('unitPrice', sql.Decimal(18, 2), decimal(item.unitPrice))
          .input('discountAmount', sql.Decimal(18, 2), decimal(item.discountAmount))
          .input('affectsTax', sql.Bit, bit(item.affectsTax))
          .input('taxRate', sql.Decimal(5, 2), 18)
          .input('subtotal', sql.Decimal(18, 2), line.subtotal)
          .input('taxAmount', sql.Decimal(18, 2), line.taxAmount)
          .input('total', sql.Decimal(18, 2), line.total)
          .input('inventoryMovementId', sql.Int, movementId)
          .query(`
            INSERT INTO PosSaleItems
              (saleId, productId, variantId, productDescription, unit, quantity, unitPrice, discountAmount,
               affectsTax, taxRate, subtotal, taxAmount, total, inventoryMovementId)
            VALUES
              (@saleId, @productId, @variantId, @productDescription, @unit, @quantity, @unitPrice, @discountAmount,
               @affectsTax, @taxRate, @subtotal, @taxAmount, @total, @inventoryMovementId)
          `);
      }

      const inventorySaleId = await PosModel.createInventorySaleMirror(transaction, sale, details, data, userId);
      if (inventorySaleId) {
        await new sql.Request(transaction)
          .input('posSaleId', sql.Int, sale.id)
          .input('inventorySaleId', sql.Int, inventorySaleId)
          .query('UPDATE PosSales SET inventorySaleId = @inventorySaleId, updatedAt = SYSUTCDATETIME() WHERE id = @posSaleId');
      }

      for (const payment of payments) {
        const methodName = payment.methodName || payment.name || 'Pago';
        const amount = Number(payment.amount || 0);
        await new sql.Request(transaction)
          .input('saleId', sql.Int, sale.id)
          .input('paymentMethodId', sql.Int, nullableInt(payment.paymentMethodId))
          .input('methodName', sql.NVarChar(120), methodName)
          .input('amount', sql.Decimal(18, 2), amount)
          .input('referenceNumber', sql.NVarChar(120), text(payment.referenceNumber))
          .input('voucherImageUrl', sql.NVarChar(500), text(payment.voucherImageUrl))
          .query(`
            INSERT INTO PosSalePayments (saleId, paymentMethodId, methodName, amount, referenceNumber, voucherImageUrl)
            VALUES (@saleId, @paymentMethodId, @methodName, @amount, @referenceNumber, @voucherImageUrl)
          `);

        if (isCashMethod(methodName)) {
          await new sql.Request(transaction)
            .input('shiftId', sql.Int, shift.id)
            .input('userId', sql.Int, Number(userId))
            .input('amount', sql.Decimal(18, 2), amount - Math.max(0, paidTotal - totals.total))
            .input('reason', sql.NVarChar(250), `Venta ${sale.receiptFullNumber}`)
            .input('referenceId', sql.Int, sale.id)
            .query(`
              INSERT INTO PosCashMovements (shiftId, userId, movementType, amount, reason, referenceType, referenceId)
              VALUES (@shiftId, @userId, 'income', @amount, @reason, 'pos_sale', @referenceId)
            `);
        }
      }

      await transaction.commit();
      return PosModel.getSale(sale.id);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async createCashMovement(data, userId, expectedLocationId = null) {
    const pool = await poolPromise;
    if (expectedLocationId) {
      const shiftResult = await pool.request()
        .input('shiftId', sql.Int, Number(data.shiftId))
        .input('locationId', sql.Int, Number(expectedLocationId))
        .query('SELECT id FROM PosShifts WHERE id = @shiftId AND locationId = @locationId');
      if (!shiftResult.recordset[0]) {
        const error = new Error('Solo puedes operar con la tienda asignada');
        error.status = 403;
        throw error;
      }
    }
    const result = await pool.request()
      .input('shiftId', sql.Int, Number(data.shiftId))
      .input('userId', sql.Int, Number(userId))
      .input('movementType', sql.NVarChar(20), data.movementType)
      .input('amount', sql.Decimal(18, 2), decimal(data.amount))
      .input('reason', sql.NVarChar(250), data.reason)
      .input('authorizedByUserId', sql.Int, nullableInt(data.authorizedByUserId))
      .query(`
        INSERT INTO PosCashMovements
          (shiftId, userId, movementType, amount, reason, referenceType, authorizedByUserId, authorizedAt)
        OUTPUT INSERTED.*
        VALUES
          (@shiftId, @userId, @movementType, @amount, @reason, 'manual',
           @authorizedByUserId, CASE WHEN @authorizedByUserId IS NULL THEN NULL ELSE SYSUTCDATETIME() END)
      `);
    return result.recordset[0];
  }

  static async listCashMovements(shiftId, expectedLocationId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('shiftId', sql.Int, Number(shiftId))
      .input('locationId', sql.Int, nullableInt(expectedLocationId))
      .query(`
        SELECT m.*, u.name AS userName, au.name AS authorizedByName
        FROM PosCashMovements m
        INNER JOIN Users u ON u.id = m.userId
        LEFT JOIN Users au ON au.id = m.authorizedByUserId
        INNER JOIN PosShifts s ON s.id = m.shiftId
        WHERE m.shiftId = @shiftId
          AND (@locationId IS NULL OR s.locationId = @locationId)
        ORDER BY m.createdAt DESC, m.id DESC
      `);
    return result.recordset;
  }

  static async buildClosureSummary(transaction, shiftId) {
    const result = await new sql.Request(transaction)
      .input('shiftId', sql.Int, Number(shiftId))
      .query(`
        SELECT
          ISNULL(SUM(CASE WHEN s.status IN ('paid', 'partial_refund') THEN s.total ELSE 0 END), 0) AS grossSales,
          ISNULL(SUM(CASE WHEN s.status IN ('paid', 'partial_refund') THEN s.discountTotal ELSE 0 END), 0) AS discounts,
          ISNULL((SELECT SUM(refundAmount) FROM PosReturns WHERE shiftId = @shiftId AND status = 'completed'), 0) AS refunds,
          ISNULL(SUM(CASE WHEN s.status IN ('paid', 'partial_refund') THEN s.total ELSE 0 END), 0)
            - ISNULL((SELECT SUM(refundAmount) FROM PosReturns WHERE shiftId = @shiftId AND status = 'completed'), 0) AS netSales,
          ISNULL((
            SELECT SUM(p.amount)
            FROM PosSalePayments p
            INNER JOIN PosSales ps ON ps.id = p.saleId
            WHERE ps.shiftId = @shiftId AND ps.status IN ('paid', 'partial_refund')
              AND (LOWER(p.methodName) LIKE '%efectivo%' OR LOWER(p.methodName) LIKE '%contado%' OR LOWER(p.methodName) LIKE '%cash%')
          ), 0) AS cashSales,
          ISNULL((
            SELECT SUM(p.amount)
            FROM PosSalePayments p
            INNER JOIN PosSales ps ON ps.id = p.saleId
            WHERE ps.shiftId = @shiftId AND ps.status IN ('paid', 'partial_refund')
              AND NOT (LOWER(p.methodName) LIKE '%efectivo%' OR LOWER(p.methodName) LIKE '%contado%' OR LOWER(p.methodName) LIKE '%cash%')
          ), 0) AS nonCashSales,
          ISNULL((SELECT SUM(amount) FROM PosCashMovements WHERE shiftId = @shiftId AND movementType IN ('income', 'adjustment') AND referenceType = 'manual'), 0) AS manualIncome,
          ISNULL((SELECT SUM(amount) FROM PosCashMovements WHERE shiftId = @shiftId AND movementType IN ('expense', 'withdrawal')), 0) AS manualExpense
        FROM PosSales s
        WHERE s.shiftId = @shiftId
      `);
    return result.recordset[0];
  }

  static async closeShift(id, data, userId, expectedLocationId = null) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const shiftResult = await new sql.Request(transaction)
        .input('shiftId', sql.Int, Number(id))
        .query("SELECT * FROM PosShifts WHERE id = @shiftId AND status = 'open'");
      const shift = shiftResult.recordset[0];
      if (!shift) {
        const error = new Error('Turno abierto no encontrado');
        error.status = 404;
        throw error;
      }
      if (expectedLocationId && Number(shift.locationId) !== Number(expectedLocationId)) {
        const error = new Error('Solo puedes operar con la tienda asignada');
        error.status = 403;
        throw error;
      }

      const summary = await PosModel.buildClosureSummary(transaction, id);
      const countedCash = decimal(data.countedCash);
      const expectedCash = Number(shift.openingCash || 0) + Number(summary.cashSales || 0) + Number(summary.manualIncome || 0) - Number(summary.manualExpense || 0) - Number(summary.refunds || 0);
      const cashDifference = countedCash - expectedCash;

      const closureResult = await new sql.Request(transaction)
        .input('shiftId', sql.Int, Number(id))
        .input('closedByUserId', sql.Int, Number(userId))
        .input('grossSales', sql.Decimal(18, 2), decimal(summary.grossSales))
        .input('discounts', sql.Decimal(18, 2), decimal(summary.discounts))
        .input('refunds', sql.Decimal(18, 2), decimal(summary.refunds))
        .input('netSales', sql.Decimal(18, 2), decimal(summary.netSales))
        .input('cashSales', sql.Decimal(18, 2), decimal(summary.cashSales))
        .input('nonCashSales', sql.Decimal(18, 2), decimal(summary.nonCashSales))
        .input('manualIncome', sql.Decimal(18, 2), decimal(summary.manualIncome))
        .input('manualExpense', sql.Decimal(18, 2), decimal(summary.manualExpense))
        .input('expectedCash', sql.Decimal(18, 2), expectedCash)
        .input('countedCash', sql.Decimal(18, 2), countedCash)
        .input('cashDifference', sql.Decimal(18, 2), cashDifference)
        .input('notes', sql.NVarChar(500), text(data.notes))
        .input('authorizedByUserId', sql.Int, nullableInt(data.authorizedByUserId))
        .query(`
          INSERT INTO PosShiftClosures
            (shiftId, closedByUserId, grossSales, discounts, refunds, netSales, cashSales, nonCashSales,
             manualIncome, manualExpense, expectedCash, countedCash, cashDifference, notes, authorizedByUserId, authorizedAt)
          OUTPUT INSERTED.*
          VALUES
            (@shiftId, @closedByUserId, @grossSales, @discounts, @refunds, @netSales, @cashSales, @nonCashSales,
             @manualIncome, @manualExpense, @expectedCash, @countedCash, @cashDifference, @notes,
             @authorizedByUserId, CASE WHEN @authorizedByUserId IS NULL THEN NULL ELSE SYSUTCDATETIME() END)
        `);

      await new sql.Request(transaction)
        .input('shiftId', sql.Int, Number(id))
        .input('closedByUserId', sql.Int, Number(userId))
        .input('expectedCash', sql.Decimal(18, 2), expectedCash)
        .input('countedCash', sql.Decimal(18, 2), countedCash)
        .input('cashDifference', sql.Decimal(18, 2), cashDifference)
        .query(`
          UPDATE PosShifts
          SET status = 'closed',
              closedByUserId = @closedByUserId,
              closedAt = SYSUTCDATETIME(),
              expectedCash = @expectedCash,
              countedCash = @countedCash,
              cashDifference = @cashDifference,
              updatedAt = SYSUTCDATETIME()
          WHERE id = @shiftId
        `);

      await transaction.commit();
      return closureResult.recordset[0];
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

module.exports = PosModel;
