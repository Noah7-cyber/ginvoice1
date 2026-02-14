const mongoose = require('mongoose');

const StockVerificationEventSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  productId: { type: String, required: true, index: true },
  expectedQty: { type: Number, required: true },
  countedQty: { type: Number, required: true },
  variance: { type: Number, required: true },
  reasonCode: { type: String, enum: ['CYCLE_COUNT', 'MANUAL_CHECK', 'FOLLOW_UP'], default: 'CYCLE_COUNT' },
  verifiedBy: { type: String, default: '' },
  verifiedAt: { type: Date, default: Date.now, index: true },
  riskBefore: { type: Number, default: 0 },
  riskAfter: { type: Number, default: 0 },
  notes: { type: String, default: '' }
}, { timestamps: true });

StockVerificationEventSchema.index({ businessId: 1, productId: 1, verifiedAt: -1 });

module.exports = mongoose.model('StockVerificationEvent', StockVerificationEventSchema);
