const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  title: { type: String, default: '' },
  message: { type: String, required: true },
  body: { type: String, default: '' },
  type: { type: String, enum: ['deletion', 'modification', 'stock_verification', 'stock_variance'], required: true },
  amount: { type: Number, default: 0 },
  performedBy: { type: String, default: 'System' },
  payload: { type: mongoose.Schema.Types.Mixed, default: null },
  dismissedAt: { type: Date, default: null },
  timestamp: { type: Date, default: Date.now }
});

// TTL Index: Auto-delete after 7 days (604800 seconds)
NotificationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('Notification', NotificationSchema);
