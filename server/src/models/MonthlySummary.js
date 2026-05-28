const mongoose = require('mongoose');

const MonthlySummarySchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  totalExpenditure: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  totalTransactions: { type: Number, default: 0 },
  totalRevenue: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  archivedAt: { type: Date, default: Date.now }
});

MonthlySummarySchema.index({ businessId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlySummary', MonthlySummarySchema);
