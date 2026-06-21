-- Schema POS para SQL Server.
-- Ejecutar despues de db/schemaInv.sql sobre la base del cliente.

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.Users', 'U') IS NULL
  THROW 51000, 'Falta dbo.Users. Ejecuta primero db/schema.sql y db/schemaInv.sql.', 1;
GO

IF OBJECT_ID('dbo.Products', 'U') IS NULL
  THROW 51000, 'Falta dbo.Products. Ejecuta primero db/schemaInv.sql.', 1;
GO

IF OBJECT_ID('dbo.InventoryLocations', 'U') IS NULL
  THROW 51000, 'Falta dbo.InventoryLocations. Ejecuta primero db/schemaInv.sql.', 1;
GO

IF OBJECT_ID('dbo.Customers', 'U') IS NULL
  THROW 51000, 'Falta dbo.Customers. Ejecuta primero db/schemaInv.sql.', 1;
GO

IF OBJECT_ID('dbo.ProductVariants', 'U') IS NULL
  THROW 51000, 'Falta dbo.ProductVariants. Ejecuta primero db/schemaInv.sql.', 1;
GO

IF OBJECT_ID('dbo.PaymentMethods', 'U') IS NULL
  THROW 51000, 'Falta dbo.PaymentMethods. Ejecuta primero db/schemaInv.sql.', 1;
GO

IF OBJECT_ID('dbo.InventoryMovements', 'U') IS NULL
  THROW 51000, 'Falta dbo.InventoryMovements. Ejecuta primero db/schemaInv.sql.', 1;
GO

IF OBJECT_ID('dbo.AppModuleDomains', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AppModuleDomains (
    id INT IDENTITY(1,1) PRIMARY KEY,
    domain NVARCHAR(180) NOT NULL,
    moduleCode NVARCHAR(40) NOT NULL,
    displayName NVARCHAR(120) NULL,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_AppModuleDomains_Module CHECK (moduleCode IN ('inventory', 'pos')),
    CONSTRAINT UQ_AppModuleDomains_Domain_Module UNIQUE (domain, moduleCode)
  );
END
GO

IF OBJECT_ID('dbo.PosReceiptSequences', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosReceiptSequences (
    id INT IDENTITY(1,1) PRIMARY KEY,
    locationId INT NOT NULL,
    documentType NVARCHAR(20) NOT NULL DEFAULT 'ticket',
    series NVARCHAR(10) NOT NULL,
    currentNumber INT NOT NULL DEFAULT 0,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosReceiptSequences_Locations FOREIGN KEY (locationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT CK_PosReceiptSequences_Type CHECK (documentType IN ('ticket', 'boleta', 'factura')),
    CONSTRAINT UQ_PosReceiptSequences_Location_Type_Series UNIQUE (locationId, documentType, series)
  );
END
GO

IF OBJECT_ID('dbo.PosTerminals', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosTerminals (
    id INT IDENTITY(1,1) PRIMARY KEY,
    locationId INT NOT NULL,
    name NVARCHAR(120) NOT NULL,
    code NVARCHAR(50) NOT NULL,
    receiptSeries NVARCHAR(10) NULL,
    defaultPaymentMethodId INT NULL,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosTerminals_Locations FOREIGN KEY (locationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT FK_PosTerminals_DefaultPaymentMethod FOREIGN KEY (defaultPaymentMethodId) REFERENCES dbo.PaymentMethods(id),
    CONSTRAINT UQ_PosTerminals_Code UNIQUE (code)
  );
END
GO

IF OBJECT_ID('dbo.PosShifts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosShifts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    terminalId INT NOT NULL,
    locationId INT NOT NULL,
    openedByUserId INT NOT NULL,
    closedByUserId INT NULL,
    openedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    closedAt DATETIME2 NULL,
    openingCash DECIMAL(18,2) NOT NULL DEFAULT 0,
    expectedCash DECIMAL(18,2) NOT NULL DEFAULT 0,
    countedCash DECIMAL(18,2) NULL,
    cashDifference DECIMAL(18,2) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'open',
    notes NVARCHAR(500) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosShifts_Terminals FOREIGN KEY (terminalId) REFERENCES dbo.PosTerminals(id),
    CONSTRAINT FK_PosShifts_Locations FOREIGN KEY (locationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT FK_PosShifts_OpenedBy FOREIGN KEY (openedByUserId) REFERENCES dbo.Users(id),
    CONSTRAINT FK_PosShifts_ClosedBy FOREIGN KEY (closedByUserId) REFERENCES dbo.Users(id),
    CONSTRAINT CK_PosShifts_Status CHECK (status IN ('open', 'closed', 'cancelled'))
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UX_PosShifts_Terminal_Open' AND object_id = OBJECT_ID('dbo.PosShifts')
)
BEGIN
  CREATE UNIQUE INDEX UX_PosShifts_Terminal_Open ON dbo.PosShifts(terminalId) WHERE status = 'open';
END
GO

IF OBJECT_ID('dbo.PosSales', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosSales (
    id INT IDENTITY(1,1) PRIMARY KEY,
    shiftId INT NOT NULL,
    terminalId INT NOT NULL,
    locationId INT NOT NULL,
    customerId INT NULL,
    customerNameSnapshot NVARCHAR(180) NULL,
    customerPhone NVARCHAR(50) NULL,
    sellerId INT NOT NULL,
    receiptType NVARCHAR(20) NOT NULL DEFAULT 'boleta',
    receiptSeries NVARCHAR(10) NULL,
    receiptNumber INT NULL,
    receiptFullNumber NVARCHAR(30) NULL,
    saleDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    currency NVARCHAR(10) NOT NULL DEFAULT 'PEN',
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    discountTotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    taxTotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    paidTotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    changeAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    status NVARCHAR(20) NOT NULL DEFAULT 'paid',
    inventorySaleId INT NULL,
    authorizedByUserId INT NULL,
    notes NVARCHAR(500) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosSales_Shifts FOREIGN KEY (shiftId) REFERENCES dbo.PosShifts(id),
    CONSTRAINT FK_PosSales_Terminals FOREIGN KEY (terminalId) REFERENCES dbo.PosTerminals(id),
    CONSTRAINT FK_PosSales_Locations FOREIGN KEY (locationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT FK_PosSales_Customers FOREIGN KEY (customerId) REFERENCES dbo.Customers(id),
    CONSTRAINT FK_PosSales_Sellers FOREIGN KEY (sellerId) REFERENCES dbo.Users(id),
    CONSTRAINT FK_PosSales_AuthorizedBy FOREIGN KEY (authorizedByUserId) REFERENCES dbo.Users(id),
    CONSTRAINT CK_PosSales_ReceiptType CHECK (receiptType IN ('ticket', 'boleta', 'factura')),
    CONSTRAINT CK_PosSales_Status CHECK (status IN ('draft', 'paid', 'voided', 'refunded', 'partial_refund'))
  );
END
GO

IF OBJECT_ID('dbo.PosSales', 'U') IS NOT NULL AND COL_LENGTH('dbo.PosSales', 'inventorySaleId') IS NULL
BEGIN
  ALTER TABLE dbo.PosSales ADD inventorySaleId INT NULL;
END
GO

IF OBJECT_ID('dbo.PosSales', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.SaleHeaders', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PosSales_InventorySale')
BEGIN
  ALTER TABLE dbo.PosSales
  ADD CONSTRAINT FK_PosSales_InventorySale FOREIGN KEY (inventorySaleId) REFERENCES dbo.SaleHeaders(id);
END
GO

IF OBJECT_ID('dbo.PosSales', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PosSales_InventorySaleId' AND object_id = OBJECT_ID('dbo.PosSales'))
BEGIN
  CREATE UNIQUE INDEX UX_PosSales_InventorySaleId ON dbo.PosSales(inventorySaleId) WHERE inventorySaleId IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.PosSales', 'U') IS NOT NULL AND COL_LENGTH('dbo.PosSales', 'customerNameSnapshot') IS NULL
BEGIN
  ALTER TABLE dbo.PosSales ADD customerNameSnapshot NVARCHAR(180) NULL;
END
GO

IF OBJECT_ID('dbo.PosSales', 'U') IS NOT NULL AND COL_LENGTH('dbo.PosSales', 'customerPhone') IS NULL
BEGIN
  ALTER TABLE dbo.PosSales ADD customerPhone NVARCHAR(50) NULL;
END
GO

IF OBJECT_ID('dbo.PosSales', 'U') IS NOT NULL
BEGIN
  DECLARE @receiptTypeDefault NVARCHAR(128);

  SELECT @receiptTypeDefault = dc.name
  FROM sys.default_constraints dc
  INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.PosSales')
    AND c.name = 'receiptType';

  IF @receiptTypeDefault IS NOT NULL
  BEGIN
    DECLARE @dropReceiptTypeDefaultSql NVARCHAR(MAX);
    SET @dropReceiptTypeDefaultSql = N'ALTER TABLE dbo.PosSales DROP CONSTRAINT ' + QUOTENAME(@receiptTypeDefault);
    EXEC sp_executesql @dropReceiptTypeDefaultSql;
  END;

  ALTER TABLE dbo.PosSales ADD CONSTRAINT DF_PosSales_ReceiptType DEFAULT 'boleta' FOR receiptType;
END
GO

IF OBJECT_ID('dbo.PosSales', 'U') IS NOT NULL AND OBJECT_ID('dbo.PosReceiptSequences', 'U') IS NOT NULL
BEGIN
  MERGE dbo.PosReceiptSequences AS target
  USING (
    SELECT locationId, receiptType AS documentType, receiptSeries AS series, MAX(receiptNumber) AS currentNumber
    FROM dbo.PosSales
    WHERE receiptFullNumber IS NOT NULL
      AND receiptSeries IS NOT NULL
      AND receiptNumber IS NOT NULL
    GROUP BY locationId, receiptType, receiptSeries
  ) AS source
  ON target.locationId = source.locationId
    AND target.documentType = source.documentType
    AND target.series = source.series
  WHEN MATCHED AND target.currentNumber < source.currentNumber THEN
    UPDATE SET currentNumber = source.currentNumber,
               updatedAt = SYSUTCDATETIME()
  WHEN NOT MATCHED THEN
    INSERT (locationId, documentType, series, currentNumber)
    VALUES (source.locationId, source.documentType, source.series, source.currentNumber);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UX_PosSales_ReceiptFullNumber' AND object_id = OBJECT_ID('dbo.PosSales')
)
BEGIN
  CREATE UNIQUE INDEX UX_PosSales_ReceiptFullNumber ON dbo.PosSales(receiptFullNumber) WHERE receiptFullNumber IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.PosSaleItems', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosSaleItems (
    id INT IDENTITY(1,1) PRIMARY KEY,
    saleId INT NOT NULL,
    productId INT NOT NULL,
    variantId INT NULL,
    productDescription NVARCHAR(500) NOT NULL,
    unit NVARCHAR(30) NOT NULL DEFAULT 'unidad',
    quantity DECIMAL(18,2) NOT NULL,
    unitPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    discountAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    affectsTax BIT NOT NULL DEFAULT 1,
    taxRate DECIMAL(5,2) NOT NULL DEFAULT 18,
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    taxAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    inventoryMovementId INT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosSaleItems_Sales FOREIGN KEY (saleId) REFERENCES dbo.PosSales(id) ON DELETE CASCADE,
    CONSTRAINT FK_PosSaleItems_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id),
    CONSTRAINT FK_PosSaleItems_Variants FOREIGN KEY (variantId) REFERENCES dbo.ProductVariants(id),
    CONSTRAINT FK_PosSaleItems_Movements FOREIGN KEY (inventoryMovementId) REFERENCES dbo.InventoryMovements(id)
  );
END
GO

IF OBJECT_ID('dbo.PosSalePayments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosSalePayments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    saleId INT NOT NULL,
    paymentMethodId INT NULL,
    methodName NVARCHAR(120) NOT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    referenceNumber NVARCHAR(120) NULL,
    voucherImageUrl NVARCHAR(500) NULL,
    paidAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosSalePayments_Sales FOREIGN KEY (saleId) REFERENCES dbo.PosSales(id) ON DELETE CASCADE,
    CONSTRAINT FK_PosSalePayments_Methods FOREIGN KEY (paymentMethodId) REFERENCES dbo.PaymentMethods(id)
  );
END
GO

IF OBJECT_ID('dbo.PosSalePayments', 'U') IS NOT NULL AND COL_LENGTH('dbo.PosSalePayments', 'voucherImageUrl') IS NULL
BEGIN
  ALTER TABLE dbo.PosSalePayments ADD voucherImageUrl NVARCHAR(500) NULL;
END
GO

IF OBJECT_ID('dbo.PosCashMovements', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosCashMovements (
    id INT IDENTITY(1,1) PRIMARY KEY,
    shiftId INT NOT NULL,
    userId INT NOT NULL,
    movementType NVARCHAR(20) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    reason NVARCHAR(250) NOT NULL,
    referenceType NVARCHAR(40) NULL,
    referenceId INT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosCashMovements_Shifts FOREIGN KEY (shiftId) REFERENCES dbo.PosShifts(id),
    CONSTRAINT FK_PosCashMovements_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id),
    CONSTRAINT CK_PosCashMovements_Type CHECK (movementType IN ('opening', 'income', 'expense', 'withdrawal', 'adjustment'))
  );
END
GO

IF COL_LENGTH('dbo.PosCashMovements', 'authorizedByUserId') IS NULL
  ALTER TABLE dbo.PosCashMovements ADD authorizedByUserId INT NULL;
GO

IF COL_LENGTH('dbo.PosCashMovements', 'authorizedAt') IS NULL
  ALTER TABLE dbo.PosCashMovements ADD authorizedAt DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PosCashMovements_AuthorizedBy')
  ALTER TABLE dbo.PosCashMovements
  ADD CONSTRAINT FK_PosCashMovements_AuthorizedBy FOREIGN KEY (authorizedByUserId) REFERENCES dbo.Users(id);
GO

IF OBJECT_ID('dbo.PosReturns', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosReturns (
    id INT IDENTITY(1,1) PRIMARY KEY,
    saleId INT NOT NULL,
    shiftId INT NOT NULL,
    userId INT NOT NULL,
    returnDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    reason NVARCHAR(300) NOT NULL,
    refundAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    status NVARCHAR(20) NOT NULL DEFAULT 'completed',
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosReturns_Sales FOREIGN KEY (saleId) REFERENCES dbo.PosSales(id),
    CONSTRAINT FK_PosReturns_Shifts FOREIGN KEY (shiftId) REFERENCES dbo.PosShifts(id),
    CONSTRAINT FK_PosReturns_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id),
    CONSTRAINT CK_PosReturns_Status CHECK (status IN ('completed', 'cancelled'))
  );
END
GO

IF OBJECT_ID('dbo.PosReturnItems', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosReturnItems (
    id INT IDENTITY(1,1) PRIMARY KEY,
    returnId INT NOT NULL,
    saleItemId INT NOT NULL,
    productId INT NOT NULL,
    variantId INT NULL,
    quantity DECIMAL(18,2) NOT NULL,
    refundAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    inventoryMovementId INT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosReturnItems_Returns FOREIGN KEY (returnId) REFERENCES dbo.PosReturns(id) ON DELETE CASCADE,
    CONSTRAINT FK_PosReturnItems_SaleItems FOREIGN KEY (saleItemId) REFERENCES dbo.PosSaleItems(id),
    CONSTRAINT FK_PosReturnItems_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id),
    CONSTRAINT FK_PosReturnItems_Variants FOREIGN KEY (variantId) REFERENCES dbo.ProductVariants(id),
    CONSTRAINT FK_PosReturnItems_Movements FOREIGN KEY (inventoryMovementId) REFERENCES dbo.InventoryMovements(id)
  );
END
GO

IF OBJECT_ID('dbo.PosShiftClosures', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PosShiftClosures (
    id INT IDENTITY(1,1) PRIMARY KEY,
    shiftId INT NOT NULL,
    closedByUserId INT NOT NULL,
    grossSales DECIMAL(18,2) NOT NULL DEFAULT 0,
    discounts DECIMAL(18,2) NOT NULL DEFAULT 0,
    refunds DECIMAL(18,2) NOT NULL DEFAULT 0,
    netSales DECIMAL(18,2) NOT NULL DEFAULT 0,
    cashSales DECIMAL(18,2) NOT NULL DEFAULT 0,
    nonCashSales DECIMAL(18,2) NOT NULL DEFAULT 0,
    manualIncome DECIMAL(18,2) NOT NULL DEFAULT 0,
    manualExpense DECIMAL(18,2) NOT NULL DEFAULT 0,
    expectedCash DECIMAL(18,2) NOT NULL DEFAULT 0,
    countedCash DECIMAL(18,2) NOT NULL DEFAULT 0,
    cashDifference DECIMAL(18,2) NOT NULL DEFAULT 0,
    notes NVARCHAR(500) NULL,
    closedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PosShiftClosures_Shifts FOREIGN KEY (shiftId) REFERENCES dbo.PosShifts(id),
    CONSTRAINT FK_PosShiftClosures_Users FOREIGN KEY (closedByUserId) REFERENCES dbo.Users(id),
    CONSTRAINT UQ_PosShiftClosures_Shift UNIQUE (shiftId)
  );
END
GO

IF COL_LENGTH('dbo.PosShiftClosures', 'authorizedByUserId') IS NULL
  ALTER TABLE dbo.PosShiftClosures ADD authorizedByUserId INT NULL;
GO

IF COL_LENGTH('dbo.PosShiftClosures', 'authorizedAt') IS NULL
  ALTER TABLE dbo.PosShiftClosures ADD authorizedAt DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PosShiftClosures_AuthorizedBy')
  ALTER TABLE dbo.PosShiftClosures
  ADD CONSTRAINT FK_PosShiftClosures_AuthorizedBy FOREIGN KEY (authorizedByUserId) REFERENCES dbo.Users(id);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AppModuleDomains WHERE domain = 'inventarios.soluciones-galera.com' AND moduleCode = 'inventory')
  INSERT INTO dbo.AppModuleDomains (domain, moduleCode, displayName)
  VALUES ('inventarios.soluciones-galera.com', 'inventory', 'Inventarios');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AppModuleDomains WHERE domain = 'pos.soluciones-galera.com' AND moduleCode = 'pos')
  INSERT INTO dbo.AppModuleDomains (domain, moduleCode, displayName)
  VALUES ('pos.soluciones-galera.com', 'pos', 'POS');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AppModuleDomains WHERE domain = 'invenpos.soluciones-galera.com' AND moduleCode = 'inventory')
  INSERT INTO dbo.AppModuleDomains (domain, moduleCode, displayName)
  VALUES ('invenpos.soluciones-galera.com', 'inventory', 'Inventarios');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AppModuleDomains WHERE domain = 'invenpos.soluciones-galera.com' AND moduleCode = 'pos')
  INSERT INTO dbo.AppModuleDomains (domain, moduleCode, displayName)
  VALUES ('invenpos.soluciones-galera.com', 'pos', 'POS');
GO
