const mongoose = require('mongoose');

const DiscountCodeSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  code: { type: String, required: true, index: true },
  type: { type: String, enum: ['fixed', 'percent'], required: true },
  value: { type: Number, required: true },
  isUsed: { type: Boolean, default: false },
  expiryDate: {
    type: Date,
    index: { expires: '0s' } // Auto-delete when this date is passed
  },
  scope: { type: String, enum: ['global', 'product'], required: true },
  productId: { type: String }, // Optional, linking to product 'id' (String) not ObjectId if using string IDs
  createdAt: { type: Date, default: Date.now }
});

// Ensure codes are unique per business
DiscountCodeSchema.index({ businessId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('DiscountCode', DiscountCodeSchema);
