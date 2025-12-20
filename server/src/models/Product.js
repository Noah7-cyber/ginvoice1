const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true, required: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String },
  unit: { type: String },
  stock: { type: Number, default: 0 },
  costPrice: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  sellingPrice: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

ProductSchema.index({ businessId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Product', ProductSchema);
