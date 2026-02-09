const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');
const Expenditure = require('../models/Expenditure');
const Business = require('../models/Business');

router.get('/', auth, async (req, res) => {
  try {
    const rawExpenditures = await Expenditure.find({
        business: req.user.businessId || req.user.id
    }).sort({ date: -1 }).lean();

    const expenditures = rawExpenditures.map(e => {
      let amount = parseFloat((e.amount || 0).toString());
      let flowType = e.flowType;

      if (flowType === 'out') {
        amount = -Math.abs(amount);
      } else if (flowType === 'in') {
        amount = Math.abs(amount);
      } else {
        flowType = amount >= 0 ? 'in' : 'out';
      }

      return {
        ...e,
        amount,
        flowType
      };
    });

    res.json(expenditures);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.post('/', auth, requireActiveSubscription, async (req, res) => {
  const { title, amount, category, date, description, paymentMethod, id, expenseType, flowType } = req.body;
  try {
    // Force sign based on flowType
    let finalAmount = parseFloat(amount);
    if (flowType === 'out') finalAmount = -Math.abs(finalAmount);
    else if (flowType === 'in') finalAmount = Math.abs(finalAmount);

    const newExpenditure = new Expenditure({
      id: id || require('crypto').randomUUID(), // Ensure id is present
      title,
      amount: finalAmount,
      category,
      date,
      description,
      paymentMethod,
      expenseType: expenseType || 'business', // Default to business
      flowType: flowType || 'out',
      // FIX: Add fallback to req.user.id to match the GET route logic
      business: req.user.businessId || req.user.id,
      user: req.user.id
    });
    const saved = await newExpenditure.save();
    const expenditure = saved.toObject();
    expenditure.amount = parseFloat((expenditure.amount || 0).toString());

    const businessId = req.user.businessId || req.user.id;
    await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });

    res.json(expenditure);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.put('/:id', auth, requireActiveSubscription, async (req, res) => {
  const { title, amount, category, date, description, paymentMethod, expenseType, flowType } = req.body;
  try {
    const businessId = req.user.businessId || req.user.id;
    let expenditure = await Expenditure.findOne({ id: req.params.id, business: businessId });
    if (!expenditure) return res.status(404).json({ msg: 'Expenditure not found' });

    // Force sign based on flowType
    let finalAmount = parseFloat(amount);
    if (flowType === 'out') finalAmount = -Math.abs(finalAmount);
    else if (flowType === 'in') finalAmount = Math.abs(finalAmount);

    expenditure.title = title;
    expenditure.amount = finalAmount;
    expenditure.category = category;
    expenditure.date = date;
    expenditure.description = description;
    expenditure.paymentMethod = paymentMethod;
    if (expenseType) expenditure.expenseType = expenseType;
    if (flowType) expenditure.flowType = flowType;

    await expenditure.save();

    const result = expenditure.toObject();
    result.amount = parseFloat((result.amount || 0).toString());

    await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.delete('/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const businessId = req.user.businessId || req.user.id;
    const expenditure = await Expenditure.findOne({ id: req.params.id, business: businessId });
    if (!expenditure) return res.status(404).json({ msg: 'Expenditure not found' });

    await expenditure.deleteOne();
    await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });
    res.json({ msg: 'Expenditure removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
