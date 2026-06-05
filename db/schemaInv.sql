-- Schema de inventario para SQL Server.
-- Ejecutar sobre la misma base configurada para el proyecto.

USE BD_TEST_IA;
GO

IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL AND COL_LENGTH('dbo.Users', 'assignedLocationId') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD assignedLocationId INT NULL;
END
GO

IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL AND COL_LENGTH('dbo.Users', 'role') IS NOT NULL
BEGIN
  ALTER TABLE dbo.Users ALTER COLUMN role NVARCHAR(30) NULL;
END
GO

IF OBJECT_ID('dbo.Suppliers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Suppliers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(150) NOT NULL,
    contactName NVARCHAR(120) NULL,
    phone NVARCHAR(50) NULL,
    email NVARCHAR(150) NULL,
    address NVARCHAR(250) NULL,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.InventoryLocations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryLocations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(150) NOT NULL,
    type NVARCHAR(30) NOT NULL DEFAULT 'almacen',
    address NVARCHAR(250) NULL,
    description NVARCHAR(250) NULL,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_InventoryLocations_Type CHECK (type IN ('tienda', 'almacen', 'otro'))
  );
END
GO

IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_Users_AssignedLocation'
)
BEGIN
  ALTER TABLE dbo.Users
  ADD CONSTRAINT FK_Users_AssignedLocation
  FOREIGN KEY (assignedLocationId) REFERENCES dbo.InventoryLocations(id);
END
GO

IF OBJECT_ID('dbo.Shelves', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Shelves (
    id INT IDENTITY(1,1) PRIMARY KEY,
    locationId INT NOT NULL,
    name NVARCHAR(120) NOT NULL,
    code NVARCHAR(50) NULL,
    description NVARCHAR(250) NULL,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Shelves_Locations FOREIGN KEY (locationId) REFERENCES dbo.InventoryLocations(id)
  );
END
GO

IF OBJECT_ID('dbo.Products', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sku NVARCHAR(60) NOT NULL UNIQUE,
    name NVARCHAR(180) NOT NULL,
    type NVARCHAR(60) NOT NULL DEFAULT 'otros',
    model NVARCHAR(120) NULL,
    description NVARCHAR(500) NULL,
    imageUrl NVARCHAR(500) NULL,
    attributesJson NVARCHAR(MAX) NULL,
    supplierId INT NULL,
    unit NVARCHAR(30) NOT NULL DEFAULT 'unidad',
    minStock DECIMAL(18,2) NOT NULL DEFAULT 0,
    costPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    salePrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Products_Suppliers FOREIGN KEY (supplierId) REFERENCES dbo.Suppliers(id)
  );
END
GO

IF COL_LENGTH('dbo.Products', 'model') IS NULL
BEGIN
  ALTER TABLE dbo.Products ADD model NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.Products', 'attributesJson') IS NULL
BEGIN
  ALTER TABLE dbo.Products ADD attributesJson NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.Products', 'affectsTax') IS NULL
BEGIN
  ALTER TABLE dbo.Products ADD affectsTax BIT NOT NULL CONSTRAINT DF_Products_AffectsTax DEFAULT 1;
END
GO

IF OBJECT_ID('dbo.ProductVariables', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductVariables (
    id INT IDENTITY(1,1) PRIMARY KEY,
    productId INT NOT NULL,
    name NVARCHAR(120) NOT NULL,
    value NVARCHAR(250) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ProductVariables_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.Customers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Customers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    documentType NVARCHAR(30) NULL,
    documentNumber NVARCHAR(30) NULL,
    name NVARCHAR(180) NOT NULL,
    phone NVARCHAR(50) NULL,
    email NVARCHAR(150) NULL,
    address NVARCHAR(250) NULL,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.QuotationHeaders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.QuotationHeaders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    quotationNumber NVARCHAR(20) NOT NULL UNIQUE,
    quotationDate DATE NOT NULL DEFAULT CONVERT(date, GETDATE()),
    currency NVARCHAR(10) NOT NULL DEFAULT 'PEN',
    customerId INT NOT NULL,
    sellerId INT NOT NULL,
    paymentMethod NVARCHAR(80) NULL,
    deliveryDate DATE NULL,
    deliveryMethod NVARCHAR(120) NULL,
    comments NVARCHAR(500) NULL,
    status NVARCHAR(30) NOT NULL DEFAULT 'emitida',
    approvedAt DATETIME2 NULL,
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    taxTotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Quotations_Customers FOREIGN KEY (customerId) REFERENCES dbo.Customers(id),
    CONSTRAINT FK_Quotations_Sellers FOREIGN KEY (sellerId) REFERENCES dbo.Users(id)
  );
END
GO

IF COL_LENGTH('dbo.QuotationHeaders', 'status') IS NULL
BEGIN
  ALTER TABLE dbo.QuotationHeaders ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_QuotationHeaders_Status DEFAULT 'emitida';
END
GO

IF COL_LENGTH('dbo.QuotationHeaders', 'approvedAt') IS NULL
BEGIN
  ALTER TABLE dbo.QuotationHeaders ADD approvedAt DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.QuotationHeaders', 'paymentMethod') IS NOT NULL
BEGIN
  ALTER TABLE dbo.QuotationHeaders ALTER COLUMN paymentMethod NVARCHAR(160) NULL;
END
GO

IF OBJECT_ID('dbo.PaymentMethods', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PaymentMethods (
    id INT IDENTITY(1,1) PRIMARY KEY,
    companyName NVARCHAR(150) NOT NULL,
    name NVARCHAR(120) NOT NULL,
    description NVARCHAR(250) NULL,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF COL_LENGTH('dbo.PaymentMethods', 'companyName') IS NULL
BEGIN
  ALTER TABLE dbo.PaymentMethods ADD companyName NVARCHAR(150) NOT NULL CONSTRAINT DF_PaymentMethods_CompanyName DEFAULT 'General';
END
GO

IF OBJECT_ID('dbo.PaymentMethods', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Contado')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Contado', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Transferencia bancaria')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Transferencia bancaria', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Deposito bancario')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Deposito bancario', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Yape')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Yape', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Plin')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Plin', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Tarjeta de debito')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Tarjeta de debito', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Tarjeta de credito')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Tarjeta de credito', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Contra entrega')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Contra entrega', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Credito 7 dias')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Credito 7 dias', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Credito 15 dias')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Credito 15 dias', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Credito 30 dias')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Credito 30 dias', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Pago mixto')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Pago mixto', NULL, 1);
  IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE companyName = 'TEST' AND name = 'Por definir')
    INSERT INTO dbo.PaymentMethods (companyName, name, description, estado) VALUES ('TEST', 'Por definir', NULL, 1);
END
GO

IF OBJECT_ID('dbo.QuotationDetails', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.QuotationDetails (
    id INT IDENTITY(1,1) PRIMARY KEY,
    quotationId INT NOT NULL,
    productId INT NOT NULL,
    variantId INT NULL,
    productDescription NVARCHAR(500) NOT NULL,
    unit NVARCHAR(30) NOT NULL DEFAULT 'unidad',
    quantity DECIMAL(18,2) NOT NULL,
    listPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    unitPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    affectsTax BIT NOT NULL DEFAULT 1,
    taxRate DECIMAL(5,2) NOT NULL DEFAULT 18,
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    taxAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT FK_QuotationDetails_Headers FOREIGN KEY (quotationId) REFERENCES dbo.QuotationHeaders(id) ON DELETE CASCADE,
    CONSTRAINT FK_QuotationDetails_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id)
  );
END
GO

IF COL_LENGTH('dbo.QuotationDetails', 'variantId') IS NULL ALTER TABLE dbo.QuotationDetails ADD variantId INT NULL;
GO

IF OBJECT_ID('dbo.ProductCharacteristicValues', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductCharacteristicValues (
    id INT IDENTITY(1,1) PRIMARY KEY,
    characteristicId INT NOT NULL,
    value NVARCHAR(120) NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.ProductCharacteristics', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductCharacteristics (
    id INT IDENTITY(1,1) PRIMARY KEY,
    productId INT NOT NULL,
    name NVARCHAR(120) NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ProductCharacteristics_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_ProductCharacteristicValues_Characteristics'
)
BEGIN
  ALTER TABLE dbo.ProductCharacteristicValues
  ADD CONSTRAINT FK_ProductCharacteristicValues_Characteristics
  FOREIGN KEY (characteristicId) REFERENCES dbo.ProductCharacteristics(id) ON DELETE CASCADE;
END
GO

IF OBJECT_ID('dbo.ProductVariants', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductVariants (
    id INT IDENTITY(1,1) PRIMARY KEY,
    productId INT NOT NULL,
    sku NVARCHAR(100) NULL,
    variantKey NVARCHAR(500) NOT NULL,
    displayName NVARCHAR(500) NOT NULL,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ProductVariants_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UX_ProductVariants_Product_Key' AND object_id = OBJECT_ID('dbo.ProductVariants')
)
BEGIN
  CREATE UNIQUE INDEX UX_ProductVariants_Product_Key ON dbo.ProductVariants(productId, variantKey);
END
GO

IF OBJECT_ID('dbo.ProductVariantValues', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductVariantValues (
    id INT IDENTITY(1,1) PRIMARY KEY,
    variantId INT NOT NULL,
    characteristicName NVARCHAR(120) NOT NULL,
    value NVARCHAR(120) NOT NULL,
    CONSTRAINT FK_ProductVariantValues_Variants FOREIGN KEY (variantId) REFERENCES dbo.ProductVariants(id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.InventoryStock', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryStock (
    id INT IDENTITY(1,1) PRIMARY KEY,
    productId INT NOT NULL,
    variantId INT NULL,
    locationId INT NOT NULL,
    shelfId INT NULL,
    quantity DECIMAL(18,2) NOT NULL DEFAULT 0,
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Stock_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id),
    CONSTRAINT FK_Stock_Variants FOREIGN KEY (variantId) REFERENCES dbo.ProductVariants(id),
    CONSTRAINT FK_Stock_Locations FOREIGN KEY (locationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT FK_Stock_Shelves FOREIGN KEY (shelfId) REFERENCES dbo.Shelves(id)
  );
END
GO

IF COL_LENGTH('dbo.InventoryStock', 'variantId') IS NULL ALTER TABLE dbo.InventoryStock ADD variantId INT NULL;
GO

IF OBJECT_ID('dbo.PurchaseHeaders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PurchaseHeaders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    supplierId INT NULL,
    locationId INT NOT NULL,
    shelfId INT NULL,
    documentNumber NVARCHAR(80) NULL,
    purchaseDate DATE NOT NULL DEFAULT CONVERT(date, GETDATE()),
    notes NVARCHAR(500) NULL,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Purchases_Suppliers FOREIGN KEY (supplierId) REFERENCES dbo.Suppliers(id),
    CONSTRAINT FK_Purchases_Locations FOREIGN KEY (locationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT FK_Purchases_Shelves FOREIGN KEY (shelfId) REFERENCES dbo.Shelves(id)
  );
END
GO

IF OBJECT_ID('dbo.PurchaseDetails', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PurchaseDetails (
    id INT IDENTITY(1,1) PRIMARY KEY,
    purchaseId INT NOT NULL,
    productId INT NOT NULL,
    variantId INT NULL,
    quantity DECIMAL(18,2) NOT NULL,
    unitCost DECIMAL(18,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT FK_PurchaseDetails_Headers FOREIGN KEY (purchaseId) REFERENCES dbo.PurchaseHeaders(id),
    CONSTRAINT FK_PurchaseDetails_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id)
  );
END
GO

IF COL_LENGTH('dbo.PurchaseDetails', 'variantId') IS NULL ALTER TABLE dbo.PurchaseDetails ADD variantId INT NULL;
GO

IF OBJECT_ID('dbo.TransferHeaders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TransferHeaders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sourceLocationId INT NOT NULL,
    sourceShelfId INT NULL,
    targetLocationId INT NOT NULL,
    targetShelfId INT NULL,
    documentNumber NVARCHAR(80) NULL,
    transferDate DATE NOT NULL DEFAULT CONVERT(date, GETDATE()),
    notes NVARCHAR(500) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Transfers_SourceLocation FOREIGN KEY (sourceLocationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT FK_Transfers_SourceShelf FOREIGN KEY (sourceShelfId) REFERENCES dbo.Shelves(id),
    CONSTRAINT FK_Transfers_TargetLocation FOREIGN KEY (targetLocationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT FK_Transfers_TargetShelf FOREIGN KEY (targetShelfId) REFERENCES dbo.Shelves(id)
  );
END
GO

IF OBJECT_ID('dbo.TransferDetails', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TransferDetails (
    id INT IDENTITY(1,1) PRIMARY KEY,
    transferId INT NOT NULL,
    productId INT NOT NULL,
    variantId INT NULL,
    quantity DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_TransferDetails_Headers FOREIGN KEY (transferId) REFERENCES dbo.TransferHeaders(id) ON DELETE CASCADE,
    CONSTRAINT FK_TransferDetails_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id),
    CONSTRAINT FK_TransferDetails_Variants FOREIGN KEY (variantId) REFERENCES dbo.ProductVariants(id)
  );
END
GO

IF OBJECT_ID('dbo.SaleHeaders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SaleHeaders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    customerName NVARCHAR(150) NULL,
    customerId INT NULL,
    sellerId INT NULL,
    quotationId INT NULL,
    saleType NVARCHAR(30) NOT NULL DEFAULT 'directa',
    status NVARCHAR(30) NOT NULL DEFAULT 'cerrada',
    locationId INT NULL,
    shelfId INT NULL,
    documentNumber NVARCHAR(80) NULL,
    saleDate DATE NOT NULL DEFAULT CONVERT(date, GETDATE()),
    notes NVARCHAR(500) NULL,
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    taxTotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Sales_Locations FOREIGN KEY (locationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT FK_Sales_Shelves FOREIGN KEY (shelfId) REFERENCES dbo.Shelves(id),
    CONSTRAINT FK_Sales_Customers FOREIGN KEY (customerId) REFERENCES dbo.Customers(id),
    CONSTRAINT FK_Sales_Sellers FOREIGN KEY (sellerId) REFERENCES dbo.Users(id),
    CONSTRAINT FK_Sales_Quotations FOREIGN KEY (quotationId) REFERENCES dbo.QuotationHeaders(id)
  );
END
GO

IF COL_LENGTH('dbo.SaleHeaders', 'customerId') IS NULL ALTER TABLE dbo.SaleHeaders ADD customerId INT NULL;
GO
IF COL_LENGTH('dbo.SaleHeaders', 'sellerId') IS NULL ALTER TABLE dbo.SaleHeaders ADD sellerId INT NULL;
GO
IF COL_LENGTH('dbo.SaleHeaders', 'quotationId') IS NULL ALTER TABLE dbo.SaleHeaders ADD quotationId INT NULL;
GO
IF COL_LENGTH('dbo.SaleHeaders', 'saleType') IS NULL ALTER TABLE dbo.SaleHeaders ADD saleType NVARCHAR(30) NOT NULL CONSTRAINT DF_SaleHeaders_SaleType DEFAULT 'directa';
GO
IF COL_LENGTH('dbo.SaleHeaders', 'status') IS NULL ALTER TABLE dbo.SaleHeaders ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_SaleHeaders_Status DEFAULT 'cerrada';
GO
IF COL_LENGTH('dbo.SaleHeaders', 'subtotal') IS NULL ALTER TABLE dbo.SaleHeaders ADD subtotal DECIMAL(18,2) NOT NULL CONSTRAINT DF_SaleHeaders_Subtotal DEFAULT 0;
GO
IF COL_LENGTH('dbo.SaleHeaders', 'taxTotal') IS NULL ALTER TABLE dbo.SaleHeaders ADD taxTotal DECIMAL(18,2) NOT NULL CONSTRAINT DF_SaleHeaders_TaxTotal DEFAULT 0;
GO
ALTER TABLE dbo.SaleHeaders ALTER COLUMN locationId INT NULL;
GO

IF OBJECT_ID('dbo.SaleDetails', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SaleDetails (
    id INT IDENTITY(1,1) PRIMARY KEY,
    saleId INT NOT NULL,
    productId INT NOT NULL,
    variantId INT NULL,
    productDescription NVARCHAR(500) NULL,
    unit NVARCHAR(30) NOT NULL DEFAULT 'unidad',
    quantity DECIMAL(18,2) NOT NULL,
    listPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    unitPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    affectsTax BIT NOT NULL DEFAULT 1,
    taxRate DECIMAL(5,2) NOT NULL DEFAULT 18,
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    taxAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT FK_SaleDetails_Headers FOREIGN KEY (saleId) REFERENCES dbo.SaleHeaders(id),
    CONSTRAINT FK_SaleDetails_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id)
  );
END
GO

IF OBJECT_ID('dbo.SaleDocuments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SaleDocuments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    saleId INT NOT NULL,
    documentType NVARCHAR(20) NOT NULL,
    series NVARCHAR(10) NOT NULL,
    documentNumber INT NOT NULL,
    fullNumber NVARCHAR(30) NOT NULL UNIQUE,
    issueDate DATE NOT NULL DEFAULT CONVERT(date, GETDATE()),
    currency NVARCHAR(10) NOT NULL DEFAULT 'PEN',
    customerDocumentType NVARCHAR(30) NULL,
    customerDocumentNumber NVARCHAR(30) NULL,
    customerName NVARCHAR(180) NOT NULL,
    customerAddress NVARCHAR(250) NULL,
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    taxTotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    status NVARCHAR(30) NOT NULL DEFAULT 'emitido',
    sunatStatus NVARCHAR(30) NULL,
    sunatHash NVARCHAR(250) NULL,
    sunatTicket NVARCHAR(120) NULL,
    xmlPath NVARCHAR(500) NULL,
    pdfPath NVARCHAR(500) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SaleDocuments_Sales FOREIGN KEY (saleId) REFERENCES dbo.SaleHeaders(id),
    CONSTRAINT CK_SaleDocuments_Type CHECK (documentType IN ('boleta', 'factura')),
    CONSTRAINT CK_SaleDocuments_Status CHECK (status IN ('emitido', 'anulado'))
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UX_SaleDocuments_ActiveSale' AND object_id = OBJECT_ID('dbo.SaleDocuments')
)
BEGIN
  CREATE UNIQUE INDEX UX_SaleDocuments_ActiveSale ON dbo.SaleDocuments(saleId) WHERE status <> 'anulado';
END
GO

IF COL_LENGTH('dbo.SaleDetails', 'variantId') IS NULL ALTER TABLE dbo.SaleDetails ADD variantId INT NULL;
GO

IF COL_LENGTH('dbo.SaleDetails', 'productDescription') IS NULL ALTER TABLE dbo.SaleDetails ADD productDescription NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.SaleDetails', 'unit') IS NULL ALTER TABLE dbo.SaleDetails ADD unit NVARCHAR(30) NOT NULL CONSTRAINT DF_SaleDetails_Unit DEFAULT 'unidad';
GO
IF COL_LENGTH('dbo.SaleDetails', 'listPrice') IS NULL ALTER TABLE dbo.SaleDetails ADD listPrice DECIMAL(18,2) NOT NULL CONSTRAINT DF_SaleDetails_ListPrice DEFAULT 0;
GO
IF COL_LENGTH('dbo.SaleDetails', 'affectsTax') IS NULL ALTER TABLE dbo.SaleDetails ADD affectsTax BIT NOT NULL CONSTRAINT DF_SaleDetails_AffectsTax DEFAULT 1;
GO
IF COL_LENGTH('dbo.SaleDetails', 'taxRate') IS NULL ALTER TABLE dbo.SaleDetails ADD taxRate DECIMAL(5,2) NOT NULL CONSTRAINT DF_SaleDetails_TaxRate DEFAULT 18;
GO
IF COL_LENGTH('dbo.SaleDetails', 'taxAmount') IS NULL ALTER TABLE dbo.SaleDetails ADD taxAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_SaleDetails_TaxAmount DEFAULT 0;
GO
IF COL_LENGTH('dbo.SaleDetails', 'total') IS NULL ALTER TABLE dbo.SaleDetails ADD total DECIMAL(18,2) NOT NULL CONSTRAINT DF_SaleDetails_Total DEFAULT 0;
GO

IF OBJECT_ID('dbo.InventoryMovements', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryMovements (
    id INT IDENTITY(1,1) PRIMARY KEY,
    productId INT NOT NULL,
    variantId INT NULL,
    locationId INT NOT NULL,
    shelfId INT NULL,
    movementType NVARCHAR(20) NOT NULL,
    quantity DECIMAL(18,2) NOT NULL,
    sourceType NVARCHAR(30) NOT NULL,
    sourceId INT NULL,
    notes NVARCHAR(500) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Movements_Products FOREIGN KEY (productId) REFERENCES dbo.Products(id),
    CONSTRAINT FK_Movements_Variants FOREIGN KEY (variantId) REFERENCES dbo.ProductVariants(id),
    CONSTRAINT FK_Movements_Locations FOREIGN KEY (locationId) REFERENCES dbo.InventoryLocations(id),
    CONSTRAINT FK_Movements_Shelves FOREIGN KEY (shelfId) REFERENCES dbo.Shelves(id),
    CONSTRAINT CK_Movements_Type CHECK (movementType IN ('entrada', 'salida', 'ajuste'))
  );
END
GO

IF COL_LENGTH('dbo.InventoryMovements', 'variantId') IS NULL ALTER TABLE dbo.InventoryMovements ADD variantId INT NULL;
GO
