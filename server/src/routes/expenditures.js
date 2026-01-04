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

router.put('/:id', auth, async (req, res) => {
  const { title, amount, category, date, description, paymentMethod } = req.body;
  try {
    const businessId = req.user.businessId || req.user.id;
    let expenditure = await Expenditure.findOne({ id: req.params.id, business: businessId });
    if (!expenditure) return res.status(404).json({ msg: 'Expenditure not found' });

    expenditure.title = title;
    expenditure.amount = amount;
    expenditure.category = category;
    expenditure.date = date;
    expenditure.description = description;
    expenditure.paymentMethod = paymentMethod;

    await expenditure.save();

    const result = expenditure.toObject();
    result.amount = parseFloat((result.amount || 0).toString());
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const businessId = req.user.businessId || req.user.id;
    const expenditure = await Expenditure.findOne({ id: req.params.id, business: businessId });
    if (!expenditure) return res.status(404).json({ msg: 'Expenditure not found' });

    await expenditure.deleteOne();
    res.json({ msg: 'Expenditure removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
