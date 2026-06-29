const { poolPromise, sql } = require('../config/db');

const productSelect = `
  SELECT p.*, s.name AS supplierName
  FROM Products p
  LEFT JOIN Suppliers s ON s.id = p.supplierId
`;

function nullableInt(value) {
  return value === undefined || value === null || value === '' ? null : Number(value);
}

function decimal(value, fallback = 0) {
  return value === undefined || value === null || value === '' ? fallback : Number(value);
}

function bit(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return Number(value) === 1 ? 1 : 0;
}

function text(value) {
  return value === undefined || value === null || value === '' ? null : String(value);
}

function isServiceType(value) {
  return String(value || '').toLowerCase() === 'servicio';
}

function taxableLine(quantity, unitPrice, affectsTax) {
  const total = Number(quantity || 0) * Number(unitPrice || 0);
  if (!bit(affectsTax)) {
    return { subtotal: total, taxAmount: 0, total };
  }

  const subtotal = total / 1.18;
  return {
    subtotal,
    taxAmount: total - subtotal,
    total,
  };
}

function quotationIsEditable(status) {
  return ['creada', 'emitida'].includes(status || 'emitida');
}

function cartesian(items) {
  return items.reduce((acc, item) => acc.flatMap((prefix) => item.values.map((value) => [...prefix, { name: item.name, value }])), [[]]);
}

class InventoryModel {
  static async attachProductCharacteristics(pool, products) {
    if (!products.length) return products;
    const ids = products.map((item) => Number(item.id)).filter(Boolean);
    if (!ids.length) return products;

    const characteristicsResult = await pool.request().query(`
      SELECT id, productId, name
      FROM ProductCharacteristics
      WHERE productId IN (${ids.join(',')})
      ORDER BY name
    `);
    const characteristicIds = characteristicsResult.recordset.map((item) => Number(item.id)).filter(Boolean);
    let values = [];

    if (characteristicIds.length) {
      const valuesResult = await pool.request().query(`
        SELECT id, characteristicId, value
        FROM ProductCharacteristicValues
        WHERE characteristicId IN (${characteristicIds.join(',')})
        ORDER BY value
      `);
      values = valuesResult.recordset;
    }

    return products.map((product) => ({
      ...product,
      characteristics: characteristicsResult.recordset
        .filter((item) => item.productId === product.id)
        .map((item) => ({
          ...item,
          values: values.filter((value) => value.characteristicId === item.id).map((value) => value.value),
        })),
    }));
  }

  static async replaceProductCharacteristics(transaction, productId, characteristics = []) {
    await new sql.Request(transaction)
      .input('productId', sql.Int, Number(productId))
      .query('DELETE FROM ProductCharacteristics WHERE productId = @productId');

    for (const characteristic of characteristics) {
      if (!characteristic.name) continue;
      const result = await new sql.Request(transaction)
        .input('productId', sql.Int, Number(productId))
        .input('name', sql.NVarChar(120), characteristic.name)
        .query(`
          INSERT INTO ProductCharacteristics (productId, name)
          OUTPUT INSERTED.id
          VALUES (@productId, @name)
        `);
      const characteristicId = result.recordset[0].id;
      const values = Array.isArray(characteristic.values) ? characteristic.values : [];

      for (const value of values) {
        if (!value) continue;
        await new sql.Request(transaction)
          .input('characteristicId', sql.Int, characteristicId)
          .input('value', sql.NVarChar(120), value)
          .query(`
            INSERT INTO ProductCharacteristicValues (characteristicId, value)
            VALUES (@characteristicId, @value)
          `);
      }
    }
  }

  static async rebuildProductVariants(transaction, productId) {
    const productResult = await new sql.Request(transaction)
      .input('productId', sql.Int, Number(productId))
      .query('SELECT id, sku, name, model FROM Products WHERE id = @productId');
    const product = productResult.recordset[0];
    if (!product) return;

    const charsResult = await new sql.Request(transaction)
      .input('productId', sql.Int, Number(productId))
      .query('SELECT id, name FROM ProductCharacteristics WHERE productId = @productId ORDER BY name');
    const charIds = charsResult.recordset.map((item) => item.id);
    let values = [];
    if (charIds.length) {
      const valuesResult = await new sql.Request(transaction).query(`
        SELECT characteristicId, value
        FROM ProductCharacteristicValues
        WHERE characteristicId IN (${charIds.join(',')})
        ORDER BY value
      `);
      values = valuesResult.recordset;
    }

    const groups = charsResult.recordset
      .map((item) => ({
        name: item.name,
        values: values.filter((value) => value.characteristicId === item.id).map((value) => value.value),
      }))
      .filter((item) => item.values.length > 0);
    const combinations = groups.length ? cartesian(groups) : [[]];

    await new sql.Request(transaction)
      .input('productId', sql.Int, Number(productId))
      .query('UPDATE ProductVariants SET estado = 0, updatedAt = SYSUTCDATETIME() WHERE productId = @productId');

    for (const combination of combinations) {
      const variantKey = combination.length
        ? combination.map((item) => `${item.name}:${item.value}`).join('|')
        : 'BASE';
      const suffix = combination.map((item) => item.value).join(' ');
      const displayName = `${product.name}${product.model ? ` ${product.model}` : ''}${suffix ? ` ${suffix}` : ''}`;
      const variantSku = `${product.sku}${combination.length ? `-${combination.map((item) => item.value).join('-')}` : ''}`.slice(0, 100);

      const variantResult = await new sql.Request(transaction)
        .input('productId', sql.Int, Number(productId))
        .input('sku', sql.NVarChar(100), variantSku)
        .input('variantKey', sql.NVarChar(500), variantKey)
        .input('displayName', sql.NVarChar(500), displayName)
        .query(`
          MERGE ProductVariants AS target
          USING (SELECT @productId AS productId, @variantKey AS variantKey) AS source
          ON target.productId = source.productId AND target.variantKey = source.variantKey
          WHEN MATCHED THEN
            UPDATE SET sku = @sku, displayName = @displayName, estado = 1, updatedAt = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (productId, sku, variantKey, displayName, estado)
            VALUES (@productId, @sku, @variantKey, @displayName, 1)
          OUTPUT INSERTED.id;
        `);
      const variantId = variantResult.recordset[0].id;
      await new sql.Request(transaction)
        .input('variantId', sql.Int, variantId)
        .query('DELETE FROM ProductVariantValues WHERE variantId = @variantId');
      for (const item of combination) {
        await new sql.Request(transaction)
          .input('variantId', sql.Int, variantId)
          .input('name', sql.NVarChar(120), item.name)
          .input('value', sql.NVarChar(120), item.value)
          .query('INSERT INTO ProductVariantValues (variantId, characteristicName, value) VALUES (@variantId, @name, @value)');
      }
    }
  }

  static async listSuppliers() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Suppliers ORDER BY name');
    return result.recordset;
  }

  static async createSupplier(data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('name', sql.NVarChar(150), data.name)
      .input('contactName', sql.NVarChar(120), data.contactName || null)
      .input('phone', sql.NVarChar(50), data.phone || null)
      .input('email', sql.NVarChar(150), data.email || null)
      .input('address', sql.NVarChar(250), data.address || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        INSERT INTO Suppliers (name, contactName, phone, email, address, estado)
        OUTPUT INSERTED.*
        VALUES (@name, @contactName, @phone, @email, @address, @estado)
      `);
    return result.recordset[0];
  }

  static async updateSupplier(id, data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(150), data.name)
      .input('contactName', sql.NVarChar(120), data.contactName || null)
      .input('phone', sql.NVarChar(50), data.phone || null)
      .input('email', sql.NVarChar(150), data.email || null)
      .input('address', sql.NVarChar(250), data.address || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        UPDATE Suppliers
        SET name = @name, contactName = @contactName, phone = @phone, email = @email,
            address = @address, estado = @estado, updatedAt = SYSUTCDATETIME()
        WHERE id = @id;
        SELECT * FROM Suppliers WHERE id = @id;
      `);
    return result.recordset[0];
  }

  static async deleteSupplier(id) {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM Suppliers WHERE id = @id');
    return { deleted: true };
  }

  static async listPaymentMethods() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM PaymentMethods ORDER BY companyName, name');
    return result.recordset;
  }

  static async createPaymentMethod(data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('companyName', sql.NVarChar(150), data.companyName)
      .input('name', sql.NVarChar(120), data.name)
      .input('description', sql.NVarChar(250), data.description || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        INSERT INTO PaymentMethods (companyName, name, description, estado)
        OUTPUT INSERTED.*
        VALUES (@companyName, @name, @description, @estado)
      `);
    return result.recordset[0];
  }

  static async updatePaymentMethod(id, data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('companyName', sql.NVarChar(150), data.companyName)
      .input('name', sql.NVarChar(120), data.name)
      .input('description', sql.NVarChar(250), data.description || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        UPDATE PaymentMethods
        SET companyName = @companyName, name = @name, description = @description,
            estado = @estado, updatedAt = SYSUTCDATETIME()
        WHERE id = @id;
        SELECT * FROM PaymentMethods WHERE id = @id;
      `);
    return result.recordset[0];
  }

  static async deletePaymentMethod(id) {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM PaymentMethods WHERE id = @id');
    return { deleted: true };
  }

  static async listLocations(locationId = null) {
    const pool = await poolPromise;
    const request = pool.request().input('locationId', sql.Int, nullableInt(locationId));
    const result = await request.query(`
      SELECT * FROM InventoryLocations
      WHERE @locationId IS NULL OR id = @locationId
      ORDER BY name
    `);
    return result.recordset;
  }

  static async createLocation(data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('name', sql.NVarChar(150), data.name)
      .input('type', sql.NVarChar(30), data.type || 'almacen')
      .input('address', sql.NVarChar(250), data.address || null)
      .input('description', sql.NVarChar(250), data.description || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        INSERT INTO InventoryLocations (name, type, address, description, estado)
        OUTPUT INSERTED.*
        VALUES (@name, @type, @address, @description, @estado)
      `);
    return result.recordset[0];
  }

  static async updateLocation(id, data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(150), data.name)
      .input('type', sql.NVarChar(30), data.type || 'almacen')
      .input('address', sql.NVarChar(250), data.address || null)
      .input('description', sql.NVarChar(250), data.description || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        UPDATE InventoryLocations
        SET name = @name, type = @type, address = @address, description = @description,
            estado = @estado, updatedAt = SYSUTCDATETIME()
        WHERE id = @id;
        SELECT * FROM InventoryLocations WHERE id = @id;
      `);
    return result.recordset[0];
  }

  static async deleteLocation(id) {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM InventoryLocations WHERE id = @id');
    return { deleted: true };
  }

  static async listShelves(locationId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
      SELECT sh.*, l.name AS locationName
      FROM Shelves sh
      INNER JOIN InventoryLocations l ON l.id = sh.locationId
      WHERE @locationId IS NULL OR sh.locationId = @locationId
      ORDER BY l.name, sh.name
    `);
    return result.recordset;
  }

  static async createShelf(data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('locationId', sql.Int, Number(data.locationId))
      .input('name', sql.NVarChar(120), data.name)
      .input('code', sql.NVarChar(50), data.code || null)
      .input('description', sql.NVarChar(250), data.description || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        INSERT INTO Shelves (locationId, name, code, description, estado)
        OUTPUT INSERTED.*
        VALUES (@locationId, @name, @code, @description, @estado)
      `);
    return result.recordset[0];
  }

  static async updateShelf(id, data) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('locationId', sql.Int, Number(data.locationId))
      .input('name', sql.NVarChar(120), data.name)
      .input('code', sql.NVarChar(50), data.code || null)
      .input('description', sql.NVarChar(250), data.description || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        UPDATE Shelves
        SET locationId = @locationId, name = @name, code = @code, description = @description,
            estado = @estado, updatedAt = SYSUTCDATETIME()
        WHERE id = @id;
        SELECT * FROM Shelves WHERE id = @id;
      `);
    return result.recordset[0];
  }

  static async deleteShelf(id) {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM Shelves WHERE id = @id');
    return { deleted: true };
  }

  static async listProducts() {
    const pool = await poolPromise;
    const result = await pool.request().query(`${productSelect} ORDER BY p.name`);
    return InventoryModel.attachProductCharacteristics(pool, result.recordset);
  }

  static async createProduct(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const result = await new sql.Request(transaction)
        .input('sku', sql.NVarChar(60), data.sku)
        .input('name', sql.NVarChar(180), data.name)
        .input('type', sql.NVarChar(60), data.type || 'otros')
        .input('category', sql.NVarChar(120), text(data.category))
        .input('model', sql.NVarChar(120), text(data.model))
        .input('description', sql.NVarChar(500), data.description || null)
        .input('imageUrl', sql.NVarChar(sql.MAX), data.imageUrl || null)
        .input('attributesJson', sql.NVarChar(sql.MAX), text(data.attributesJson))
        .input('supplierId', sql.Int, nullableInt(data.supplierId))
        .input('unit', sql.NVarChar(30), data.unit || 'unidad')
        .input('minStock', sql.Decimal(18, 2), decimal(data.minStock))
        .input('costPrice', sql.Decimal(18, 2), decimal(data.costPrice))
      .input('salePrice', sql.Decimal(18, 2), decimal(data.salePrice))
      .input('affectsTax', sql.Bit, bit(data.affectsTax))
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
          INSERT INTO Products (sku, name, type, category, model, description, imageUrl, attributesJson, supplierId, unit, minStock, costPrice, salePrice, affectsTax, estado)
          OUTPUT INSERTED.*
          VALUES (@sku, @name, @type, @category, @model, @description, @imageUrl, @attributesJson, @supplierId, @unit, @minStock, @costPrice, @salePrice, @affectsTax, @estado)
      `);
      const product = result.recordset[0];
      await InventoryModel.replaceProductCharacteristics(transaction, product.id, data.characteristics);
      await InventoryModel.rebuildProductVariants(transaction, product.id);
      await transaction.commit();
      return { ...product, characteristics: data.characteristics || [] };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async updateProduct(id, data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const result = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('sku', sql.NVarChar(60), data.sku)
        .input('name', sql.NVarChar(180), data.name)
        .input('type', sql.NVarChar(60), data.type || 'otros')
        .input('category', sql.NVarChar(120), text(data.category))
        .input('model', sql.NVarChar(120), text(data.model))
        .input('description', sql.NVarChar(500), data.description || null)
        .input('imageUrl', sql.NVarChar(sql.MAX), data.imageUrl || null)
        .input('attributesJson', sql.NVarChar(sql.MAX), text(data.attributesJson))
        .input('supplierId', sql.Int, nullableInt(data.supplierId))
        .input('unit', sql.NVarChar(30), data.unit || 'unidad')
        .input('minStock', sql.Decimal(18, 2), decimal(data.minStock))
        .input('costPrice', sql.Decimal(18, 2), decimal(data.costPrice))
        .input('salePrice', sql.Decimal(18, 2), decimal(data.salePrice))
        .input('affectsTax', sql.Bit, bit(data.affectsTax))
        .input('estado', sql.Bit, bit(data.estado))
        .query(`
          UPDATE Products
          SET sku = @sku, name = @name, type = @type, category = @category, model = @model, description = @description,
              imageUrl = @imageUrl, attributesJson = @attributesJson, supplierId = @supplierId,
              unit = @unit, minStock = @minStock, costPrice = @costPrice, salePrice = @salePrice,
              affectsTax = @affectsTax, estado = @estado, updatedAt = SYSUTCDATETIME()
          WHERE id = @id;
          ${productSelect} WHERE p.id = @id;
      `);
      await InventoryModel.replaceProductCharacteristics(transaction, id, data.characteristics);
      await InventoryModel.rebuildProductVariants(transaction, id);
      await transaction.commit();
      return { ...result.recordset[0], characteristics: data.characteristics || [] };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async deleteProduct(id) {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM Products WHERE id = @id');
    return { deleted: true };
  }

  static async listSellableItems(locationId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
      SELECT
        v.id AS variantId,
        p.id AS productId,
        p.sku AS productSku,
        v.sku AS variantSku,
        p.name,
        p.type,
        p.model,
        p.imageUrl,
        v.displayName,
        p.unit,
        p.costPrice,
        p.salePrice,
        p.affectsTax,
        ISNULL(SUM(st.quantity), 0) AS stock
      FROM Products p
      LEFT JOIN ProductVariants v ON v.productId = p.id AND v.estado = 1
      LEFT JOIN InventoryStock st ON st.productId = p.id
        AND ((v.id IS NULL AND st.variantId IS NULL) OR st.variantId = v.id)
        AND (@locationId IS NULL OR st.locationId = @locationId)
      WHERE p.estado = 1
      GROUP BY v.id, p.id, p.sku, v.sku, p.name, p.type, p.model, p.imageUrl, v.displayName, p.unit, p.costPrice, p.salePrice, p.affectsTax
      ORDER BY ISNULL(v.displayName, p.name)
    `);
    return result.recordset;
  }

  static async productTypeMap(transaction, details = []) {
    const ids = [...new Set(details.map((item) => Number(item.productId)).filter(Boolean))];
    if (!ids.length) return new Map();
    const result = await new sql.Request(transaction).query(`
      SELECT id, type
      FROM Products
      WHERE id IN (${ids.join(',')})
    `);
    return new Map(result.recordset.map((item) => [Number(item.id), item.type]));
  }

  static async ensureInventoryProducts(transaction, details = [], actionLabel = 'movimiento') {
    const typeMap = await InventoryModel.productTypeMap(transaction, details);
    const serviceItem = details.find((item) => isServiceType(typeMap.get(Number(item.productId))));
    if (serviceItem) {
      const error = new Error(`No se puede registrar un servicio en ${actionLabel} de inventario`);
      error.status = 400;
      throw error;
    }
    return typeMap;
  }

  static async listCustomers() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Customers ORDER BY name');
    return result.recordset;
  }

  static async getCustomer(id) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, Number(id))
      .query('SELECT * FROM Customers WHERE id = @id');
    return result.recordset[0] || null;
  }

  static async createCustomer(data) {
    const pool = await poolPromise;
    if (data.documentNumber) {
      const existing = await pool.request()
        .input('documentNumber', sql.NVarChar(30), data.documentNumber)
        .query('SELECT TOP 1 id, name, estado FROM Customers WHERE documentNumber = @documentNumber');
      if (existing.recordset[0]) {
        const error = new Error(existing.recordset[0].estado
          ? 'Ya existe un cliente con este numero de documento'
          : 'El documento pertenece a un cliente deshabilitado');
        error.status = 409;
        throw error;
      }
    }
    const result = await pool.request()
      .input('documentType', sql.NVarChar(30), data.documentType || null)
      .input('documentNumber', sql.NVarChar(30), data.documentNumber || null)
      .input('name', sql.NVarChar(180), data.name)
      .input('phone', sql.NVarChar(50), data.phone || null)
      .input('email', sql.NVarChar(150), data.email || null)
      .input('address', sql.NVarChar(250), data.address || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        INSERT INTO Customers (documentType, documentNumber, name, phone, email, address, estado)
        OUTPUT INSERTED.*
        VALUES (@documentType, @documentNumber, @name, @phone, @email, @address, @estado)
      `);
    return result.recordset[0];
  }

  static async updateCustomer(id, data) {
    const pool = await poolPromise;
    if (data.documentNumber) {
      const existing = await pool.request()
        .input('id', sql.Int, id)
        .input('documentNumber', sql.NVarChar(30), data.documentNumber)
        .query('SELECT TOP 1 id FROM Customers WHERE documentNumber = @documentNumber AND id <> @id');
      if (existing.recordset[0]) {
        const error = new Error('Ya existe otro cliente con este numero de documento');
        error.status = 409;
        throw error;
      }
    }
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('documentType', sql.NVarChar(30), data.documentType || null)
      .input('documentNumber', sql.NVarChar(30), data.documentNumber || null)
      .input('name', sql.NVarChar(180), data.name)
      .input('phone', sql.NVarChar(50), data.phone || null)
      .input('email', sql.NVarChar(150), data.email || null)
      .input('address', sql.NVarChar(250), data.address || null)
      .input('estado', sql.Bit, bit(data.estado))
      .query(`
        UPDATE Customers
        SET documentType = @documentType, documentNumber = @documentNumber, name = @name,
            phone = @phone, email = @email, address = @address, estado = @estado,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @id;
        SELECT * FROM Customers WHERE id = @id;
      `);
    return result.recordset[0];
  }

  static async deleteCustomer(id) {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, id).query('DELETE FROM Customers WHERE id = @id');
    return { deleted: true };
  }

  static async listSellers(sellerId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('sellerId', sql.Int, nullableInt(sellerId))
      .query(`
      SELECT id, name, email, role, assignedLocationId
      FROM Users
      WHERE estado = 1
        AND role IN ('vendedor', 'admin', 'admin_tienda', 'comercial', 'vendedor_tienda')
        AND (@sellerId IS NULL OR id = @sellerId)
      ORDER BY name
    `);
    return result.recordset;
  }

  static async getNextQuotationNumber() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT ISNULL(MAX(id), 0) + 1 AS nextId FROM QuotationHeaders');
    return String(result.recordset[0].nextId).padStart(7, '0');
  }

  static async listQuotations(sellerId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('sellerId', sql.Int, nullableInt(sellerId))
      .query(`
      SELECT q.*, c.name AS customerName, c.phone AS customerPhone, u.name AS sellerName, sh.status AS saleStatus
      FROM QuotationHeaders q
      INNER JOIN Customers c ON c.id = q.customerId
      INNER JOIN Users u ON u.id = q.sellerId
      LEFT JOIN SaleHeaders sh ON sh.quotationId = q.id
      WHERE @sellerId IS NULL OR q.sellerId = @sellerId
      ORDER BY q.id DESC
    `);
    return result.recordset;
  }

  static async getQuotationDocument(id, sellerId = null) {
    const pool = await poolPromise;
    const headerResult = await pool.request()
      .input('id', sql.Int, Number(id))
      .input('sellerId', sql.Int, nullableInt(sellerId))
      .query(`
        SELECT q.*, c.name AS customerName, c.documentType, c.documentNumber,
               c.phone AS customerPhone, c.email AS customerEmail, c.address AS customerAddress,
               u.name AS sellerName, u.email AS sellerEmail
        FROM QuotationHeaders q
        INNER JOIN Customers c ON c.id = q.customerId
        INNER JOIN Users u ON u.id = q.sellerId
        WHERE q.id = @id AND (@sellerId IS NULL OR q.sellerId = @sellerId)
      `);
    const header = headerResult.recordset[0];
    if (!header) {
      const error = new Error('Cotizacion no encontrada');
      error.status = 404;
      throw error;
    }

    const detailsResult = await pool.request()
      .input('quotationId', sql.Int, Number(id))
      .query(`
        SELECT *
        FROM QuotationDetails
        WHERE quotationId = @quotationId
        ORDER BY id
      `);

    return { header, details: detailsResult.recordset };
  }

  static getQuotation(id, sellerId = null) {
    return InventoryModel.getQuotationDocument(id, sellerId);
  }

  static async approveQuotation(id, sellerId = null) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const headerResult = await new sql.Request(transaction)
        .input('id', sql.Int, Number(id))
        .input('sellerId', sql.Int, nullableInt(sellerId))
        .query(`
          SELECT q.*, c.name AS customerName
          FROM QuotationHeaders q
          INNER JOIN Customers c ON c.id = q.customerId
          WHERE q.id = @id AND (@sellerId IS NULL OR q.sellerId = @sellerId)
        `);
      const quotation = headerResult.recordset[0];
      if (!quotation) {
        const error = new Error('Cotizacion no encontrada');
        error.status = 404;
        throw error;
      }
      if (!quotationIsEditable(quotation.status)) {
        const error = new Error('Solo se puede aprobar una cotizacion en estado creada');
        error.status = 400;
        throw error;
      }

      const detailsResult = await new sql.Request(transaction)
        .input('quotationId', sql.Int, Number(id))
        .query('SELECT * FROM QuotationDetails WHERE quotationId = @quotationId');

      const saleResult = await new sql.Request(transaction)
        .input('customerName', sql.NVarChar(150), quotation.customerName)
        .input('customerId', sql.Int, quotation.customerId)
        .input('sellerId', sql.Int, quotation.sellerId)
        .input('quotationId', sql.Int, quotation.id)
        .input('documentNumber', sql.NVarChar(80), quotation.quotationNumber)
        .input('saleDate', sql.Date, new Date())
        .input('notes', sql.NVarChar(500), quotation.comments || null)
        .input('subtotal', sql.Decimal(18, 2), quotation.subtotal)
        .input('taxTotal', sql.Decimal(18, 2), quotation.taxTotal)
        .input('total', sql.Decimal(18, 2), quotation.total)
        .query(`
          INSERT INTO SaleHeaders
            (customerName, customerId, sellerId, quotationId, saleType, status, documentNumber, saleDate, notes, subtotal, taxTotal, total)
          OUTPUT INSERTED.*
          VALUES
            (@customerName, @customerId, @sellerId, @quotationId, 'formal', 'preventa', @documentNumber, @saleDate, @notes, @subtotal, @taxTotal, @total)
        `);
      const sale = saleResult.recordset[0];

      for (const item of detailsResult.recordset) {
        await new sql.Request(transaction)
          .input('saleId', sql.Int, sale.id)
          .input('productId', sql.Int, item.productId)
          .input('variantId', sql.Int, nullableInt(item.variantId))
          .input('productDescription', sql.NVarChar(500), item.productDescription)
          .input('detailNotes', sql.NVarChar(sql.MAX), text(item.detailNotes))
          .input('unit', sql.NVarChar(30), item.unit || 'unidad')
          .input('quantity', sql.Decimal(18, 2), item.quantity)
          .input('listPrice', sql.Decimal(18, 2), item.listPrice)
          .input('unitPrice', sql.Decimal(18, 2), item.unitPrice)
          .input('affectsTax', sql.Bit, item.affectsTax)
          .input('taxRate', sql.Decimal(5, 2), item.taxRate)
          .input('subtotal', sql.Decimal(18, 2), item.subtotal)
          .input('taxAmount', sql.Decimal(18, 2), item.taxAmount)
          .input('total', sql.Decimal(18, 2), item.total)
          .query(`
            INSERT INTO SaleDetails
              (saleId, productId, variantId, productDescription, detailNotes, unit, quantity, listPrice, unitPrice, affectsTax, taxRate, subtotal, taxAmount, total)
            VALUES
              (@saleId, @productId, @variantId, @productDescription, @detailNotes, @unit, @quantity, @listPrice, @unitPrice, @affectsTax, @taxRate, @subtotal, @taxAmount, @total)
          `);
      }

      await new sql.Request(transaction)
        .input('id', sql.Int, Number(id))
        .query("UPDATE QuotationHeaders SET status = 'aprobada', approvedAt = SYSUTCDATETIME() WHERE id = @id");

      await transaction.commit();
      return sale;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async createQuotation(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const nextResult = await new sql.Request(transaction).query('SELECT ISNULL(MAX(id), 0) + 1 AS nextId FROM QuotationHeaders');
      const quotationNumber = String(nextResult.recordset[0].nextId).padStart(7, '0');
      const details = Array.isArray(data.details) ? data.details : [];
      const totals = details.reduce((acc, item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = decimal(item.unitPrice);
        const line = taxableLine(quantity, unitPrice, item.affectsTax);
        return {
          subtotal: acc.subtotal + line.subtotal,
          taxTotal: acc.taxTotal + line.taxAmount,
          total: acc.total + line.total,
        };
      }, { subtotal: 0, taxTotal: 0, total: 0 });

      const header = await new sql.Request(transaction)
        .input('quotationNumber', sql.NVarChar(20), quotationNumber)
        .input('quotationDate', sql.Date, data.quotationDate || new Date())
        .input('currency', sql.NVarChar(10), data.currency || 'PEN')
        .input('customerId', sql.Int, Number(data.customerId))
        .input('sellerId', sql.Int, Number(data.sellerId))
        .input('paymentMethod', sql.NVarChar(160), data.paymentMethod || null)
        .input('deliveryDate', sql.Date, data.deliveryDate || null)
        .input('deliveryMethod', sql.NVarChar(120), data.deliveryMethod || null)
        .input('comments', sql.NVarChar(500), data.comments || null)
        .input('subtotal', sql.Decimal(18, 2), totals.subtotal)
        .input('taxTotal', sql.Decimal(18, 2), totals.taxTotal)
        .input('total', sql.Decimal(18, 2), totals.total)
        .query(`
          INSERT INTO QuotationHeaders
            (quotationNumber, quotationDate, currency, customerId, sellerId, paymentMethod, deliveryDate, deliveryMethod, comments, subtotal, taxTotal, total, status)
          OUTPUT INSERTED.*
          VALUES
            (@quotationNumber, @quotationDate, @currency, @customerId, @sellerId, @paymentMethod, @deliveryDate, @deliveryMethod, @comments, @subtotal, @taxTotal, @total, 'creada')
        `);
      const quotation = header.recordset[0];

      for (const item of details) {
        const quantity = Number(item.quantity || 0);
        const listPrice = decimal(item.listPrice);
        const unitPrice = decimal(item.unitPrice);
        const affectsTax = bit(item.affectsTax);
        const line = taxableLine(quantity, unitPrice, affectsTax);
        await new sql.Request(transaction)
          .input('quotationId', sql.Int, quotation.id)
          .input('productId', sql.Int, Number(item.productId))
          .input('variantId', sql.Int, nullableInt(item.variantId))
          .input('productDescription', sql.NVarChar(500), item.productDescription)
          .input('detailNotes', sql.NVarChar(sql.MAX), text(item.detailNotes))
          .input('unit', sql.NVarChar(30), item.unit || 'unidad')
          .input('quantity', sql.Decimal(18, 2), quantity)
          .input('listPrice', sql.Decimal(18, 2), listPrice)
          .input('unitPrice', sql.Decimal(18, 2), unitPrice)
          .input('affectsTax', sql.Bit, affectsTax)
          .input('taxRate', sql.Decimal(5, 2), 18)
          .input('subtotal', sql.Decimal(18, 2), line.subtotal)
          .input('taxAmount', sql.Decimal(18, 2), line.taxAmount)
          .input('total', sql.Decimal(18, 2), line.total)
          .query(`
            INSERT INTO QuotationDetails
              (quotationId, productId, variantId, productDescription, detailNotes, unit, quantity, listPrice, unitPrice, affectsTax, taxRate, subtotal, taxAmount, total)
            VALUES
              (@quotationId, @productId, @variantId, @productDescription, @detailNotes, @unit, @quantity, @listPrice, @unitPrice, @affectsTax, @taxRate, @subtotal, @taxAmount, @total)
          `);
      }

      await transaction.commit();
      return quotation;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async updateQuotation(id, data, sellerId = null) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const existingResult = await new sql.Request(transaction)
        .input('id', sql.Int, Number(id))
        .input('sellerId', sql.Int, nullableInt(sellerId))
        .query('SELECT * FROM QuotationHeaders WHERE id = @id AND (@sellerId IS NULL OR sellerId = @sellerId)');
      const existing = existingResult.recordset[0];
      if (!existing) {
        const error = new Error('Cotizacion no encontrada');
        error.status = 404;
        throw error;
      }
      if (!quotationIsEditable(existing.status)) {
        const error = new Error('Solo se puede editar una cotizacion en estado creada');
        error.status = 400;
        throw error;
      }

      const details = Array.isArray(data.details) ? data.details : [];
      const totals = details.reduce((acc, item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = decimal(item.unitPrice);
        const line = taxableLine(quantity, unitPrice, item.affectsTax);
        return {
          subtotal: acc.subtotal + line.subtotal,
          taxTotal: acc.taxTotal + line.taxAmount,
          total: acc.total + line.total,
        };
      }, { subtotal: 0, taxTotal: 0, total: 0 });

      const header = await new sql.Request(transaction)
        .input('id', sql.Int, Number(id))
        .input('quotationDate', sql.Date, data.quotationDate || new Date())
        .input('currency', sql.NVarChar(10), data.currency || 'PEN')
        .input('customerId', sql.Int, Number(data.customerId))
        .input('sellerId', sql.Int, Number(data.sellerId))
        .input('paymentMethod', sql.NVarChar(160), data.paymentMethod || null)
        .input('deliveryDate', sql.Date, data.deliveryDate || null)
        .input('deliveryMethod', sql.NVarChar(120), data.deliveryMethod || null)
        .input('comments', sql.NVarChar(500), data.comments || null)
        .input('subtotal', sql.Decimal(18, 2), totals.subtotal)
        .input('taxTotal', sql.Decimal(18, 2), totals.taxTotal)
        .input('total', sql.Decimal(18, 2), totals.total)
        .query(`
          UPDATE QuotationHeaders
          SET quotationDate = @quotationDate, currency = @currency, customerId = @customerId,
              sellerId = @sellerId, paymentMethod = @paymentMethod, deliveryDate = @deliveryDate,
              deliveryMethod = @deliveryMethod, comments = @comments, subtotal = @subtotal,
              taxTotal = @taxTotal, total = @total
          OUTPUT INSERTED.*
          WHERE id = @id
        `);

      await new sql.Request(transaction)
        .input('quotationId', sql.Int, Number(id))
        .query('DELETE FROM QuotationDetails WHERE quotationId = @quotationId');

      for (const item of details) {
        const quantity = Number(item.quantity || 0);
        const listPrice = decimal(item.listPrice);
        const unitPrice = decimal(item.unitPrice);
        const affectsTax = bit(item.affectsTax);
        const line = taxableLine(quantity, unitPrice, affectsTax);
        await new sql.Request(transaction)
          .input('quotationId', sql.Int, Number(id))
          .input('productId', sql.Int, Number(item.productId))
          .input('variantId', sql.Int, nullableInt(item.variantId))
          .input('productDescription', sql.NVarChar(500), item.productDescription)
          .input('detailNotes', sql.NVarChar(sql.MAX), text(item.detailNotes))
          .input('unit', sql.NVarChar(30), item.unit || 'unidad')
          .input('quantity', sql.Decimal(18, 2), quantity)
          .input('listPrice', sql.Decimal(18, 2), listPrice)
          .input('unitPrice', sql.Decimal(18, 2), unitPrice)
          .input('affectsTax', sql.Bit, affectsTax)
          .input('taxRate', sql.Decimal(5, 2), 18)
          .input('subtotal', sql.Decimal(18, 2), line.subtotal)
          .input('taxAmount', sql.Decimal(18, 2), line.taxAmount)
          .input('total', sql.Decimal(18, 2), line.total)
          .query(`
            INSERT INTO QuotationDetails
              (quotationId, productId, variantId, productDescription, detailNotes, unit, quantity, listPrice, unitPrice, affectsTax, taxRate, subtotal, taxAmount, total)
            VALUES
              (@quotationId, @productId, @variantId, @productDescription, @detailNotes, @unit, @quantity, @listPrice, @unitPrice, @affectsTax, @taxRate, @subtotal, @taxAmount, @total)
          `);
      }

      await transaction.commit();
      return header.recordset[0];
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async listStock(locationId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
      SELECT st.*, p.sku, p.name AS productName, p.type AS productType, p.category, p.unit, p.minStock, p.costPrice, p.salePrice,
             s.name AS supplierName, v.sku AS variantSku, v.displayName AS variantName, l.name AS locationName, sh.name AS shelfName
      FROM InventoryStock st
      INNER JOIN Products p ON p.id = st.productId
      LEFT JOIN Suppliers s ON s.id = p.supplierId
      LEFT JOIN ProductVariants v ON v.id = st.variantId
      INNER JOIN InventoryLocations l ON l.id = st.locationId
      LEFT JOIN Shelves sh ON sh.id = st.shelfId
      WHERE @locationId IS NULL OR st.locationId = @locationId
      ORDER BY p.name, v.displayName, l.name, sh.name
    `);
    return result.recordset;
  }

  static async moveStockShelf(id, targetShelfId = null, scopedLocationId = null) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const currentResult = await new sql.Request(transaction)
        .input('id', sql.Int, Number(id))
        .input('locationId', sql.Int, nullableInt(scopedLocationId))
        .query(`
          SELECT *
          FROM InventoryStock
          WHERE id = @id AND (@locationId IS NULL OR locationId = @locationId)
        `);
      const current = currentResult.recordset[0];
      if (!current) {
        const error = new Error('Existencia no encontrada');
        error.status = 404;
        throw error;
      }

      const nextShelfId = nullableInt(targetShelfId);
      if (nextShelfId) {
        const shelfResult = await new sql.Request(transaction)
          .input('shelfId', sql.Int, nextShelfId)
          .input('locationId', sql.Int, current.locationId)
          .query('SELECT id FROM Shelves WHERE id = @shelfId AND locationId = @locationId');
        if (!shelfResult.recordset[0]) {
          const error = new Error('El estante destino no pertenece a la ubicacion de la existencia');
          error.status = 400;
          throw error;
        }
      }

      if (String(current.shelfId || '') === String(nextShelfId || '')) {
        const error = new Error('Selecciona un estante distinto al actual');
        error.status = 400;
        throw error;
      }

      const targetResult = await new sql.Request(transaction)
        .input('id', sql.Int, Number(id))
        .input('productId', sql.Int, current.productId)
        .input('variantId', sql.Int, nullableInt(current.variantId))
        .input('locationId', sql.Int, current.locationId)
        .input('shelfId', sql.Int, nextShelfId)
        .query(`
          SELECT id
          FROM InventoryStock
          WHERE id <> @id
            AND productId = @productId
            AND locationId = @locationId
            AND ((variantId IS NULL AND @variantId IS NULL) OR variantId = @variantId)
            AND ((shelfId IS NULL AND @shelfId IS NULL) OR shelfId = @shelfId)
        `);
      const target = targetResult.recordset[0];

      if (target) {
        await new sql.Request(transaction)
          .input('id', sql.Int, target.id)
          .input('quantity', sql.Decimal(18, 2), current.quantity)
          .query('UPDATE InventoryStock SET quantity = quantity + @quantity, updatedAt = SYSUTCDATETIME() WHERE id = @id');
        await new sql.Request(transaction)
          .input('id', sql.Int, Number(id))
          .query('DELETE FROM InventoryStock WHERE id = @id');
      } else {
        await new sql.Request(transaction)
          .input('id', sql.Int, Number(id))
          .input('shelfId', sql.Int, nextShelfId)
          .query('UPDATE InventoryStock SET shelfId = @shelfId, updatedAt = SYSUTCDATETIME() WHERE id = @id');
      }

      await InventoryModel.insertMovement(transaction, current.productId, current.variantId, current.locationId, current.shelfId, 'salida', current.quantity, 'reubicacion', Number(id), 'Cambio de estante');
      await InventoryModel.insertMovement(transaction, current.productId, current.variantId, current.locationId, nextShelfId, 'entrada', current.quantity, 'reubicacion', Number(id), 'Cambio de estante');

      await transaction.commit();
      return { ok: true };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async adjustStock(data, scopedLocationId = null) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const locationId = Number(data.locationId);
      const productId = Number(data.productId);
      const variantId = nullableInt(data.variantId);
      const shelfId = nullableInt(data.shelfId);
      const quantity = Number(data.quantity || 0);
      const operation = data.operation || 'entrada';
      const allowedOperations = ['entrada', 'salida', 'ajuste'];

      if (!productId || !locationId || data.quantity === undefined || data.quantity === null || data.quantity === '' || quantity < 0) {
        const error = new Error('Producto, tienda y cantidad son obligatorios');
        error.status = 400;
        throw error;
      }
      if (!allowedOperations.includes(operation) || (operation !== 'ajuste' && quantity <= 0)) {
        const error = new Error('Operacion o cantidad no valida');
        error.status = 400;
        throw error;
      }

      if (scopedLocationId && Number(scopedLocationId) !== locationId) {
        const error = new Error('Solo puedes ajustar stock de tu tienda asignada');
        error.status = 403;
        throw error;
      }

      const productResult = await new sql.Request(transaction)
        .input('productId', sql.Int, productId)
        .input('variantId', sql.Int, variantId)
        .query(`
          SELECT p.id, p.type, v.id AS variantId
          FROM Products p
          LEFT JOIN ProductVariants v ON v.productId = p.id AND v.id = @variantId AND v.estado = 1
          WHERE p.id = @productId AND p.estado = 1
        `);
      const product = productResult.recordset[0];
      if (!product || (variantId && !product.variantId)) {
        const error = new Error('Producto o variante no valida');
        error.status = 400;
        throw error;
      }
      if (isServiceType(product.type)) {
        const error = new Error('Los servicios no manejan stock');
        error.status = 400;
        throw error;
      }

      const locationResult = await new sql.Request(transaction)
        .input('locationId', sql.Int, locationId)
        .query('SELECT id FROM InventoryLocations WHERE id = @locationId');
      if (!locationResult.recordset[0]) {
        const error = new Error('Tienda no valida');
        error.status = 400;
        throw error;
      }

      if (shelfId) {
        const shelfResult = await new sql.Request(transaction)
          .input('shelfId', sql.Int, shelfId)
          .input('locationId', sql.Int, locationId)
          .query('SELECT id FROM Shelves WHERE id = @shelfId AND locationId = @locationId');
        if (!shelfResult.recordset[0]) {
          const error = new Error('El estante no pertenece a la tienda seleccionada');
          error.status = 400;
          throw error;
        }
      }

      const current = Number(await InventoryModel.getStock(transaction, productId, variantId, locationId, shelfId));
      let delta = quantity;
      let movementType = 'entrada';
      if (operation === 'salida') {
        delta = quantity * -1;
        movementType = 'salida';
      } else if (operation === 'ajuste') {
        delta = quantity - current;
        movementType = 'ajuste';
      }

      if (current + delta < 0) {
        const error = new Error('El ajuste no puede dejar stock negativo');
        error.status = 400;
        throw error;
      }

      if (delta !== 0) {
        await InventoryModel.addStock(transaction, productId, variantId, locationId, shelfId, delta);
      }
      await InventoryModel.insertMovement(transaction, productId, variantId, locationId, shelfId, movementType, operation === 'ajuste' ? delta : Math.abs(delta), 'ajuste_pos', null, data.notes || 'Ajuste simple POS');

      await transaction.commit();
      return { ok: true, previousStock: current, currentStock: current + delta, delta };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async listPurchases() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ph.*, s.name AS supplierName, l.name AS locationName, sh.name AS shelfName
      FROM PurchaseHeaders ph
      LEFT JOIN Suppliers s ON s.id = ph.supplierId
      INNER JOIN InventoryLocations l ON l.id = ph.locationId
      LEFT JOIN Shelves sh ON sh.id = ph.shelfId
      ORDER BY ph.purchaseDate DESC, ph.id DESC
    `);
    return result.recordset;
  }

  static async listTransfers() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT th.*, sl.name AS sourceLocationName, ss.name AS sourceShelfName,
             tl.name AS targetLocationName, ts.name AS targetShelfName
      FROM TransferHeaders th
      INNER JOIN InventoryLocations sl ON sl.id = th.sourceLocationId
      LEFT JOIN Shelves ss ON ss.id = th.sourceShelfId
      INNER JOIN InventoryLocations tl ON tl.id = th.targetLocationId
      LEFT JOIN Shelves ts ON ts.id = th.targetShelfId
      ORDER BY th.transferDate DESC, th.id DESC
    `);
    return result.recordset;
  }

  static async createTransfer(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await InventoryModel.ensureInventoryProducts(transaction, data.details, 'traslados');

      for (const item of data.details) {
        const current = await InventoryModel.getStock(transaction, item.productId, item.variantId, data.sourceLocationId, nullableInt(data.sourceShelfId));
        if (Number(current) < Number(item.quantity)) {
          const error = new Error('Stock insuficiente para trasladar una o mas existencias');
          error.status = 400;
          throw error;
        }
      }

      const header = await new sql.Request(transaction)
        .input('sourceLocationId', sql.Int, Number(data.sourceLocationId))
        .input('sourceShelfId', sql.Int, nullableInt(data.sourceShelfId))
        .input('targetLocationId', sql.Int, Number(data.targetLocationId))
        .input('targetShelfId', sql.Int, nullableInt(data.targetShelfId))
        .input('documentNumber', sql.NVarChar(80), data.documentNumber || null)
        .input('transferDate', sql.Date, data.transferDate || new Date())
        .input('notes', sql.NVarChar(500), data.notes || null)
        .query(`
          INSERT INTO TransferHeaders (sourceLocationId, sourceShelfId, targetLocationId, targetShelfId, documentNumber, transferDate, notes)
          OUTPUT INSERTED.*
          VALUES (@sourceLocationId, @sourceShelfId, @targetLocationId, @targetShelfId, @documentNumber, @transferDate, @notes)
        `);
      const transfer = header.recordset[0];

      for (const item of data.details) {
        await InventoryModel.insertTransferDetail(transaction, transfer.id, item);
        await InventoryModel.addStock(transaction, item.productId, item.variantId, data.sourceLocationId, nullableInt(data.sourceShelfId), Number(item.quantity) * -1);
        await InventoryModel.insertMovement(transaction, item.productId, item.variantId, data.sourceLocationId, nullableInt(data.sourceShelfId), 'salida', Number(item.quantity), 'traslado', transfer.id, data.notes || null);
        await InventoryModel.addStock(transaction, item.productId, item.variantId, data.targetLocationId, nullableInt(data.targetShelfId), Number(item.quantity));
        await InventoryModel.insertMovement(transaction, item.productId, item.variantId, data.targetLocationId, nullableInt(data.targetShelfId), 'entrada', Number(item.quantity), 'traslado', transfer.id, data.notes || null);
      }

      await transaction.commit();
      return transfer;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async createPurchase(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await InventoryModel.ensureInventoryProducts(transaction, data.details, 'compras');

      const total = data.details.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost || 0), 0);
      const header = await new sql.Request(transaction)
        .input('supplierId', sql.Int, nullableInt(data.supplierId))
        .input('locationId', sql.Int, Number(data.locationId))
        .input('shelfId', sql.Int, nullableInt(data.shelfId))
        .input('documentNumber', sql.NVarChar(80), data.documentNumber || null)
        .input('purchaseDate', sql.Date, data.purchaseDate || new Date())
        .input('notes', sql.NVarChar(500), data.notes || null)
        .input('total', sql.Decimal(18, 2), total)
        .query(`
          INSERT INTO PurchaseHeaders (supplierId, locationId, shelfId, documentNumber, purchaseDate, notes, total)
          OUTPUT INSERTED.*
          VALUES (@supplierId, @locationId, @shelfId, @documentNumber, @purchaseDate, @notes, @total)
        `);
      const purchase = header.recordset[0];

      for (const item of data.details) {
        await InventoryModel.insertPurchaseDetail(transaction, purchase.id, item);
        await InventoryModel.addStock(transaction, item.productId, item.variantId, data.locationId, nullableInt(data.shelfId), Number(item.quantity));
        await InventoryModel.insertMovement(transaction, item.productId, item.variantId, data.locationId, nullableInt(data.shelfId), 'entrada', Number(item.quantity), 'compra', purchase.id, data.notes || null);
      }

      await transaction.commit();
      return purchase;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async listSales(locationId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
      SELECT sh.*, l.name AS locationName, sf.name AS shelfName, q.quotationNumber,
             u.name AS sellerName, c.phone AS customerPhone,
             sd.id AS saleDocumentId, sd.documentType AS saleDocumentType, sd.fullNumber AS saleDocumentNumber,
             sd.status AS saleDocumentStatus
      FROM SaleHeaders sh
      LEFT JOIN InventoryLocations l ON l.id = sh.locationId
      LEFT JOIN Shelves sf ON sf.id = sh.shelfId
      LEFT JOIN QuotationHeaders q ON q.id = sh.quotationId
      LEFT JOIN Customers c ON c.id = sh.customerId
      LEFT JOIN Users u ON u.id = sh.sellerId
      LEFT JOIN SaleDocuments sd ON sd.saleId = sh.id AND sd.status <> 'anulado'
      WHERE @locationId IS NULL OR sh.locationId = @locationId OR sh.status = 'preventa'
      ORDER BY sh.saleDate DESC, sh.id DESC
    `);
    return result.recordset;
  }

  static async getSale(id, locationId = null) {
    const pool = await poolPromise;
    const headerResult = await pool.request()
      .input('id', sql.Int, Number(id))
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
        SELECT sh.*, l.name AS locationName, sf.name AS shelfName, q.quotationNumber, q.paymentMethod, c.name AS customerFullName,
               c.documentType AS customerDocumentType, c.documentNumber AS customerDocumentNumber,
               c.phone AS customerPhone, c.address AS customerAddress, u.name AS sellerName
        FROM SaleHeaders sh
        LEFT JOIN InventoryLocations l ON l.id = sh.locationId
        LEFT JOIN Shelves sf ON sf.id = sh.shelfId
        LEFT JOIN QuotationHeaders q ON q.id = sh.quotationId
        LEFT JOIN Customers c ON c.id = sh.customerId
        LEFT JOIN Users u ON u.id = sh.sellerId
        WHERE sh.id = @id
          AND (@locationId IS NULL OR sh.locationId = @locationId OR sh.status = 'preventa')
      `);
    const header = headerResult.recordset[0];
    if (!header) {
      const error = new Error('Venta no encontrada');
      error.status = 404;
      throw error;
    }

    const detailsResult = await pool.request()
      .input('saleId', sql.Int, Number(id))
      .query(`
        SELECT sd.*, p.sku AS productSku, v.sku AS variantSku, v.displayName AS variantName
        FROM SaleDetails sd
        INNER JOIN Products p ON p.id = sd.productId
        LEFT JOIN ProductVariants v ON v.id = sd.variantId
        WHERE sd.saleId = @saleId
        ORDER BY sd.id
      `);

    const documentsResult = await pool.request()
      .input('saleId', sql.Int, Number(id))
      .query(`
        SELECT *
        FROM SaleDocuments
        WHERE saleId = @saleId
        ORDER BY createdAt DESC, id DESC
      `);

    return {
      header,
      details: detailsResult.recordset,
      documents: documentsResult.recordset,
    };
  }

  static async createSaleDocument(saleId, data, locationId = null) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const saleResult = await new sql.Request(transaction)
        .input('saleId', sql.Int, Number(saleId))
        .input('locationId', sql.Int, nullableInt(locationId))
        .query(`
          SELECT sh.*, c.name AS customerFullName, c.documentType AS customerDocumentType,
                 c.documentNumber AS customerDocumentNumber, c.address AS customerAddress
          FROM SaleHeaders sh
          LEFT JOIN Customers c ON c.id = sh.customerId
          WHERE sh.id = @saleId
            AND (@locationId IS NULL OR sh.locationId = @locationId)
        `);
      const sale = saleResult.recordset[0];
      if (!sale) {
        const error = new Error('Venta no encontrada');
        error.status = 404;
        throw error;
      }
      if (sale.status !== 'cerrada') {
        const error = new Error('Solo se puede emitir comprobante para ventas cerradas');
        error.status = 400;
        throw error;
      }

      const existingResult = await new sql.Request(transaction)
        .input('saleId', sql.Int, Number(saleId))
        .query("SELECT TOP 1 * FROM SaleDocuments WHERE saleId = @saleId AND status <> 'anulado'");
      if (existingResult.recordset[0]) {
        const error = new Error('La venta ya tiene un comprobante emitido');
        error.status = 400;
        throw error;
      }

      const documentType = data.documentType === 'factura' ? 'factura' : 'boleta';
      const series = text(data.series) || (documentType === 'factura' ? 'F001' : 'B001');
      const customerDocumentType = text(data.customerDocumentType || sale.customerDocumentType);
      const customerDocumentNumber = text(data.customerDocumentNumber || sale.customerDocumentNumber);
      const customerName = text(data.customerName || sale.customerFullName || sale.customerName) || 'CLIENTE VARIOS';

      if (documentType === 'factura' && (customerDocumentType !== 'RUC' || !customerDocumentNumber || customerDocumentNumber.length !== 11)) {
        const error = new Error('Para emitir factura se requiere RUC de 11 digitos');
        error.status = 400;
        throw error;
      }

      const nextResult = await new sql.Request(transaction)
        .input('documentType', sql.NVarChar(20), documentType)
        .input('series', sql.NVarChar(10), series)
        .query(`
          SELECT ISNULL(MAX(documentNumber), 0) + 1 AS nextNumber
          FROM SaleDocuments
          WHERE documentType = @documentType AND series = @series
        `);
      const documentNumber = Number(nextResult.recordset[0].nextNumber);
      const fullNumber = `${series}-${String(documentNumber).padStart(8, '0')}`;

      const documentResult = await new sql.Request(transaction)
        .input('saleId', sql.Int, Number(saleId))
        .input('documentType', sql.NVarChar(20), documentType)
        .input('series', sql.NVarChar(10), series)
        .input('documentNumber', sql.Int, documentNumber)
        .input('fullNumber', sql.NVarChar(30), fullNumber)
        .input('issueDate', sql.Date, data.issueDate || new Date())
        .input('currency', sql.NVarChar(10), data.currency || 'PEN')
        .input('customerDocumentType', sql.NVarChar(30), customerDocumentType)
        .input('customerDocumentNumber', sql.NVarChar(30), customerDocumentNumber)
        .input('customerName', sql.NVarChar(180), customerName)
        .input('customerAddress', sql.NVarChar(250), text(data.customerAddress || sale.customerAddress))
        .input('subtotal', sql.Decimal(18, 2), sale.subtotal)
        .input('taxTotal', sql.Decimal(18, 2), sale.taxTotal)
        .input('total', sql.Decimal(18, 2), sale.total)
        .query(`
          INSERT INTO SaleDocuments
            (saleId, documentType, series, documentNumber, fullNumber, issueDate, currency,
             customerDocumentType, customerDocumentNumber, customerName, customerAddress,
             subtotal, taxTotal, total)
          OUTPUT INSERTED.*
          VALUES
            (@saleId, @documentType, @series, @documentNumber, @fullNumber, @issueDate, @currency,
             @customerDocumentType, @customerDocumentNumber, @customerName, @customerAddress,
             @subtotal, @taxTotal, @total)
        `);

      await transaction.commit();
      return documentResult.recordset[0];
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async getSaleDocument(documentId, locationId = null) {
    const pool = await poolPromise;
    const documentResult = await pool.request()
      .input('documentId', sql.Int, Number(documentId))
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
        SELECT sd.*
        FROM SaleDocuments sd
        INNER JOIN SaleHeaders sh ON sh.id = sd.saleId
        WHERE sd.id = @documentId
          AND (@locationId IS NULL OR sh.locationId = @locationId)
      `);
    const document = documentResult.recordset[0];
    if (!document) {
      const error = new Error('Comprobante no encontrado');
      error.status = 404;
      throw error;
    }

    const saleData = await InventoryModel.getSale(document.saleId, locationId);
    return {
      document,
      sale: saleData.header,
      details: saleData.details,
    };
  }

  static async listKardex(locationId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('locationId', sql.Int, nullableInt(locationId))
      .query(`
        SELECT m.id, m.createdAt, m.movementType, m.quantity, m.sourceType, m.sourceId, m.notes,
               p.sku, p.name AS productName, p.type AS productType, v.sku AS variantSku,
               v.displayName AS variantName, l.name AS locationName, sh.name AS shelfName
        FROM InventoryMovements m
        INNER JOIN Products p ON p.id = m.productId
        LEFT JOIN ProductVariants v ON v.id = m.variantId
        INNER JOIN InventoryLocations l ON l.id = m.locationId
        LEFT JOIN Shelves sh ON sh.id = m.shelfId
        WHERE @locationId IS NULL OR m.locationId = @locationId
        ORDER BY m.createdAt DESC, m.id DESC
      `);
    return result.recordset;
  }

  static async closeSale(id, data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const saleResult = await new sql.Request(transaction)
        .input('id', sql.Int, Number(id))
        .query('SELECT * FROM SaleHeaders WHERE id = @id');
      const sale = saleResult.recordset[0];
      if (!sale) {
        const error = new Error('Venta no encontrada');
        error.status = 404;
        throw error;
      }
      if (sale.status === 'cerrada') {
        const error = new Error('La venta ya esta cerrada');
        error.status = 400;
        throw error;
      }
      const detailsResult = await new sql.Request(transaction)
        .input('saleId', sql.Int, Number(id))
        .query('SELECT * FROM SaleDetails WHERE saleId = @saleId');
      const productTypes = await InventoryModel.productTypeMap(transaction, detailsResult.recordset);

      for (const item of detailsResult.recordset) {
        if (isServiceType(productTypes.get(Number(item.productId)))) continue;
        const current = await InventoryModel.getStock(transaction, item.productId, item.variantId, data.locationId, nullableInt(data.shelfId));
        if (Number(current) < Number(item.quantity)) {
          const error = new Error('Stock insuficiente para cerrar la venta');
          error.status = 400;
          throw error;
        }
      }

      await new sql.Request(transaction)
        .input('id', sql.Int, Number(id))
        .input('locationId', sql.Int, Number(data.locationId))
        .input('shelfId', sql.Int, nullableInt(data.shelfId))
        .input('documentNumber', sql.NVarChar(80), data.documentNumber || sale.documentNumber)
        .input('notes', sql.NVarChar(500), data.notes || sale.notes || null)
        .query(`
          UPDATE SaleHeaders
          SET status = 'cerrada', locationId = @locationId, shelfId = @shelfId,
              documentNumber = @documentNumber, notes = @notes, saleDate = CONVERT(date, GETDATE())
          WHERE id = @id
        `);

      for (const item of detailsResult.recordset) {
        if (isServiceType(productTypes.get(Number(item.productId)))) continue;
        await InventoryModel.addStock(transaction, item.productId, item.variantId, data.locationId, nullableInt(data.shelfId), Number(item.quantity) * -1);
        await InventoryModel.insertMovement(transaction, item.productId, item.variantId, data.locationId, nullableInt(data.shelfId), 'salida', Number(item.quantity), 'venta', Number(id), data.notes || sale.notes || null);
      }

      await transaction.commit();
      return { closed: true };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async createSale(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const productTypes = await InventoryModel.productTypeMap(transaction, data.details);
      for (const item of data.details) {
        if (isServiceType(productTypes.get(Number(item.productId)))) continue;
        const current = await InventoryModel.getStock(transaction, item.productId, item.variantId, data.locationId, nullableInt(data.shelfId));
        if (Number(current) < Number(item.quantity)) {
          const error = new Error('Stock insuficiente para uno o mas productos');
          error.status = 400;
          throw error;
        }
      }

      const totals = data.details.reduce((acc, item) => {
        const line = taxableLine(Number(item.quantity), Number(item.unitPrice || 0), item.affectsTax);
        return {
          subtotal: acc.subtotal + line.subtotal,
          taxTotal: acc.taxTotal + line.taxAmount,
          total: acc.total + line.total,
        };
      }, { subtotal: 0, taxTotal: 0, total: 0 });
      const header = await new sql.Request(transaction)
        .input('customerId', sql.Int, nullableInt(data.customerId))
        .input('customerName', sql.NVarChar(150), data.customerName || null)
        .input('sellerId', sql.Int, nullableInt(data.sellerId))
        .input('locationId', sql.Int, Number(data.locationId))
        .input('shelfId', sql.Int, nullableInt(data.shelfId))
        .input('documentNumber', sql.NVarChar(80), data.documentNumber || null)
        .input('saleDate', sql.Date, data.saleDate || new Date())
        .input('notes', sql.NVarChar(500), data.notes || null)
        .input('subtotal', sql.Decimal(18, 2), totals.subtotal)
        .input('taxTotal', sql.Decimal(18, 2), totals.taxTotal)
        .input('total', sql.Decimal(18, 2), totals.total)
        .query(`
          INSERT INTO SaleHeaders (customerName, customerId, sellerId, saleType, status, locationId, shelfId, documentNumber, saleDate, notes, subtotal, taxTotal, total)
          OUTPUT INSERTED.*
          VALUES (@customerName, @customerId, @sellerId, 'directa', 'cerrada', @locationId, @shelfId, @documentNumber, @saleDate, @notes, @subtotal, @taxTotal, @total)
        `);
      const sale = header.recordset[0];

      for (const item of data.details) {
        await InventoryModel.insertSaleDetail(transaction, sale.id, item);
        if (isServiceType(productTypes.get(Number(item.productId)))) continue;
        await InventoryModel.addStock(transaction, item.productId, item.variantId, data.locationId, nullableInt(data.shelfId), Number(item.quantity) * -1);
        await InventoryModel.insertMovement(transaction, item.productId, item.variantId, data.locationId, nullableInt(data.shelfId), 'salida', Number(item.quantity), 'venta', sale.id, data.notes || null);
      }

      await transaction.commit();
      return sale;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async insertPurchaseDetail(transaction, purchaseId, item) {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost || 0);
    await new sql.Request(transaction)
      .input('purchaseId', sql.Int, purchaseId)
      .input('productId', sql.Int, Number(item.productId))
      .input('variantId', sql.Int, nullableInt(item.variantId))
      .input('quantity', sql.Decimal(18, 2), quantity)
      .input('unitCost', sql.Decimal(18, 2), unitCost)
      .input('subtotal', sql.Decimal(18, 2), quantity * unitCost)
      .query(`
        INSERT INTO PurchaseDetails (purchaseId, productId, variantId, quantity, unitCost, subtotal)
        VALUES (@purchaseId, @productId, @variantId, @quantity, @unitCost, @subtotal)
      `);
  }

  static async insertTransferDetail(transaction, transferId, item) {
    await new sql.Request(transaction)
      .input('transferId', sql.Int, transferId)
      .input('productId', sql.Int, Number(item.productId))
      .input('variantId', sql.Int, nullableInt(item.variantId))
      .input('quantity', sql.Decimal(18, 2), Number(item.quantity))
      .query(`
        INSERT INTO TransferDetails (transferId, productId, variantId, quantity)
        VALUES (@transferId, @productId, @variantId, @quantity)
      `);
  }

  static async insertSaleDetail(transaction, saleId, item) {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice || 0);
    const listPrice = Number(item.listPrice ?? item.unitPrice ?? 0);
    const affectsTax = bit(item.affectsTax);
    const taxRate = 18;
    const line = taxableLine(quantity, unitPrice, affectsTax);
    await new sql.Request(transaction)
      .input('saleId', sql.Int, saleId)
      .input('productId', sql.Int, Number(item.productId))
      .input('variantId', sql.Int, nullableInt(item.variantId))
      .input('productDescription', sql.NVarChar(500), item.productDescription || null)
      .input('detailNotes', sql.NVarChar(sql.MAX), text(item.detailNotes))
      .input('unit', sql.NVarChar(30), item.unit || 'unidad')
      .input('quantity', sql.Decimal(18, 2), quantity)
      .input('listPrice', sql.Decimal(18, 2), listPrice)
      .input('unitPrice', sql.Decimal(18, 2), unitPrice)
      .input('affectsTax', sql.Bit, affectsTax)
      .input('taxRate', sql.Decimal(5, 2), taxRate)
      .input('subtotal', sql.Decimal(18, 2), line.subtotal)
      .input('taxAmount', sql.Decimal(18, 2), line.taxAmount)
      .input('total', sql.Decimal(18, 2), line.total)
      .query(`
        INSERT INTO SaleDetails
          (saleId, productId, variantId, productDescription, detailNotes, unit, quantity, listPrice, unitPrice, affectsTax, taxRate, subtotal, taxAmount, total)
        VALUES
          (@saleId, @productId, @variantId, @productDescription, @detailNotes, @unit, @quantity, @listPrice, @unitPrice, @affectsTax, @taxRate, @subtotal, @taxAmount, @total)
      `);
  }

  static async getStock(transaction, productId, variantId, locationId, shelfId) {
    const result = await new sql.Request(transaction)
      .input('productId', sql.Int, Number(productId))
      .input('variantId', sql.Int, nullableInt(variantId))
      .input('locationId', sql.Int, Number(locationId))
      .input('shelfId', sql.Int, nullableInt(shelfId))
      .query(`
        SELECT quantity FROM InventoryStock
        WHERE productId = @productId AND locationId = @locationId
          AND ((variantId IS NULL AND @variantId IS NULL) OR variantId = @variantId)
          AND ((shelfId IS NULL AND @shelfId IS NULL) OR shelfId = @shelfId)
      `);
    return result.recordset[0]?.quantity || 0;
  }

  static async addStock(transaction, productId, variantId, locationId, shelfId, quantity) {
    await new sql.Request(transaction)
      .input('productId', sql.Int, Number(productId))
      .input('variantId', sql.Int, nullableInt(variantId))
      .input('locationId', sql.Int, Number(locationId))
      .input('shelfId', sql.Int, nullableInt(shelfId))
      .input('quantity', sql.Decimal(18, 2), quantity)
      .query(`
        MERGE InventoryStock AS target
        USING (SELECT @productId AS productId, @variantId AS variantId, @locationId AS locationId, @shelfId AS shelfId) AS source
        ON target.productId = source.productId
          AND ((target.variantId IS NULL AND source.variantId IS NULL) OR target.variantId = source.variantId)
          AND target.locationId = source.locationId
          AND ((target.shelfId IS NULL AND source.shelfId IS NULL) OR target.shelfId = source.shelfId)
        WHEN MATCHED THEN
          UPDATE SET quantity = target.quantity + @quantity, updatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (productId, variantId, locationId, shelfId, quantity)
          VALUES (@productId, @variantId, @locationId, @shelfId, @quantity);
      `);
  }

  static async insertMovement(transaction, productId, variantId, locationId, shelfId, movementType, quantity, sourceType, sourceId, notes) {
    await new sql.Request(transaction)
      .input('productId', sql.Int, Number(productId))
      .input('variantId', sql.Int, nullableInt(variantId))
      .input('locationId', sql.Int, Number(locationId))
      .input('shelfId', sql.Int, nullableInt(shelfId))
      .input('movementType', sql.NVarChar(20), movementType)
      .input('quantity', sql.Decimal(18, 2), quantity)
      .input('sourceType', sql.NVarChar(30), sourceType)
      .input('sourceId', sql.Int, sourceId)
      .input('notes', sql.NVarChar(500), notes)
      .query(`
        INSERT INTO InventoryMovements (productId, variantId, locationId, shelfId, movementType, quantity, sourceType, sourceId, notes)
        VALUES (@productId, @variantId, @locationId, @shelfId, @movementType, @quantity, @sourceType, @sourceId, @notes)
      `);
  }
}

module.exports = InventoryModel;
