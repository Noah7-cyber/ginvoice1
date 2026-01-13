const mongoose = require('mongoose');

const UnitDefinitionSchema = new mongoose.Schema({
  _id: false,
  name: { type: String, required: true },
  multiplier: { type: Number, required: true, min: 1 },
  sellingPrice: { type: mongoose.Schema.Types.Decimal128, required: true, default: 0 },
  costPrice: { type: mongoose.Schema.Types.Decimal128, default: 0 }
});

const ProductSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true, required: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String },
  baseUnit: { type: String, default: 'Piece' },
  stock: { type: Number, default: 0 },
  sellingPrice: { type: mongoose.Schema.Types.Decimal128, required: true, default: 0 },
  costPrice: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  units: { type: [UnitDefinitionSchema], default: [] }
}, { timestamps: true });

ProductSchema.index({ businessId: 1, id: 1 }, { unique: true });
// Case-Insensitive Unique Index on Name + Category per Business
ProductSchema.index(
  { businessId: 1, category: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

module.exports = mongoose.model('Product', ProductSchema);
