const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const Business = require('../models/Business');
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');

// CREATE Transaction
router.post('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { items, customerName, totalAmount, amountPaid, paymentMethod, transactionDate, id, staffId, discountCode } = req.body;

    // 1. Determine Staff ID (Trust frontend "Store Staff" if provided, otherwise fallback to user)
    // NOTE: This logic ensures Owner can't accidentally attribute to themselves if they selected "Staff" mode on frontend
    const finalStaffId = staffId || req.user._id;
    const createdByRole = staffId === 'Store Staff' ? 'staff' : req.userRole;

    const newTransaction = new Transaction({
      businessId: req.businessId,
      id,
      transactionDate: transactionDate || new Date(),
      customerName,
      items,
      totalAmount,
      amountPaid,
      paymentMethod,
      staffId: finalStaffId,
      createdByRole,
      discountCode, // Save discount code if used
      // Auto-calculate balance
      balance: Math.max(0, totalAmount - amountPaid),
      paymentStatus: (totalAmount - amountPaid) <= 0 ? 'paid' : 'credit'
    });

    await newTransaction.save();

    // 2. Decrement Stock
    if (items && items.length > 0) {
      const bulkOps = items.map(item => {
        const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
        return {
          updateOne: {
            filter: { id: item.productId, businessId: req.businessId },
            update: { $inc: { stock: -1 * (item.quantity * multiplier) } }
          }
        };
      });
      await Product.bulkWrite(bulkOps);
    }

    // 3. Increment Data Version (Smart Sync)
    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 0.001 } });

    res.status(201).json(newTransaction);
  } catch (err) {
    console.error('Create Transaction Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// EDIT Transaction (Smart Rollback)
router.put('/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const { items: newItems, totalAmount, amountPaid, paymentMethod, customerName, date } = req.body;

    // 1. Fetch Original
    const originalTx = await Transaction.findOne({ id, businessId: req.businessId });
    if (!originalTx) return res.status(404).json({ message: 'Transaction not found' });

    // 2. Rollback Stock (Restock Original Items)
    if (originalTx.items && originalTx.items.length > 0) {
      const restockOps = originalTx.items.map(item => {
        const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
        return {
          updateOne: {
            filter: { id: item.productId, businessId: req.businessId },
            update: { $inc: { stock: item.quantity * multiplier } }
          }
        };
      });
      await Product.bulkWrite(restockOps);
    }

    // 3. Deduct New Stock (Destock New Items)
    if (newItems && newItems.length > 0) {
      const destockOps = newItems.map(item => {
        const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
        return {
          updateOne: {
            filter: { id: item.productId, businessId: req.businessId },
            update: { $inc: { stock: -1 * (item.quantity * multiplier) } }
          }
        };
      });
      await Product.bulkWrite(destockOps);
    }

    // 4. Update Transaction Fields
    // RECALCULATE LOGIC: Ensure data integrity by recalculating totals
    // Calculate subtotal from items
    const subtotal = newItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

    // Use provided global discount (or keep existing if not provided, though ideally it should be provided)
    // If not provided in body, we might want to check if the frontend sends it.
    // If frontend sends 'totalAmount', we can infer discount or trust subtotal - discount = total.
    // But to be "Smart", we should probably trust the items' sum as subtotal.
    // Let's assume globalDiscount might be passed in body or we default to 0 if we are strictly recalculating.
    // Wait, if the user doesn't edit discount, we should keep original?
    // The safest bet for "Smart Edit" is to accept the new totals from the frontend
    // BUT verify them or recalculate if possible.
    // Since we don't have globalDiscount in the destructuring above, let's extract it.

    const { globalDiscount } = req.body;
    const finalGlobalDiscount = globalDiscount !== undefined ? Number(globalDiscount) : (originalTx.globalDiscount || 0);

    const calculatedTotal = Math.max(0, subtotal - finalGlobalDiscount);

    // Auto-reconcile payment status
    const newBalance = calculatedTotal - amountPaid;

    if (newBalance <= 0) {
        originalTx.balance = 0;
        originalTx.paymentStatus = 'paid';
    } else {
        originalTx.balance = newBalance;
        originalTx.paymentStatus = 'credit';
    }

    originalTx.items = newItems;
    originalTx.subtotal = subtotal;
    originalTx.globalDiscount = finalGlobalDiscount;
    originalTx.totalAmount = calculatedTotal;
    originalTx.amountPaid = amountPaid;
    originalTx.paymentMethod = paymentMethod;
    originalTx.customerName = customerName;
    if (date) originalTx.transactionDate = date; // Allow date update if provided

    await originalTx.save();

    // 4b. Increment Data Version
    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 0.001 } });

    // 5. Log Notification
    const performerName = req.userRole === 'owner' ? 'Owner' : 'Staff';
    await Notification.create({
      businessId: req.businessId,
      message: `Sale to ${customerName || 'Customer'} edited`,
      amount: originalTx.totalAmount,
      performedBy: performerName,
      type: 'modification'
    });

    // Helper to format Decimal128
    const parseDecimal = (val) => {
       if (!val) return 0;
       if (val.toString) return parseFloat(val.toString());
       return Number(val);
    };

    const formattedTx = originalTx.toObject();
    formattedTx.items = formattedTx.items.map(i => ({
       ...i,
       unitPrice: parseDecimal(i.unitPrice),
       discount: parseDecimal(i.discount),
       total: parseDecimal(i.total)
    }));

    res.json(formattedTx);

  } catch (err) {
    console.error('Edit Transaction Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// SETTLE Debt (Mark Paid or Partial Payment)
router.patch('/:id/settle', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid } = req.body;
    const transaction = await Transaction.findOne({ id, businessId: req.businessId });

    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // Helper to parse Decimal128 or Number safely
    const safeNum = (val) => val && val.toString ? parseFloat(val.toString()) : (Number(val) || 0);

    const currentTotal = safeNum(transaction.totalAmount);

    if (amountPaid !== undefined) {
       // PARTIAL SETTLEMENT MODE
       const newAmountPaid = safeNum(amountPaid);
       if (newAmountPaid < 0) return res.status(400).json({ message: 'Invalid amount' });

       transaction.amountPaid = newAmountPaid;
       transaction.balance = Math.max(0, currentTotal - newAmountPaid);

       if (transaction.balance <= 0.01) { // Tolerance for floating point
           transaction.balance = 0;
           transaction.paymentStatus = 'paid';
       } else {
           transaction.paymentStatus = 'credit';
       }
    } else {
       // FULL SETTLEMENT MODE (Legacy Behavior)
       transaction.amountPaid = currentTotal;
       transaction.balance = 0;
       transaction.paymentStatus = 'paid';
    }

    await transaction.save();

    // Increment Data Version for Sync
    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 0.001 } });

    res.json(transaction);
  } catch (err) {
    console.error('Settle Transaction Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

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
