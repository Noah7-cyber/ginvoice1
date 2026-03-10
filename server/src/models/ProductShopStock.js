const mongoose = require('mongoose');

const ProductShopStockSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  shopId: { type: String, required: true, index: true },
  productId: { type: String, required: true, index: true },
  onHand: { type: Number, default: 0 },
  sellPriceOverride: { type: mongoose.Types.Decimal128, default: null }
}, { timestamps: true });

ProductShopStockSchema.index({ businessId: 1, shopId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('ProductShopStock', ProductShopStockSchema);
