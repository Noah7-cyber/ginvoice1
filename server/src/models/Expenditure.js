// server/src/models/Expenditure.js
// Minimal Expenditure model. Fields chosen to be explicit and compatible with existing server.
// amount is stored as Number in smallest currency unit if you later migrate; for now use the app's convention.
const mongoose = require('mongoose');

const ExpenditureSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true }, // use same unit as server currently uses (e.g., Naira). If you want kobo, migrate later.
  category: { type: String, default: 'Other' },
  note: { type: String, default: '' },
  createdBy: { type: String, default: '' }, // staff id or 'owner'
  businessId: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Expenditure', ExpenditureSchema);