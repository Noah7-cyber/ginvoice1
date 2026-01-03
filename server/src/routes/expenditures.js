const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Expenditure = require('../models/Expenditure');

router.get('/', auth, async (req, res) => {
  try {
    const rawExpenditures = await Expenditure.find({
        business: req.user.businessId || req.user.id
    }).sort({ date: -1 }).lean();

    const expenditures = rawExpenditures.map(e => ({
      ...e,
      amount: parseFloat((e.amount || 0).toString())
    }));

    res.json(expenditures);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.post('/', auth, async (req, res) => {
  const { title, amount, category, date, description, paymentMethod, id } = req.body;
  try {
    const newExpenditure = new Expenditure({
      id: id || require('crypto').randomUUID(), // Ensure id is present
      title,
      amount,
      category,
      date,
      description,
      paymentMethod,
      // FIX: Add fallback to req.user.id to match the GET route logic
      business: req.user.businessId || req.user.id,
      user: req.user.id
    });
    const saved = await newExpenditure.save();
    const expenditure = saved.toObject();
    expenditure.amount = parseFloat((expenditure.amount || 0).toString());

    res.json(expenditure);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
module.exports = router;
