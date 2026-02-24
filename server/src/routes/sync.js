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


const normalizeVersion = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(3));
};


// 0. Time Check (Anti-Cheat)
router.get('/time', (req, res) => {
    // Return server time for drift calculation
    res.json({ time: Date.now() });
});

// 0. Version Check
router.get('/version', auth, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId).select('dataVersion');
    // Return version as a float, defaulting to 0.000
    // Ensure it's a number for the JSON response
    const version = normalizeVersion(business?.dataVersion);
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
      const incomingProductIds = products
        .map((p) => String(p?.id || '').trim())
        .filter(Boolean);

      const existingProducts = incomingProductIds.length > 0
        ? await Product.find({ businessId, id: { $in: incomingProductIds } }).lean()
        : [];

      const existingProductMap = new Map(existingProducts.map((p) => [p.id, p]));
      const productNotifications = [];

      const productOps = products.map((p) => {
        const productId = String(p?.id || '').trim();
        if (!productId) return null;

        const existing = existingProductMap.get(productId);
        const incomingUpdatedAt = p.updatedAt ? new Date(p.updatedAt) : new Date();
        if (Number.isNaN(incomingUpdatedAt.getTime())) return null;

        const stockDelta = Number(p.stockDelta); // Optional Delta

        // Idempotency / Stale Check
        // If we have a delta, we want to apply it even if the timestamp is "stale" (out of order),
        // because deltas merge mathematically. However, we must prevent exact replays.
        if (existing) {
          // FIX: ONLY compare against the client's last known time, NEVER the server's time.
          const existingUpdatedAt = existing.clientUpdatedAt
            ? new Date(existing.clientUpdatedAt)
            : new Date(0); // Default to absolute past if no client time exists

          if (!Number.isNaN(existingUpdatedAt.getTime())) {
              if (typeof stockDelta === 'number' && !Number.isNaN(stockDelta)) {
                  // Delta Logic: Allow older timestamps (merging), but block exact replays
                  if (incomingUpdatedAt.getTime() === existingUpdatedAt.getTime()) return null;
              } else {
                  // LWW Logic (Standard): Block older or equal
                  // Now this will correctly accept the edit because client clock moves forward
                  if (incomingUpdatedAt <= existingUpdatedAt) return null;
              }
          }
        }

        // --- DELETION HANDLING ---
        if (p.isDeleted) {
           return {
             updateOne: {
               filter: { businessId, id: productId },
               update: { $set: { isDeleted: true, deletedAt: new Date(), clientUpdatedAt: incomingUpdatedAt, updatedAt: new Date() } }
             }
           };
        }

        // --- NOTIFICATION & DELTA LOGIC ---
        const nextSelling = Number(p.sellingPrice || 0);
        // stockDelta already declared above
        const nextStockAbsolute = Number(p.currentStock || 0);

        if (existing) {
          const prevSelling = parseDecimal(existing.sellingPrice);
          const prevStock = Number(existing.stock || 0);

          // 1. Price Change Notification
          if (nextSelling !== prevSelling) {
            productNotifications.push({
              businessId,
              type: 'modification',
              title: 'Price Changed',
              message: `Price changed for ${p.name || productId}`,
              body: `Selling price: ${prevSelling} → ${nextSelling}`,
              amount: Math.abs(nextSelling - prevSelling),
              performedBy: req.userRole === 'owner' ? 'Owner' : 'Staff',
              payload: { productId, productName: p.name || '', field: 'sellingPrice', previous: prevSelling, next: nextSelling }
            });
          }

          // 2. Stock Increase Notification
          const isManualIncrease = !Number.isNaN(stockDelta) ? stockDelta > 0 : (nextStockAbsolute > prevStock);
          const increaseAmount = !Number.isNaN(stockDelta) ? stockDelta : (nextStockAbsolute - prevStock);

          if (isManualIncrease && increaseAmount > 0) {
             // Only log significant increases (avoid noise)
             productNotifications.push({
              businessId,
              type: 'modification',
              title: 'Stock Increased',
              message: `Stock increased for ${p.name || productId}`,
              body: `Stock increased by +${increaseAmount}`,
              amount: increaseAmount,
              performedBy: req.userRole === 'owner' ? 'Owner' : 'Staff',
              payload: { productId, productName: p.name || '', field: 'stock', delta: increaseAmount }
            });
          }
        }

        // --- UPDATE CONSTRUCTION ---
        const updateSet = {
            businessId,
            id: productId,
            name: p.name,
            category: p.category,
            // stock: Set below based on delta vs absolute
            sellingPrice: toDecimal(p.sellingPrice),
            costPrice: toDecimal(p.costPrice),
            baseUnit: p.baseUnit || 'Piece',
            units: Array.isArray(p.units) ? p.units.map(u => ({
              name: u.name,
              multiplier: u.multiplier,
              sellingPrice: toDecimal(u.sellingPrice),
              costPrice: toDecimal(u.costPrice)
            })) : [],
            clientUpdatedAt: incomingUpdatedAt,
            updatedAt: new Date(),
            isDeleted: false,
            deletedAt: null // Resurrect if previously deleted
        };

        const updateOp = { $set: updateSet };

        // DELTA SYNC MAGIC: Use $inc if delta is provided, otherwise fallback to $set
        if (typeof stockDelta === 'number' && !Number.isNaN(stockDelta)) {
            updateOp.$inc = { stock: stockDelta };
        } else {
            updateSet.stock = nextStockAbsolute; // Legacy/Absolute overwrite
        }

        return {
          updateOne: {
            filter: { businessId, id: productId },
            update: updateOp,
            upsert: true
          }
        };
      }).filter(Boolean);

      if (productOps.length > 0) {
        await Product.bulkWrite(productOps);
      }

      if (productNotifications.length > 0) {
        await Notification.insertMany(productNotifications.slice(0, 50));
      }
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
          // FIX: ONLY compare against the client's last known time, NEVER the server's time.
          const existingUpdatedAt = existing.clientUpdatedAt
            ? new Date(existing.clientUpdatedAt)
            : new Date(0); // Default to absolute past if no client time exists

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
    const businessId = String(req.businessId).trim();

    // Soft Delete (Tombstone)
    const result = await Product.updateOne(
        { businessId: { $in: [businessId, new ObjectId(businessId)] }, id },
        { $set: { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() } }
    );

    if (!result.matchedCount) return res.status(404).json({ message: 'Product not found' });

    await Notification.create({
      businessId,
      title: 'Product Deleted',
      message: `Product deleted: ${id}`,
      body: 'Owner deleted an item from inventory.',
      amount: 0,
      performedBy: req.userRole === 'owner' ? 'Owner' : 'Staff',
      type: 'deletion',
      payload: { productId: id }
    });

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
