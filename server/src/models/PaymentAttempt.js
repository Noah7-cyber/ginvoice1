const mongoose = require('mongoose');

const PaymentAttemptSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  amountKobo: { type: Number, default: 0 },
  status: { type: String, default: 'pending' },
  lastCheckedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaymentAttempt', PaymentAttemptSchema);
