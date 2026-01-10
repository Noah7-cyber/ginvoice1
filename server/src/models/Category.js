const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  defaultSellingPrice: { type: mongoose.Decimal128, default: 0 },
  defaultCostPrice: { type: mongoose.Decimal128, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Ensure virtuals are included in toJSON
CategorySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    // Convert Decimals to Numbers
    if (ret.defaultSellingPrice) ret.defaultSellingPrice = parseFloat(ret.defaultSellingPrice.toString());
    if (ret.defaultCostPrice) ret.defaultCostPrice = parseFloat(ret.defaultCostPrice.toString());
    return ret;
  }
});

module.exports = mongoose.model('Category', CategorySchema);
