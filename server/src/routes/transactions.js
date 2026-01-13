const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// DELETE Transaction & Restock Items
router.delete('/:id', auth, async (req, res) => {
  try {
    // Note: Using 'id' (UUID) instead of '_id' (ObjectId) to match client-side generated IDs
    const transaction = await Transaction.findOne({ id: req.params.id, businessId: req.businessId });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // 1. RESTOCK: Loop through items and add them back to Product collection
    for (const item of transaction.items) {
      // Using 'id' for Product lookup as well, assuming consistency in UUID usage
      // Also respecting the multiplier if present for accurate stock restoration, defaulting to 1
      const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
      const quantityRestored = item.quantity * multiplier;

      await Product.updateOne(
        { id: item.productId, businessId: req.businessId },
        { $inc: { stock: quantityRestored } }
      );
    }

    // 2. DELETE the transaction
    await Transaction.deleteOne({ id: req.params.id, businessId: req.businessId });

    res.json({ message: 'Transaction deleted and inventory restocked' });
  } catch (err) {
    console.error('Delete Transaction Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
