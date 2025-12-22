const mongoose = require('mongoose');

const PaymentEventSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  eventType: { type: String },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaymentEvent', PaymentEventSchema);
