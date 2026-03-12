const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const Business = require('../models/Business');
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');
const { resolveShopId, ensureWritableShopContext } = require('../services/shopContext');
const { decrementStock, restoreStock, reconcileSaleEdit } = require('../services/stockAdapter');

// CREATE Transaction
router.post('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { items, customerName, totalAmount, amountPaid, paymentMethod, transactionDate, id, staffId, discountCode, shopId: requestedShopId, allShops } = req.body;
    const shopId = await ensureWritableShopContext({ businessId: req.businessId, requestedShopId, allShops });

    // 1. Determine Staff ID (Trust frontend "Store Staff" if provided, otherwise fallback to user)
    // NOTE: This logic ensures Owner can't accidentally attribute to themselves if they selected "Staff" mode on frontend
    const createdByRole = req.userRole === 'staff' ? 'staff' : 'owner';
    const createdByUserId = req.user?.id ? String(req.user.id) : '';
    const finalStaffId = staffId || (createdByRole === 'staff' ? (createdByUserId || 'Store Staff') : 'owner');

    const newTransaction = new Transaction({
      businessId: req.businessId,
      shopId,
      id,
      transactionDate: transactionDate || new Date(),
      customerName,
      items,
      totalAmount,
      amountPaid,
      paymentMethod,
      staffId: finalStaffId,
      createdByRole,
      createdByUserId,
      discountCode, // Save discount code if used
      // Auto-calculate balance
      balance: Math.max(0, totalAmount - amountPaid),
      paymentStatus: (totalAmount - amountPaid) <= 0 ? 'paid' : 'credit'
    });

    await newTransaction.save();

    // 2. Decrement Stock
    if (items && items.length > 0) {
      for (const item of items) {
        const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
        await decrementStock({ businessId: req.businessId, shopId, productId: item.productId, qty: item.quantity * multiplier });
      }
    }

    // 3. Increment Data Version (Smart Sync)
    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 0.001 } });

    res.status(201).json(newTransaction);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ message: err.message });
    console.error('Create Transaction Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// EDIT Transaction (Smart Rollback)
router.put('/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const { items: newItems, totalAmount, amountPaid, paymentMethod, customerName, date, shopId: requestedShopId, allShops } = req.body;

    // 1. Fetch Original
    const originalTx = await Transaction.findOne({ id, businessId: req.businessId });
    if (!originalTx) return res.status(404).json({ message: 'Transaction not found' });
    const shopId = await ensureWritableShopContext({ businessId: req.businessId, requestedShopId: requestedShopId || originalTx.shopId, allShops });
    if (!originalTx.shopId) originalTx.shopId = shopId;

    // 2. Rollback Stock (Restock Original Items)
    await reconcileSaleEdit({ businessId: req.businessId, shopId, originalItems: originalTx.items, newItems });

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
    originalTx.shopId = shopId;
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
      type: 'modification',
      shopId
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
    if (err?.status) return res.status(err.status).json({ message: err.message });
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

    const shopId = await ensureWritableShopContext({
      businessId: req.businessId,
      requestedShopId: req.query.shopId || transaction.shopId,
      allShops: req.query.allShops
    });
    if (shouldRestock && transaction.items.length > 0) {
      for (const item of transaction.items) {
        const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
        await restoreStock({ businessId: req.businessId, shopId, productId: item.productId, qty: item.quantity * multiplier });
      }
    }

    // 2. GHOST NOTE: Create Notification
    const performerName = req.userRole === 'owner' ? 'Owner' : 'Staff';
    const notification = new Notification({
      businessId: req.businessId,
      message: `Sale to ${transaction.customerName || 'Customer'} deleted`,
      amount: transaction.totalAmount || 0,
      performedBy: performerName,
      type: 'deletion',
      shopId,
      payload: { transactionId: transaction.id, shopId }
    });
    await notification.save();

    // 3. DELETE the transaction
    await Transaction.deleteOne({ id: req.params.id, businessId: req.businessId });

    res.json({ message: 'Transaction deleted and inventory restocked' });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ message: err.message });
    console.error('Delete Transaction Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
