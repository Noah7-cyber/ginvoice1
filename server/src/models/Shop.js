const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  isMain: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

ShopSchema.index({ businessId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Shop', ShopSchema);
