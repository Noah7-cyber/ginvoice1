const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Business = require('../models/Business');
const auth = require('../middleware/auth');

const router = express.Router();

const toDecimal = (value) => {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return mongoose.Types.Decimal128.fromString('0');
  return mongoose.Types.Decimal128.fromString(String(value));
};

// GET all products
router.get('/', auth, async (req, res) => {
  try {
    const products = await Product.find({ businessId: req.businessId }).sort({ updatedAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Fetch Products Error:', err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// POST create product
router.post('/', auth, async (req, res) => {
  try {
    const { id, name, category, stock, sellingPrice, costPrice, units } = req.body;

    // Check for existing product ID
    const existing = await Product.findOne({ businessId: req.businessId, id });
    if (existing) return res.status(400).json({ message: 'Product ID already exists' });

    const product = await Product.create({
      businessId: req.businessId,
      id,
      name,
      category: category || 'Uncategorized',
      stock: stock || 0,
      sellingPrice: toDecimal(sellingPrice),
      costPrice: toDecimal(costPrice),
      units: units || []
    });

    // Update data version for sync
    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 1 } });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create product' });
  }
});

// PUT update product
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, category, stock, sellingPrice, costPrice, units } = req.body;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      {
        name,
        category,
        stock,
        sellingPrice: toDecimal(sellingPrice),
        costPrice: toDecimal(costPrice),
        units,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!product) return res.status(404).json({ message: 'Product not found' });
    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 1 } });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// DELETE product
router.delete('/:id', auth, async (req, res) => {
  try {
    await Product.deleteOne({ _id: req.params.id, businessId: req.businessId });
    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 1 } });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

module.exports = router;
