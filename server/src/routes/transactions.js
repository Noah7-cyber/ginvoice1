const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');

// DELETE Transaction & Restock Items
router.delete('/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    // Note: Using 'id' (UUID) instead of '_id' (ObjectId) to match client-side generated IDs
    const transaction = await Transaction.findOne({ id: req.params.id, businessId: req.businessId });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // Check if client requested restocking (passed via query param restock=true/false)
    // Default to true if not specified, or handle logic here
    const shouldRestock = req.query.restock !== 'false';

    if (shouldRestock && transaction.items.length > 0) {
      const bulkOps = transaction.items.map(item => {
        // Calculate total units to restore
        // Fallback logic matches your existing pattern
        const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
        const quantityRestored = item.quantity * multiplier;

        return {
          updateOne: {
            filter: { id: item.productId, businessId: req.businessId },
            // CORRECTED: Using 'stock' to match Product.js schema
            update: { $inc: { stock: quantityRestored } }
          }
        };
      });

      await Product.bulkWrite(bulkOps);
    }

    // 2. GHOST NOTE: Create Notification
    const performerName = req.userRole === 'owner' ? 'Owner' : 'Staff';
    const notification = new Notification({
      businessId: req.businessId,
      message: `Sale to ${transaction.customerName || 'Customer'} deleted`,
      amount: transaction.totalAmount || 0,
      performedBy: performerName,
      type: 'deletion'
    });
    await notification.save();

    // 3. DELETE the transaction
    await Transaction.deleteOne({ id: req.params.id, businessId: req.businessId });

    res.json({ message: 'Transaction deleted and inventory restocked' });
  } catch (err) {
    console.error('Delete Transaction Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
