const Product = require('../models/Product');
const ProductShopStock = require('../models/ProductShopStock');

const normalizeQty = (qty) => Number(qty) || 0;

const ensureStockDoc = async ({ businessId, shopId, productId }) => {
  const product = await Product.findOne({ businessId, id: productId }).select('stock').lean();
  if (!product) return null;

  const existing = await ProductShopStock.findOne({ businessId, shopId, productId });
  if (existing) return existing;

  return ProductShopStock.create({
    businessId,
    shopId,
    productId,
    onHand: Number(product.stock || 0)
  });
};

const getOnHand = async ({ businessId, shopId, productId }) => {
  const stock = await ProductShopStock.findOne({ businessId, shopId, productId }).lean();
  if (stock) return Number(stock.onHand || 0);

  const product = await Product.findOne({ businessId, id: productId }).select('stock').lean();
  return Number(product?.stock || 0);
};

const applyManualAdjustment = async ({ businessId, shopId, productId, delta = 0, currentStock }) => {
  const normalizedDelta = normalizeQty(delta);

  await ensureStockDoc({ businessId, shopId, productId });

  if (currentStock !== undefined && currentStock !== null) {
    const next = normalizeQty(currentStock);
    await ProductShopStock.updateOne(
      { businessId, shopId, productId },
      { $set: { onHand: next } },
      { upsert: true }
    );
    await Product.updateOne({ businessId, id: productId }, { $set: { stock: next } });
    return next;
  }

  if (normalizedDelta !== 0) {
    await ProductShopStock.updateOne(
      { businessId, shopId, productId },
      { $inc: { onHand: normalizedDelta } },
      { upsert: true }
    );
    await Product.updateOne({ businessId, id: productId }, { $inc: { stock: normalizedDelta } });
  }

  return getOnHand({ businessId, shopId, productId });
};

const decrementStock = async ({ businessId, shopId, productId, qty }) => {
  return applyManualAdjustment({ businessId, shopId, productId, delta: -Math.abs(normalizeQty(qty)) });
};

const restoreStock = async ({ businessId, shopId, productId, qty }) => {
  return applyManualAdjustment({ businessId, shopId, productId, delta: Math.abs(normalizeQty(qty)) });
};

const reconcileSaleEdit = async ({ businessId, shopId, originalItems = [], newItems = [] }) => {
  for (const item of originalItems) {
    const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
    await restoreStock({ businessId, shopId, productId: item.productId, qty: item.quantity * multiplier });
  }

  for (const item of newItems) {
    const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
    await decrementStock({ businessId, shopId, productId: item.productId, qty: item.quantity * multiplier });
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
