const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  multiplier: { type: Number, required: true },
  sellingPrice: { type: mongoose.Types.Decimal128, default: 0 },
  costPrice: { type: mongoose.Types.Decimal128, default: 0 }
}, { _id: false });

const productSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  sku: { type: String, default: '' },
  category: { type: String, default: 'Uncategorized' },
  stock: { type: Number, default: 0 },
  sellingPrice: { type: mongoose.Types.Decimal128, default: 0 },
  costPrice: { type: mongoose.Types.Decimal128, default: 0 },
  baseUnit: { type: String, default: 'Piece' },

  // This strict array definition fixes the "Disappearing Units" bug
  units: [unitSchema],

  image: { type: String },
  updatedAt: { type: Date, default: Date.now },
  isManualUpdate: { type: Boolean, default: false } // Keeping for schema compatibility if needed, though unused in logic
}, { timestamps: true });

// Compound index for uniqueness
productSchema.index({ businessId: 1, id: 1 }, { unique: true });
productSchema.index(
  { businessId: 1, category: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

module.exports = mongoose.model('Product', productSchema);
