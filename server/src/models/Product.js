const mongoose = require('mongoose');

const UnitDefinitionSchema = new mongoose.Schema({
  _id: false,
  name: { type: String, required: true },
  multiplier: { type: Number, required: true, min: 1 },
  sellingPrice: { type: Number, required: true, default: 0 },
  costPrice: { type: Number, default: 0 }
});

const ProductSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true, required: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String },
  baseUnit: { type: String, default: 'Piece' },
  stock: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  units: { type: [UnitDefinitionSchema], default: [] },
  updatedAt: { type: Date, default: Date.now }
});

ProductSchema.index({ businessId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Product', ProductSchema);
