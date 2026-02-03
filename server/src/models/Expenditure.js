const mongoose = require('mongoose');

const ExpenditureSchema = new mongoose.Schema({
  // CRITICAL FIX: Add this field to store the Client-Side UUID
  id: { type: String, required: true, unique: true },

  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  title: { type: String, required: false },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true }, // Using Decimal128 as per previous fixes
  category: { type: String, default: 'Other' },
  expenseType: { type: String, enum: ['business', 'personal'], default: 'business' },
  taxCategory: {
    type: String,
    enum: ['OPERATING_EXPENSE', 'COST_OF_GOODS', 'CAPITAL_ASSET', 'NON_DEDUCTIBLE', 'SALARY_PENSION', 'PERSONAL_HOME_RENT', 'WHT_CREDIT'],
    default: 'OPERATING_EXPENSE'
  },
  date: { type: Date, default: Date.now },
  description: { type: String, default: '' },
  paymentMethod: { type: String, default: 'Cash' },

  // Legacy fields (optional to keep)
  note: { type: String },
  createdBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Expenditure', ExpenditureSchema);
