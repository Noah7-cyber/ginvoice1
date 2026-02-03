const express = require('express');
const router = express.Router();
const Business = require('../models/Business');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const strategy = require('../strategies/NigeriaSmallBusinessStrategy');

// GET /api/tax/estimate
router.get('/estimate', auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    const business = await Business.findById(businessId);

    if (!business) return res.status(404).json({ message: 'Business not found' });

    // Check if opted in
    if (!business.taxSettings || !business.taxSettings.isEnabled) {
      return res.status(403).json({
        message: 'Compliance Shield is not enabled.',
        requiresOptIn: true
      });
    }

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const transactions = await Transaction.find({
      businessId: businessId,
      transactionDate: { $gte: startOfYear, $lte: endOfYear }
    });

    const expenditures = await Expenditure.find({
      business: businessId,
      date: { $gte: startOfYear, $lte: endOfYear }
    });

    // Fetch Categories to determine expense types
    const categories = await Category.find({ businessId: businessId });

    // Calculate Revenue
    const revenue = transactions.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);

    // Calculate Estimate
    const result = strategy.calculate(revenue, expenditures, business, categories);

    res.json({
      success: true,
      period: `Jan ${currentYear} - Dec ${currentYear}`,
      estimation: result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
