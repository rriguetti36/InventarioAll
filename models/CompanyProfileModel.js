const { poolPromise, sql } = require('../config/db');

function text(value) {
  return value === undefined || value === null || value === '' ? null : String(value);
}

function decimal(value, fallback = 18) {
  return value === undefined || value === null || value === '' ? fallback : Number(value);
}

class CompanyProfileModel {
  static async ensureSchema() {
    const pool = await poolPromise;
    await pool.request().query(`
      IF OBJECT_ID('dbo.CompanyProfile', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.CompanyProfile (
          id INT NOT NULL CONSTRAINT PK_CompanyProfile PRIMARY KEY CONSTRAINT DF_CompanyProfile_Id DEFAULT 1,
          legalName NVARCHAR(180) NULL,
          ruc NVARCHAR(20) NULL,
          phones NVARCHAR(250) NULL,
          whatsappPhones NVARCHAR(250) NULL,
          address NVARCHAR(300) NULL,
          email NVARCHAR(150) NULL,
          industry NVARCHAR(120) NULL,
          taxRate DECIMAL(5,2) NOT NULL CONSTRAINT DF_CompanyProfile_TaxRate DEFAULT 18,
          logoDataUrl NVARCHAR(MAX) NULL,
          bankAccountsJson NVARCHAR(MAX) NULL,
          website NVARCHAR(250) NULL,
          socialLinksJson NVARCHAR(MAX) NULL,
          createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      END

      IF COL_LENGTH('dbo.CompanyProfile', 'legalName') IS NULL ALTER TABLE dbo.CompanyProfile ADD legalName NVARCHAR(180) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'ruc') IS NULL ALTER TABLE dbo.CompanyProfile ADD ruc NVARCHAR(20) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'phones') IS NULL ALTER TABLE dbo.CompanyProfile ADD phones NVARCHAR(250) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'whatsappPhones') IS NULL ALTER TABLE dbo.CompanyProfile ADD whatsappPhones NVARCHAR(250) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'address') IS NULL ALTER TABLE dbo.CompanyProfile ADD address NVARCHAR(300) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'email') IS NULL ALTER TABLE dbo.CompanyProfile ADD email NVARCHAR(150) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'industry') IS NULL ALTER TABLE dbo.CompanyProfile ADD industry NVARCHAR(120) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'taxRate') IS NULL ALTER TABLE dbo.CompanyProfile ADD taxRate DECIMAL(5,2) NOT NULL CONSTRAINT DF_CompanyProfile_TaxRate2 DEFAULT 18;
      IF COL_LENGTH('dbo.CompanyProfile', 'logoDataUrl') IS NULL ALTER TABLE dbo.CompanyProfile ADD logoDataUrl NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'bankAccountsJson') IS NULL ALTER TABLE dbo.CompanyProfile ADD bankAccountsJson NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'website') IS NULL ALTER TABLE dbo.CompanyProfile ADD website NVARCHAR(250) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'socialLinksJson') IS NULL ALTER TABLE dbo.CompanyProfile ADD socialLinksJson NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.CompanyProfile', 'createdAt') IS NULL ALTER TABLE dbo.CompanyProfile ADD createdAt DATETIME2 NOT NULL CONSTRAINT DF_CompanyProfile_CreatedAt DEFAULT SYSUTCDATETIME();
      IF COL_LENGTH('dbo.CompanyProfile', 'updatedAt') IS NULL ALTER TABLE dbo.CompanyProfile ADD updatedAt DATETIME2 NOT NULL CONSTRAINT DF_CompanyProfile_UpdatedAt DEFAULT SYSUTCDATETIME();
    `);
  }

  static async get() {
    await CompanyProfileModel.ensureSchema();
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT TOP 1 * FROM dbo.CompanyProfile WHERE id = 1');
    return result.recordset[0] || null;
  }

  static async upsert(data) {
    await CompanyProfileModel.ensureSchema();
    const pool = await poolPromise;
    const result = await pool.request()
      .input('legalName', sql.NVarChar(180), text(data.legalName))
      .input('ruc', sql.NVarChar(20), text(data.ruc))
      .input('phones', sql.NVarChar(250), text(data.phones))
      .input('whatsappPhones', sql.NVarChar(250), text(data.whatsappPhones))
      .input('address', sql.NVarChar(300), text(data.address))
      .input('email', sql.NVarChar(150), text(data.email))
      .input('industry', sql.NVarChar(120), text(data.industry))
      .input('taxRate', sql.Decimal(5, 2), decimal(data.taxRate))
      .input('logoDataUrl', sql.NVarChar(sql.MAX), text(data.logoDataUrl))
      .input('bankAccountsJson', sql.NVarChar(sql.MAX), JSON.stringify(data.bankAccounts || []))
      .input('website', sql.NVarChar(250), text(data.website))
      .input('socialLinksJson', sql.NVarChar(sql.MAX), JSON.stringify(data.socialLinks || []))
      .query(`
        MERGE dbo.CompanyProfile AS target
        USING (SELECT 1 AS id) AS source
        ON target.id = source.id
        WHEN MATCHED THEN
          UPDATE SET legalName = @legalName,
                     ruc = @ruc,
                     phones = @phones,
                     whatsappPhones = @whatsappPhones,
                     address = @address,
                     email = @email,
                     industry = @industry,
                     taxRate = @taxRate,
                     logoDataUrl = @logoDataUrl,
                     bankAccountsJson = @bankAccountsJson,
                     website = @website,
                     socialLinksJson = @socialLinksJson,
                     updatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (id, legalName, ruc, phones, whatsappPhones, address, email, industry, taxRate, logoDataUrl, bankAccountsJson, website, socialLinksJson)
          VALUES (1, @legalName, @ruc, @phones, @whatsappPhones, @address, @email, @industry, @taxRate, @logoDataUrl, @bankAccountsJson, @website, @socialLinksJson);

        SELECT TOP 1 * FROM dbo.CompanyProfile WHERE id = 1;
      `);
    return result.recordset[0];
  }
}

module.exports = CompanyProfileModel;
