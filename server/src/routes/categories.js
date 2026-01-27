const express = require('express');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Business = require('../models/Business');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');

const router = express.Router();

const toDecimal = (value) => {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return mongoose.Types.Decimal128.fromString('0');
  return mongoose.Types.Decimal128.fromString(String(value));
};

const DEFAULT_CATEGORIES = ['Food', 'Building', 'Electronics', 'Clothing', 'Household', 'Others'];

// GET all categories for the business
router.get('/', auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    const categories = await Category.find({ businessId }).sort({ usageCount: -1, name: 1 });
    res.json(categories);
  } catch (err) {
    console.error('Fetch Categories Error:', err);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// POST create a new category
router.post('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { name, defaultSellingPrice, defaultCostPrice, defaultUnit } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const category = await Category.create({
      businessId: req.businessId,
      name,
      defaultSellingPrice: toDecimal(defaultSellingPrice),
      defaultCostPrice: toDecimal(defaultCostPrice),
      defaultUnit: defaultUnit || ''
    });

    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 1 } });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create category' });
  }
});

// PUT update a category
router.put('/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, defaultSellingPrice, defaultCostPrice, defaultUnit } = req.body;

    if (!name) return res.status(400).json({ message: 'Name required' });

    // 1. Fetch old category to check for name change
    const oldCategory = await Category.findOne({ _id: id, businessId: req.businessId });
    if (!oldCategory) return res.status(404).json({ message: 'Category not found' });

    const oldName = oldCategory.name;

    // 2. Update Category
    const category = await Category.findByIdAndUpdate(
      id,
      {
        name,
        defaultSellingPrice: toDecimal(defaultSellingPrice),
        defaultCostPrice: toDecimal(defaultCostPrice),
        defaultUnit: defaultUnit || ''
      },
      { new: true }
    );

    // 3. Propagate Rename to Products
    if (oldName !== name) {
        await Product.updateMany(
            { businessId: req.businessId, category: oldName },
            { $set: { category: name } }
        );
    }

    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 1 } });
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update category' });
  }
});

// DELETE a category
router.delete('/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    // Use _id for MongoDB ID
    await Category.deleteOne({ _id: id, businessId: req.businessId });
    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 1 } });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

module.exports = router;
