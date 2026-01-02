const mongoose = require('mongoose');

const ExpenditureSchema = new mongoose.Schema({
  title: { type: String, required: false }, // New field
  amount: { type: Number, required: true },
  category: { type: String, default: 'Other' },
  date: { type: Date, default: Date.now },
  description: { type: String, default: '' }, // New field (maps to note?)
  paymentMethod: { type: String, default: 'Cash' }, // New field
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true }, // Changed from businessId string to Ref? Provided code uses req.user.businessId which suggests ObjectId usually, but let's see route.
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // New field
  // Keep compatibility fields if needed?
  note: { type: String }, // Old field, maybe keep for now
  businessId: { type: String }, // Old field, maybe keep for backward compat or if used elsewhere
  createdBy: { type: String } // Old field
}, { timestamps: true });

module.exports = mongoose.model('Expenditure', ExpenditureSchema);
