require('dotenv').config();
const mongoose = require('mongoose');

const Business = require('../models/Business');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const ProductShopStock = require('../models/ProductShopStock');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const StockVerificationEvent = require('../models/StockVerificationEvent');

const mongoUri = process.env.MONGODB_URI || '';

const ensureDefaultShop = async (business) => {
  if (business.defaultShopId) return String(business.defaultShopId);

  let mainShop = await Shop.findOne({ businessId: String(business._id), isMain: true });
  if (!mainShop) {
    mainShop = await Shop.create({
      businessId: String(business._id),
      name: business.name ? `${business.name} Main Shop` : 'Main Shop',
      isMain: true,
      status: 'active'
    });
  }

  const defaultShopId = String(mainShop._id);
  await Business.updateOne({ _id: business._id }, { $set: { defaultShopId } });
  return defaultShopId;
};

const run = async () => {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(mongoUri, { autoIndex: true });

  const businesses = await Business.find({}).select('_id name defaultShopId').lean();
  for (const business of businesses) {
    const businessId = String(business._id);
    const defaultShopId = await ensureDefaultShop(business);

    await Transaction.updateMany(
      { businessId: business._id, $or: [{ shopId: { $exists: false } }, { shopId: null }] },
      { $set: { shopId: defaultShopId } }
    );

    await Expenditure.updateMany(
      { business: business._id, $or: [{ shopId: { $exists: false } }, { shopId: null }] },
      { $set: { shopId: defaultShopId } }
    );

    await StockVerificationEvent.updateMany(
      { businessId, $or: [{ shopId: { $exists: false } }, { shopId: null }] },
      { $set: { shopId: defaultShopId } }
    );

    const products = await Product.find({ businessId }).select('id stock').lean();
    for (const product of products) {
      await ProductShopStock.updateOne(
        { businessId, shopId: defaultShopId, productId: product.id },
        { $setOnInsert: { onHand: Number(product.stock || 0) } },
        { upsert: true }
      );
    }

    console.log(`[multishop-migrate] business=${businessId} defaultShop=${defaultShopId} productsSeeded=${products.length}`);
  }

  await mongoose.disconnect();
};

run()
  .then(() => {
    console.log('[multishop-migrate] done');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[multishop-migrate] failed', error);
    await mongoose.disconnect();
    process.exit(1);
  });
