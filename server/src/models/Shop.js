const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true, trim: true, lowercase: true },
  isMain: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

ShopSchema.index({ businessId: 1, normalizedName: 1 }, { unique: true });

ShopSchema.pre('validate', function nextNormalizeName(next) {
  const raw = String(this.name || '').trim();
  this.name = raw;
  this.normalizedName = raw.toLowerCase();
  next();
});

module.exports = mongoose.model('Shop', ShopSchema);
