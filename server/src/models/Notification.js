const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['deletion'], required: true },
  amount: { type: Number, required: true },
  performedBy: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// TTL Index: Auto-delete after 7 days (604800 seconds)
NotificationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('Notification', NotificationSchema);
