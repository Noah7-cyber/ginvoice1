const Product = require('../models/Product');
const ProductShopStock = require('../models/ProductShopStock');

const normalizeQty = (qty) => Number(qty) || 0;

const ensureStockDoc = async ({ businessId, shopId, productId, session = null }) => {
  const productQuery = Product.findOne({ businessId, id: productId }).select('stock').lean();
  if (session) productQuery.session(session);
  const product = await productQuery;
  if (!product) return null;

  const existingQuery = ProductShopStock.findOne({ businessId, shopId, productId });
  if (session) existingQuery.session(session);
  const existing = await existingQuery;
  if (existing) return existing;

  return ProductShopStock.create([{
    businessId,
    shopId,
    productId,
    onHand: Number(product.stock || 0)
  }], session ? { session } : undefined).then((rows) => rows[0]);
};

const getOnHand = async ({ businessId, shopId, productId, session = null }) => {
  const stockQuery = ProductShopStock.findOne({ businessId, shopId, productId }).lean();
  if (session) stockQuery.session(session);
  const stock = await stockQuery;
  if (stock) return Number(stock.onHand || 0);

  const productQuery = Product.findOne({ businessId, id: productId }).select('stock').lean();
  if (session) productQuery.session(session);
  const product = await productQuery;
  return Number(product?.stock || 0);
};

const applyManualAdjustment = async ({ businessId, shopId, productId, delta = 0, currentStock, session = null }) => {
  const normalizedDelta = normalizeQty(delta);

  await ensureStockDoc({ businessId, shopId, productId, session });

  if (currentStock !== undefined && currentStock !== null) {
    const next = normalizeQty(currentStock);
    await ProductShopStock.updateOne(
      { businessId, shopId, productId },
      { $set: { onHand: next } },
      { upsert: true, ...(session ? { session } : {}) }
    );
    return next;
  }

  if (normalizedDelta !== 0) {
    await ProductShopStock.updateOne(
      { businessId, shopId, productId },
      { $inc: { onHand: normalizedDelta } },
      { upsert: true, ...(session ? { session } : {}) }
    );
  }

  return getOnHand({ businessId, shopId, productId, session });
};

const decrementStock = async ({ businessId, shopId, productId, qty, session = null }) => {
  return applyManualAdjustment({ businessId, shopId, productId, delta: -Math.abs(normalizeQty(qty)), session });
};

const restoreStock = async ({ businessId, shopId, productId, qty, session = null }) => {
  return applyManualAdjustment({ businessId, shopId, productId, delta: Math.abs(normalizeQty(qty)), session });
};

const reconcileSaleEdit = async ({ businessId, shopId, originalItems = [], newItems = [], session = null }) => {
  for (const item of originalItems) {
    const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
    await restoreStock({ businessId, shopId, productId: item.productId, qty: item.quantity * multiplier, session });
  }

  for (const item of newItems) {
    const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
    await decrementStock({ businessId, shopId, productId: item.productId, qty: item.quantity * multiplier, session });
  }
};

const setCountedQuantity = async ({ businessId, shopId, productId, countedQty }) => {
  return applyManualAdjustment({
    businessId,
    shopId,
    productId,
    currentStock: normalizeQty(countedQty)
  });
};

module.exports = {
  decrementStock,
  restoreStock,
  reconcileSaleEdit,
  setCountedQuantity,
  applyManualAdjustment,
  getOnHand
};
