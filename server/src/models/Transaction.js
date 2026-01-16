const mongoose = require('mongoose');

const TransactionItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String }, // Name of the unit (e.g., "Box")
  multiplier: { type: Number, default: 1 }, // Multiplier for the unit (e.g., 12)
  unitPrice: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  discount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  total: { type: mongoose.Schema.Types.Decimal128, default: 0 }
}, { _id: false });

const TransactionSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true, required: true },
  id: { type: String, required: true },
  transactionDate: { type: Date },
  customerName: { type: String },
  customerPhone: { type: String },
  items: { type: [TransactionItemSchema], default: [] },
  subtotal: { type: Number, default: 0 },
  globalDiscount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['cash', 'transfer', 'pos', 'bank', 'credit'], default: 'cash' },
  amountPaid: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  signature: { type: String },
  isSignatureLocked: { type: Boolean, default: false },
  staffId: { type: String }
}, { timestamps: true });

TransactionSchema.index({ businessId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
