const express = require('express');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const auth = require('../middleware/auth');

const router = express.Router();

const toDecimal = (value) => {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return mongoose.Types.Decimal128.fromString('0');
  return mongoose.Types.Decimal128.fromString(String(value));
};

// GET all categories for the business
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.find({ businessId: req.businessId }).sort({ createdAt: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// POST create a new category
router.post('/', auth, async (req, res) => {
  try {
    const { name, defaultSellingPrice, defaultCostPrice } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const category = await Category.create({
      businessId: req.businessId,
      name,
      defaultSellingPrice: toDecimal(defaultSellingPrice),
      defaultCostPrice: toDecimal(defaultCostPrice)
    });

    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create category' });
  }
});

// DELETE a category
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    // Use _id for MongoDB ID
    await Category.deleteOne({ _id: id, businessId: req.businessId });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

module.exports = router;
