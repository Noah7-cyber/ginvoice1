const Product = require('../models/Product');

const normalizeQty = (qty) => Number(qty) || 0;

const getOnHand = async ({ businessId, productId, session = null }) => {
  const productQuery = Product.findOne({ businessId, id: productId }).select('stock').lean();
  if (session) productQuery.session(session);
  const product = await productQuery;
  return Number(product?.stock || 0);
};

const applyManualAdjustment = async ({ businessId, productId, delta = 0, currentStock, session = null }) => {
  const normalizedDelta = normalizeQty(delta);

  if (currentStock !== undefined && currentStock !== null) {
    const next = normalizeQty(currentStock);
    await Product.updateOne(
      { businessId, id: productId },
      { $set: { stock: next } },
      { ...(session ? { session } : {}) }
    );
    return next;
  }

  if (normalizedDelta !== 0) {
    await Product.updateOne(
      { businessId, id: productId },
      { $inc: { stock: normalizedDelta } },
      { ...(session ? { session } : {}) }
    );
  }

  return getOnHand({ businessId, productId, session });
};

const decrementStock = async ({ businessId, productId, qty, session = null }) => {
  return applyManualAdjustment({ businessId, productId, delta: -Math.abs(normalizeQty(qty)), session });
};

const restoreStock = async ({ businessId, productId, qty, session = null }) => {
  return applyManualAdjustment({ businessId, productId, delta: Math.abs(normalizeQty(qty)), session });
};

const reconcileSaleEdit = async ({ businessId, originalItems = [], newItems = [], session = null }) => {
  for (const item of originalItems) {
    const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
    await restoreStock({ businessId, productId: item.productId, qty: item.quantity * multiplier, session });
  }

  for (const item of newItems) {
    const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
    await decrementStock({ businessId, productId: item.productId, qty: item.quantity * multiplier, session });
  }
};

const setCountedQuantity = async ({ businessId, productId, countedQty }) => {
  return applyManualAdjustment({
    businessId,
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
