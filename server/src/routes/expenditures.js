// server/src/routes/expenditures.js
const express = require('express');
const router = express.Router();
const Expenditure = require('../models/Expenditure');

// Assumes you have an auth middleware that sets:
// req.userId (id of the authenticated user), req.userRole ('owner'|'staff'), and req.business (business record) or req.businessId
// If your auth middleware uses different names, adapt the checks below accordingly.
const auth = require('../middleware/auth'); // adjust path if needed

// Helper permission check: owner OR staff with 'stock-management' permission
function canManageExpenditures(req) {
  const isOwner = req.userRole === 'owner';
  const bizPerms = (req.business && Array.isArray(req.business.staffPermissions)) ? req.business.staffPermissions : (req.business && req.business.p ? req.business.p : []);
  const hasStockPerm = bizPerms && bizPerms.includes && bizPerms.includes('stock-management');
  return isOwner || hasStockPerm;
}

// Get all expenditures for the current business
router.get('/', auth, async (req, res) => {
  try {
    const businessId = req.businessId || (req.business && req.business._id) || req.business?.id;
    if (!businessId) return res.status(400).json({ message: 'Missing business context' });

    // Use lean() for memory and perf
    const items = await Expenditure.find({ businessId }).sort({ date: -1 }).lean().exec();
    // Map to API shape if you'd like (here we return the fields directly)
    return res.json(items);
  } catch (err) {
    console.error('GET /api/expenditures error', err);
    return res.status(500).json({ message: 'Failed to fetch expenditures' });
  }
});

// Add an expenditure
router.post('/', auth, async (req, res) => {
  try {
    const businessId = req.businessId || (req.business && req.business._id) || req.business?.id;
    if (!businessId) return res.status(400).json({ message: 'Missing business context' });

    if (!canManageExpenditures(req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { date, amount, category, note } = req.body;
    if (typeof amount !== 'number' && typeof amount !== 'string') {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount)) return res.status(400).json({ message: 'Invalid amount' });

    const doc = new Expenditure({
      date: date ? new Date(date) : new Date(),
      amount: parsedAmount,
      category: category || 'Other',
      note: (note || '').toString(),
      createdBy: req.userId || 'unknown',
      businessId
    });

    await doc.save();
    return res.status(201).json({ id: doc._id, date: doc.date, amount: doc.amount, category: doc.category, note: doc.note });
  } catch (err) {
    console.error('POST /api/expenditures error', err);
    return res.status(500).json({ message: 'Failed to create expenditure' });
  }
});

// Delete an expenditure by id
router.delete('/:id', auth, async (req, res) => {
  try {
    const businessId = req.businessId || (req.business && req.business._id) || req.business?.id;
    if (!businessId) return res.status(400).json({ message: 'Missing business context' });

    if (!canManageExpenditures(req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const id = req.params.id;
    const result = await Expenditure.deleteOne({ _id: id, businessId }).exec();
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/expenditures/:id error', err);
    return res.status(500).json({ message: 'Failed to delete expenditure' });
  }
});

module.exports = router;