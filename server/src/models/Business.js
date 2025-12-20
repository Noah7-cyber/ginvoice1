const mongoose = require('mongoose');

const BusinessSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true },
  address: { type: String, default: '' },
  ownerPin: { type: String, required: true },
  staffPin: { type: String, required: true },
  logo: { type: String },
  theme: { type: mongoose.Schema.Types.Mixed, default: {} },
  trialEndsAt: { type: Date, required: true },
  isSubscribed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Business', BusinessSchema);
