const express = require('express');
const mongoose = require('mongoose');
const { Decimal128, ObjectId } = mongoose.Types;

// Models
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Business = require('../models/Business');
const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');
const Notification = require('../models/Notification');
const { maybeCreateStockVerificationNotification } = require('../services/stockVerification');

// Middleware
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');

const router = express.Router();

// --- HELPER FUNCTIONS ---
const toDecimal = (value) => {
  if (value === null || value === undefined || value === '') return mongoose.Types.Decimal128.fromString('0');
  if (value instanceof Decimal128) return value;
  return mongoose.Types.Decimal128.fromString(String(value));
};

const parseDecimal = (val) => {
  if (!val) return 0;
  if (val.toString) return parseFloat(val.toString());
  return Number(val);
};

const normalizeCustomerName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'Walk-in Customer';
  return clean
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

// --- ROUTES ---

// 0. Version Check
router.get('/version', auth, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId).select('dataVersion');
    // Return version as a float, defaulting to 0.000
    // Ensure it's a number for the JSON response
    const version = business?.dataVersion ? parseFloat(business.dataVersion.toString()) : 0.000;
    res.json({ version });
  } catch (err) {
    console.error('Version check failed:', err);
    res.status(500).json({ version: 0.000 });
  }
});

// 1. GET Full State (Online-Only Mode) - EMERGENCY VERSION
router.get('/', auth, async (req, res) => {
  try {
    // FORCE FIX: Trim whitespace to prevent invisible mismatches
    const businessId = String(req.businessId).trim();

    console.log(`[SYNC] 🚀 STARTING FETCH for Business ID: "${businessId}"`);

    // Fetch All Data (Simple Query)
    const [businessData, rawProducts, rawTransactions, rawExpenditures, rawCategories, rawNotifications] = await Promise.all([
      Business.findById(businessId).lean(),
      Product.find({
        businessId: { $in: [businessId, new ObjectId(businessId)] }
      }).lean(),
      Transaction.find({ businessId }).sort({ createdAt: -1 }).limit(1000).lean(),
      Expenditure.find({ business: businessId }).lean(),
      Category.find({ businessId }).sort({ usageCount: -1, name: 1 }).lean(),
      Notification.find({ businessId, dismissedAt: null }).sort({ timestamp: -1 }).limit(50).lean()
    ]);

    // --- DETECTIVE MODE: DIAGNOSE EMPTY PRODUCTS ---
    console.log(`[SYNC] Found ${rawProducts.length} products.`);

    if (rawProducts.length === 0) {
        console.log(`[SYNC] ⚠️ PRODUCTS EMPTY! Running Emergency Check...`);

        // Check if ANY products exist in the DB at all
        const anyProduct = await Product.findOne({}).lean();

        if (anyProduct) {
            console.log(`[SYNC] 🕵️  DB Check: Products DO exist.`);
            console.log(`[SYNC] 🕵️  Comparison:`);
            console.log(`[SYNC]    👉 Your ID: "${businessId}"`);
            console.log(`[SYNC]    👉 DB ID:   "${anyProduct.businessId}"`);

            if (String(anyProduct.businessId) === String(businessId)) {
                console.log(`[SYNC] 🤯 IDs match but query failed? Check Mongoose version.`);
            } else {
                console.log(`[SYNC] ✅ Result: ID Mismatch. You are logged into the wrong account.`);
            }
        } else {
            console.log(`[SYNC] 🛑 Result: The 'products' collection is totally empty.`);
        }
    }
    // ------------------------------------------------

    // Map Decimals to Numbers
    const categories = rawCategories.map(c => ({
      id: c._id.toString(),
      name: c.name,
      businessId: c.businessId,
      defaultSellingPrice: parseDecimal(c.defaultSellingPrice),
      defaultCostPrice: parseDecimal(c.defaultCostPrice),
      defaultUnit: c.defaultUnit || ''
    }));

    const products = rawProducts.map(p => ({
      ...p,
      id: (p.id && p.id !== 'undefined' && p.id !== 'null') ? p.id : p._id.toString(),
      currentStock: p.stock !== undefined ? p.stock : (p.currentStock || 0),
      sellingPrice: parseDecimal(p.sellingPrice),
      costPrice: parseDecimal(p.costPrice),
      units: (p.units || []).map(u => ({
        ...u,
        sellingPrice: parseDecimal(u.sellingPrice),
        costPrice: parseDecimal(u.costPrice)
      }))
    }));

    const transactions = rawTransactions.map(t => ({
      ...t,
      id: (t.id && t.id !== 'undefined' && t.id !== 'null') ? t.id : t._id.toString(),
      isPreviousDebt: Boolean(t.isPreviousDebt),
      items: (t.items || []).map(i => ({
        ...i,
        unitPrice: parseDecimal(i.unitPrice),
        discount: parseDecimal(i.discount),
        total: parseDecimal(i.total)
      })),
      subtotal: parseDecimal(t.subtotal),
      globalDiscount: parseDecimal(t.globalDiscount),
      totalAmount: parseDecimal(t.totalAmount),
      amountPaid: parseDecimal(t.amountPaid),
      balance: parseDecimal(t.balance)
    }));

    const expenditures = rawExpenditures.map(e => {
      const val = parseDecimal(e.amount);
      let finalAmount = val;
      let finalFlow = 'out'; // Default

      // 1. Respect existing label if present
      if (e.flowType === 'out') {
        finalFlow = 'out';
        finalAmount = -Math.abs(val); // Force Negative
      } else if (e.flowType === 'in') {
        finalFlow = 'in';
        finalAmount = Math.abs(val);  // Force Positive
      } else {
        // 2. Fallback to sign detection for new/undefined records
        finalFlow = val >= 0 ? 'in' : 'out';
        finalAmount = val;
      }

      return {
        ...e,
        id: (e.id && e.id !== 'undefined' && e.id !== 'null') ? e.id : e._id.toString(),
        amount: finalAmount,
        flowType: finalFlow
      };
    });

    const notifications = (rawNotifications || []).map(n => ({
        id: n._id.toString(),
        title: n.title || '',
        message: n.message,
        body: n.body || '',
        type: n.type,
        amount: n.amount,
        performedBy: n.performedBy,
        payload: n.payload || null,
        timestamp: n.timestamp
    }));

    // Keep proactive prompts low-noise (max once/day)
    await maybeCreateStockVerificationNotification(businessId);

    return res.json({
      categories,
      products,
      transactions,
      expenditures,
      notifications,
      business: businessData ? {
        id: businessData._id,
        name: businessData.name,
        email: businessData.email,
        phone: businessData.phone,
        address: businessData.address,
        staffPermissions: businessData.staffPermissions,
        settings: businessData.settings,
        trialEndsAt: businessData.trialEndsAt,
        isSubscribed: businessData.isSubscribed,
        logo: businessData.logo,
        theme: businessData.theme
      } : undefined
    });

  } catch (err) {
    console.error('[SYNC DEBUG] ❌ Error:', err);
    return res.status(500).json({ message: 'Fetch state failed' });
  }
});

// 2. POST Updates (Direct-Push Mode)
router.post('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { products = [], transactions = [], expenditures = [], business, categories = [] } = req.body || {};
    const businessId = req.businessId;

    if (business && typeof business === 'object') {
       const { staffPermissions, trialEndsAt, isSubscribed, ...safeUpdates } = business;
       await Business.findByIdAndUpdate(businessId, { $set: { ...safeUpdates, lastActiveAt: new Date() } });
    }

    // 3. Increment Version if changes detected
    if (categories.length > 0 || products.length > 0 || transactions.length > 0 || expenditures.length > 0) {
        await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 0.001 } });
    }

    if (categories.length > 0) {
      const catOps = categories.map(c => ({
        updateOne: {
          filter: { businessId, name: c.name },
          update: { $set: { businessId, name: c.name, defaultSellingPrice: toDecimal(c.defaultSellingPrice), defaultCostPrice: toDecimal(c.defaultCostPrice), defaultUnit: c.defaultUnit || '' } },
          upsert: true
        }
      }));
      await Category.bulkWrite(catOps);
    }

    if (products.length > 0) {
      const productOps = products.map((p) => ({
        updateOne: {
          filter: { businessId, id: p.id },
          update: {
            $set: {
              businessId,
              id: p.id,
              name: p.name,
              category: p.category,
              stock: p.currentStock,
              sellingPrice: toDecimal(p.sellingPrice),
              costPrice: toDecimal(p.costPrice),
              baseUnit: p.baseUnit || 'Piece',
              units: Array.isArray(p.units) ? p.units.map(u => ({
                name: u.name,
                multiplier: u.multiplier,
                sellingPrice: toDecimal(u.sellingPrice),
                costPrice: toDecimal(u.costPrice)
              })) : [],
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));
      await Product.bulkWrite(productOps);
    }

    if (transactions.length > 0) {
      const incomingIds = transactions
        .map((t) => String(t?.id || '').trim())
        .filter(Boolean);

      const existingTxs = incomingIds.length > 0
        ? await Transaction.find({ businessId, id: { $in: incomingIds } }).lean()
        : [];

      const existingMap = new Map(existingTxs.map(t => [t.id, t]));

      const txOps = transactions.map((t) => {
        const txId = String(t?.id || '').trim();
        if (!txId) return null;

        const existing = existingMap.get(txId);
        const incomingUpdatedAt = t.updatedAt ? new Date(t.updatedAt) : new Date();
        if (Number.isNaN(incomingUpdatedAt.getTime())) {
          return null;
        }

        if (existing) {
          const existingUpdatedAt = existing.clientUpdatedAt
            ? new Date(existing.clientUpdatedAt)
            : new Date(existing.updatedAt || existing.createdAt || 0);

          if (!Number.isNaN(existingUpdatedAt.getTime()) && incomingUpdatedAt <= existingUpdatedAt) {
            return null;
          }
        }

        const updateData = {
          businessId,
          id: txId,
          transactionDate: t.transactionDate ? new Date(t.transactionDate) : null,
          customerName: normalizeCustomerName(t.customerName),
          customerPhone: t.customerPhone || '',
          isPreviousDebt: Boolean(t.isPreviousDebt),
          items: (t.items || []).map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.selectedUnit ? item.selectedUnit.name : item.unit,
            multiplier: item.selectedUnit ? item.selectedUnit.multiplier : (item.multiplier || 1),
            unitPrice: toDecimal(item.unitPrice),
            discount: toDecimal(item.discount),
            total: toDecimal(item.total)
          })),
          subtotal: toDecimal(t.subtotal),
          globalDiscount: toDecimal(t.globalDiscount),
          totalAmount: toDecimal(t.totalAmount),
          paymentMethod: t.paymentMethod || 'cash',
          amountPaid: toDecimal(t.amountPaid),
          balance: toDecimal(t.balance),
          paymentStatus: t.paymentStatus === 'credit' ? 'credit' : 'paid',
          signature: t.signature,
          isSignatureLocked: Boolean(t.isSignatureLocked),
          staffId: t.staffId || (t.createdByRole === 'staff' ? 'Store Staff' : 'owner'),
          createdByRole: t.createdByRole === 'staff' ? 'staff' : 'owner',
          createdByUserId: t.createdByUserId ? String(t.createdByUserId) : '',
          clientUpdatedAt: incomingUpdatedAt,
          updatedAt: new Date()
        };

        if (existing) {
          return {
            updateOne: {
              filter: { businessId, id: txId },
              update: { $set: updateData }
            }
          };
        }

        return {
          insertOne: {
            document: {
              ...updateData,
              createdAt: t.transactionDate ? new Date(t.transactionDate) : new Date()
            }
          }
        };
      }).filter(Boolean);

      if (txOps.length > 0) {
        await Transaction.bulkWrite(txOps);
      }
    }

    if (expenditures.length > 0) {

      const expOps = expenditures.map((e) => {
        const val = parseDecimal(e.amount);
        return {
          updateOne: {
            filter: { business: businessId, id: e.id },
            update: {
              $set: {
                business: businessId,
                id: e.id,
                date: e.date ? new Date(e.date) : new Date(),
                amount: toDecimal(e.amount),
                category: e.category,
                title: e.title,
                description: e.description,
                paymentMethod: e.paymentMethod,
                expenseType: e.expenseType || 'business',
                updatedAt: new Date(),
                flowType: val >= 0 ? 'in' : 'out'
              }
            },
            upsert: true
          }
        };
      });
      await Expenditure.bulkWrite(expOps);
    }

    return res.json({ success: true, syncedAt: new Date() });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sync failed' });
  }
});

// TEMPORARY FIX: Transfer all products to the current user
router.get('/fix-ids', auth, async (req, res) => {
  try {
    const myId = String(req.businessId).trim();
    const result = await Product.updateMany({}, { $set: { businessId: myId } });
    res.json({ message: `Fixed! transferred ${result.modifiedCount} products to ${myId}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. DELETE Routes (Missing in original sync)
router.delete('/products/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;
    await Product.deleteOne({ businessId, id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

router.delete('/transactions/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = new mongoose.Types.ObjectId(req.businessId); // Transactions use ObjectId

    // 1. Find transaction first (needed for both restock and notification)
    const transaction = await Transaction.findOne({ businessId, id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // 2. Restock if requested
    if (req.query.restock === 'true' && transaction.items) {
        // Restore stock
        for (const item of transaction.items) {
             await Product.updateOne(
                { businessId: req.businessId, id: item.productId },
                { $inc: { stock: item.quantity } }
             );
        }
    }

    // 3. Create Ghost Note (Notification)
    const performerName = req.userRole === 'owner' ? 'Owner' : 'Staff';
    await Notification.create({
        businessId: req.businessId,
        message: `Sale to ${transaction.customerName || 'Customer'} deleted`,
        amount: transaction.totalAmount || 0,
        performedBy: performerName,
        type: 'deletion'
    });

    // 4. Hard Delete
    await Transaction.deleteOne({ businessId, id });
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

router.delete('/expenditures/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;
    await Expenditure.deleteOne({ business: businessId, id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;
