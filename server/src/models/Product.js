const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true, required: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String },
  stock: { type: Number, default: 0 }, // Always in base unit
  costPrice: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // Always in base unit
  units: [{
    name: { type: String, required: true }, // e.g., 'piece', 'pack', 'box'
    multiplier: { type: Number, required: true }, // e.g., 1, 12, 48
    sellingPrice: { type: mongoose.Schema.Types.Decimal128, required: true }
  }],
  updatedAt: { type: Date, default: Date.now }
});

ProductSchema.index({ businessId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Product', ProductSchema);
