const dotenv = require('dotenv');
dotenv.config();

const sql = require('mssql');
const InventoryModel = require('../models/InventoryModel');
const { poolPromise } = require('../config/db');

async function run() {
  const pool = await poolPromise;
  const products = await pool.request().query('SELECT id FROM Products ORDER BY id');

  for (const product of products.recordset) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await InventoryModel.rebuildProductVariants(transaction, product.id);
      const variants = await new sql.Request(transaction)
        .input('productId', sql.Int, product.id)
        .query('SELECT id FROM ProductVariants WHERE productId = @productId');
      if (variants.recordset.length === 1) {
        await new sql.Request(transaction)
          .input('productId', sql.Int, product.id)
          .input('variantId', sql.Int, variants.recordset[0].id)
          .query('UPDATE InventoryStock SET variantId = @variantId WHERE productId = @productId AND variantId IS NULL');
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  console.log(`Variantes generadas para ${products.recordset.length} productos`);
  await pool.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
