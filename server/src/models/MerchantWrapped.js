const mongoose = require('mongoose');

const wrappedCardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  metric: { type: String, required: true },
  copy: { type: String, required: true },
  type: { type: String, required: true }
}, { _id: false });

const merchantWrappedSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12
  cards: [wrappedCardSchema],
  persona: { type: String },
  generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// A business can only have one wrapped story per month
merchantWrappedSchema.index({ businessId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MerchantWrapped', merchantWrappedSchema);
