const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const requireAuth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');
const Product = require('../models/Product');
const { Decimal128 } = mongoose.Types;

const toDecimal = (value) => {
  if (value === null || value === undefined || value === '') return mongoose.Types.Decimal128.fromString('0');
  if (value instanceof Decimal128) return value;
  return mongoose.Types.Decimal128.fromString(String(value));
};

router.post('/', requireAuth, requireActiveSubscription, async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Invalid products data provided.' });
    }

    if (products.length > 1000) {
      return res.status(400).json({ error: 'Maximum limit of 1000 products per import exceeded.' });
    }

    const businessId = req.business.id;

    const bulkOps = products.map((prod) => {
      // Create new UUID for insertions
      const newId = uuidv4();

      return {
        updateOne: {
          filter: {
            businessId,
            name: prod.name,
            category: prod.category || 'Uncategorized'
          },
          update: {
            $setOnInsert: {
              id: newId,
              businessId,
              name: prod.name,
              category: prod.category || 'Uncategorized',
            },
            $inc: {
              stock: Number(prod.quantity) || 0
            },
            $set: {
              sellingPrice: toDecimal(prod.sellingPrice),
              costPrice: toDecimal(prod.costPrice),
              updatedAt: new Date(),
              clientUpdatedAt: new Date(),
              isDeleted: false
            }
          },
          upsert: true
        }
      };
    });

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
    }

    res.json({ success: true, message: 'Products imported successfully.' });

  } catch (error) {
    console.error('Bulk Import Error:', error);
    res.status(500).json({ error: 'Failed to bulk import products.' });
  }
});

module.exports = router;
