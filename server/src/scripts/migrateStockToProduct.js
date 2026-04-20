require('dotenv').config();
const mongoose = require('mongoose');

const Product = require('../models/Product');
const ProductShopStockSchema = new mongoose.Schema({
  businessId: { type: String },
  shopId: { type: String },
  productId: { type: String },
  onHand: { type: Number }
}, { strict: false });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ginvoice';

const run = async () => {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(mongoUri, { autoIndex: true });
  console.log('[migrate] Connected to MongoDB');

  const ProductShopStock = mongoose.model('ProductShopStock', ProductShopStockSchema, 'productshopstocks');

  const stocks = await ProductShopStock.find({}).lean();
  console.log('[migrate] Found ' + stocks.length + ' ProductShopStock records. Migrating...');

  let updatedCount = 0;

  for (const stock of stocks) {
    if (stock.onHand === undefined || stock.onHand === null) continue;

    await Product.updateOne(
      { businessId: stock.businessId, id: stock.productId },
      { $inc: { stock: stock.onHand } }
    );
    updatedCount++;
  }

  console.log('[migrate] Migrated ' + updatedCount + ' stock records to Product collection.');

  console.log('[migrate] Dropping productshopstocks collection...');
  try {
    await mongoose.connection.db.dropCollection('productshopstocks');
    console.log('[migrate] Collection productshopstocks dropped successfully.');
  } catch (err) {
    if (err.code === 26) {
      console.log('[migrate] Collection productshopstocks already dropped or does not exist.');
    } else {
      console.error('[migrate] Error dropping collection:', err);
    }
  }

  try {
    await mongoose.connection.db.dropCollection('shops');
    console.log('[migrate] Collection shops dropped successfully.');
  } catch (err) {
    if (err.code === 26) {
      console.log('[migrate] Collection shops already dropped or does not exist.');
    } else {
      console.error('[migrate] Error dropping collection:', err);
    }
  }

  await mongoose.disconnect();
};

run()
  .then(() => {
    console.log('[migrate] done');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[migrate] failed', error);
    await mongoose.disconnect();
    process.exit(1);
  });
