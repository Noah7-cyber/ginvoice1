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
  subscriptionExpiresAt: { type: Date },
  paystackCustomerCode: { type: String },
  paystackSubscriptionCode: { type: String },
  paystackPlanCode: { type: String },
  recoveryCode: { type: String },
  recoveryCodeExpires: { type: Date },
  isCategoriesSeeded: { type: Boolean, default: false },

  // New Centralized Settings
  settings: {
    currency: { type: String, default: '₦' },
    taxRate: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    enableSound: { type: Boolean, default: true },
    printReceipts: { type: Boolean, default: true },
    footerText: { type: String, default: 'Thank you for your patronage!' }
  },

  // Permissions (Can be expanded per staff if we move to User model later,
  // but for now this sets the *default* permissions for staff role)
  staffPermissions: {
    canGiveDiscount: { type: Boolean, default: false },
    canManageStock: { type: Boolean, default: false },
    canViewHistory: { type: Boolean, default: true },
    canEditHistory: { type: Boolean, default: false },
    canViewExpenditure: { type: Boolean, default: false },
    canViewDashboard: { type: Boolean, default: false }
  },

  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Business', BusinessSchema);
