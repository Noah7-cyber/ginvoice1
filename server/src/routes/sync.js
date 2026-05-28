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
const { decrementStock, restoreStock } = require('../services/stockAdapter');

// Middleware
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');

const router = express.Router();

const withAtomic = async (work) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => work(session));
  } catch (err) {
    if (err?.code === 20 || String(err?.message || '').includes('Transaction numbers are only allowed')) {
      await work(null);
    } else {
      throw err;
    }
  } finally {
    await session.endSession();
  }
};

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

const parseDomainsParam = (value) => {
  if (!value) return null;
  const requested = String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (requested.length === 0) return null;
  return new Set(requested);
};

const parseDateOrFallback = (value, fallback = null) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};


// 0. Time Check (Anti-Cheat)
router.get('/time', (req, res) => {
    // Return server time for drift calculation
    res.json({ time: Date.now() });
});

// 0. Version Check
router.get('/version', auth, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId).select('dataVersion syncVersions');
    // Return version as a float, defaulting to 0.000
    // Ensure it's a number for the JSON response
    const version = normalizeVersion(business?.dataVersion);
    const versions = {
      transactions: normalizeVersion(business?.syncVersions?.transactions),
      products: normalizeVersion(business?.syncVersions?.products),
      expenditures: normalizeVersion(business?.syncVersions?.expenditures),
      categories: normalizeVersion(business?.syncVersions?.categories)
    };
    res.json({ version, versions });
  } catch (err) {
    console.error('Version check failed:', err);
    res.status(500).json({
      version: 0.000,
      versions: { transactions: 0.000, products: 0.000, expenditures: 0.000, categories: 0.000 }
    });
  }
});

// 1. GET Full State (Online-Only Mode) - EMERGENCY VERSION
router.get('/', auth, async (req, res) => {
  try {
    const businessId = String(req.businessId).trim();
    console.log(`[SYNC] 🚀 STARTING FETCH for Business ID: "${businessId}"`);

    const requestedDomains = parseDomainsParam(req.query.domains);
    const shouldInclude = (domain) => !requestedDomains || requestedDomains.has(domain);

    const productsPromise = shouldInclude('products')
      ? Product.find({ businessId: { $in: [businessId, new mongoose.Types.ObjectId(businessId)] } }).lean()
      : Promise.resolve([]);
    const transactionsPromise = shouldInclude('transactions')
      ? Transaction.find({ businessId: { $in: [businessId, new mongoose.Types.ObjectId(businessId)] } }).sort({ createdAt: -1 }).lean()
      : Promise.resolve([]);
    const expendituresPromise = shouldInclude('expenditures')
      ? Expenditure.find({ business: { $in: [businessId, new mongoose.Types.ObjectId(businessId)] } }).lean()
      : Promise.resolve([]);
    const categoriesPromise = shouldInclude('categories')
      ? Category.find({ businessId }).sort({ usageCount: -1, name: 1 }).lean()
      : Promise.resolve([]);
    const notificationsPromise = shouldInclude('notifications')
      ? Notification.find({ businessId, dismissedAt: null }).sort({ timestamp: -1 }).limit(50).lean()
      : Promise.resolve([]);

    const [rawProducts, rawTransactions, rawExpenditures, rawCategories, rawNotifications] = await Promise.all([
      productsPromise,
      transactionsPromise,
      expendituresPromise,
      categoriesPromise,
      notificationsPromise
    ]);

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
      currentStock: p.stock !== undefined ? p.stock : 0, // Using stock field directly
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
      subtotal: parseDecimal(t.subtotal),
      globalDiscount: parseDecimal(t.globalDiscount),
      totalAmount: parseDecimal(t.totalAmount),
      amountPaid: parseDecimal(t.amountPaid),
      balance: parseDecimal(t.balance),
      items: (t.items || []).map(i => ({
        ...i,
        unitPrice: parseDecimal(i.unitPrice),
        discount: parseDecimal(i.discount),
        total: parseDecimal(i.total)
      }))
    }));

    const expenditures = rawExpenditures.map(e => ({
      ...e,
      amount: parseDecimal(e.amount)
    }));

    const notifications = rawNotifications;

    res.json({
      products,
      transactions,
      expenditures,
      categories,
      notifications,
      shops: [] // Removed multi-shop, returning empty for client compatibility
    });
  } catch (err) {
    console.error('Fetch failed:', err);
    res.status(500).json({ message: 'Sync failed' });
  }
});

// 2. POST Updates (Direct-Push Mode)
router.post('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { products = [], transactions = [], expenditures = [], business, categories = [] } = req.body || {};
    const businessId = String(req.businessId).trim();

    if (business && typeof business === 'object') {
       const { staffPermissions, trialEndsAt, isSubscribed, ...safeUpdates } = business;
       await Business.findByIdAndUpdate(businessId, { $set: { ...safeUpdates, lastActiveAt: new Date() } });
    }

    const changedDomains = {
      categories: categories.length > 0,
      products: products.length > 0,
      transactions: transactions.length > 0,
      expenditures: expenditures.length > 0
    };

    // 3. Increment Version(s) if changes detected
    if (Object.values(changedDomains).some(Boolean)) {
      const inc = { dataVersion: 0.001 };
      if (changedDomains.categories) inc['syncVersions.categories'] = 0.001;
      if (changedDomains.products) inc['syncVersions.products'] = 0.001;
      if (changedDomains.transactions) inc['syncVersions.transactions'] = 0.001;
      if (changedDomains.expenditures) inc['syncVersions.expenditures'] = 0.001;
      await Business.findByIdAndUpdate(businessId, { $inc: inc });
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

    let skippedProducts = 0;
    let skippedTransactions = 0;
    let skippedExpenditures = 0;

    if (products.length > 0) {
      const incomingProductIds = products.map((p) => String(p?.id || '').trim()).filter(Boolean);
      const existingProducts = incomingProductIds.length > 0
        ? await Product.find({ businessId, id: { $in: incomingProductIds } }).lean()
        : [];
      const existingProductMap = new Map(existingProducts.map((p) => [p.id, p]));

      const productOps = products.map((p) => {
        const productId = String(p?.id || '').trim();
        if (!productId) {
          skippedProducts += 1;
          return null;
        }

        const existing = existingProductMap.get(productId);
        const incomingUpdatedAt = p.updatedAt ? new Date(p.updatedAt) : new Date();

        if (existing) {
          const existingUpdatedAt = existing.clientUpdatedAt ? new Date(existing.clientUpdatedAt) : new Date(0);
          if (!Number.isNaN(existingUpdatedAt.getTime()) && incomingUpdatedAt <= existingUpdatedAt) {
             skippedProducts += 1;
             return null;
          }
        }

        const stockUpdate = {};
        if (p.expectedAbsoluteStock !== undefined && p.expectedAbsoluteStock !== null) {
           stockUpdate.$set = { stock: Number(p.expectedAbsoluteStock) };
        } else if (!existing) {
           stockUpdate.$set = { stock: Number(p.currentStock || p.stock || 0) };
        }

        return {
          updateOne: {
            filter: { businessId, id: productId },
            update: {
              ...stockUpdate,
              $set: {
                ...(stockUpdate.$set || {}),
                name: p.name || (existing ? existing.name : 'Unknown Product'),
                sku: p.sku || '',
                category: p.category || 'Uncategorized',
                sellingPrice: toDecimal(p.sellingPrice),
                costPrice: toDecimal(p.costPrice),
                baseUnit: p.baseUnit || 'Piece',
                units: Array.isArray(p.units) ? p.units.map(u => ({
                  name: u.name,
                  multiplier: Number(u.multiplier || 1),
                  sellingPrice: toDecimal(u.sellingPrice),
                  costPrice: toDecimal(u.costPrice)
                })) : [],
                clientUpdatedAt: incomingUpdatedAt,
                updatedAt: new Date()
              }
            },
            upsert: true
          }
        };
      }).filter(Boolean);

      if (productOps.length > 0) {
        await Product.bulkWrite(productOps);
      }
    }

    if (transactions.length > 0) {
      const incomingTxIds = transactions.map((t) => String(t?.id || '').trim()).filter(Boolean);
      const existingTxs = incomingTxIds.length > 0
        ? await Transaction.find({ businessId, id: { $in: incomingTxIds } }).lean()
        : [];
      const existingByIdMap = new Map(existingTxs.map((tx) => [tx.id, tx]));

      for (const t of transactions) {
        const txId = String(t?.id || '').trim();
        if (!txId) {
          skippedTransactions += 1;
          continue;
        }

        const safeTransactionDate = parseDateOrFallback(t.transactionDate, new Date());
        const incomingUpdatedAt = t.updatedAt ? new Date(t.updatedAt) : safeTransactionDate;

        const idempotencyKey = String(t.idempotencyKey || txId).trim();
        const existingById = existingByIdMap.get(txId) || null;
        const existingByKey = idempotencyKey
          ? await Transaction.findOne({ businessId, idempotencyKey }).lean()
          : null;
        const existing = existingById || existingByKey;

        if (existing) {
          const existingUpdatedAt = existing.clientUpdatedAt ? new Date(existing.clientUpdatedAt) : new Date(0);
          if (!Number.isNaN(existingUpdatedAt.getTime()) && incomingUpdatedAt <= existingUpdatedAt) {
            continue;
          }
        }

        const normalizedItems = (t.items || []).map((item) => ({
          productId: item.productId,
          productName: item.productName || item.productId || 'Unknown Item',
          quantity: Number(item.quantity || 0),
          unit: item.selectedUnit ? item.selectedUnit.name : item.unit,
          multiplier: item.selectedUnit ? item.selectedUnit.multiplier : (item.multiplier || 1),
          unitPrice: toDecimal(item.unitPrice),
          discount: toDecimal(item.discount),
          total: toDecimal(item.total)
        }));

        const inventoryEffect = t.inventoryEffect === 'restock' ? 'restock' : 'sale';

        try {
          await withAtomic(async (session) => {
            if (existing) {
              const existingEffect = existing.inventoryEffect === 'restock' ? 'restock' : 'sale';
              for (const item of existing.items || []) {
                const qty = Number(item.quantity || 0) * Number(item.multiplier || 1);
                if (!item.productId || qty <= 0) continue;
                if (existingEffect === 'sale') {
                  await restoreStock({ businessId, productId: item.productId, qty, session });
                } else {
                  await decrementStock({ businessId, productId: item.productId, qty, session });
                }
              }
            }

            for (const item of normalizedItems) {
              const qty = Number(item.quantity || 0) * Number(item.multiplier || 1);
              if (!item.productId || qty <= 0) continue;
              if (inventoryEffect === 'sale') {
                await decrementStock({ businessId, productId: item.productId, qty, session });
              } else {
                await restoreStock({ businessId, productId: item.productId, qty, session });
              }
            }

            await Transaction.updateOne(
              { businessId, id: existing?.id || txId },
              {
                $set: {
                  businessId,
                  id: txId,
                  idempotencyKey,
                  inventoryEffect,
                  transactionDate: safeTransactionDate,
                  customerName: normalizeCustomerName(t.customerName),
                  customerPhone: t.customerPhone || '',
                  isPreviousDebt: Boolean(t.isPreviousDebt),
                  items: normalizedItems,
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
                },
                $setOnInsert: {
                  createdAt: safeTransactionDate || new Date()
                }
              },
              { upsert: true, ...(session ? { session } : {}) }
            );
          });

          const finalDoc = await Transaction.findOne({ businessId, id: txId }).lean();
          if (finalDoc) existingByIdMap.set(txId, finalDoc);
        } catch (err) {
          skippedTransactions += 1;
        }
      }
    }

    if (expenditures.length > 0) {
      const expOps = expenditures.map((e) => {
        const expId = String(e?.id || '').trim();
        if (!expId) {
          skippedExpenditures += 1;
          return null;
        }
        const val = parseDecimal(e.amount);
        return {
          updateOne: {
            filter: { business: businessId, id: expId },
            update: {
              $set: {
                business: businessId,
                id: expId,
                date: parseDateOrFallback(e.date, new Date()),
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
      }).filter(Boolean);
      if (expOps.length > 0) {
        await Expenditure.bulkWrite(expOps);
      }
    }

    return res.json({
      success: true,
      syncedAt: new Date(),
      skipped: {
        products: skippedProducts,
        transactions: skippedTransactions,
        expenditures: skippedExpenditures
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sync failed' });
  }
});

// 3. DELETE Routes (Missing in original sync)
router.delete('/products/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = String(req.businessId).trim();

    const result = await Product.deleteOne({ businessId: { $in: [businessId, new mongoose.Types.ObjectId(businessId)] }, id });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Product not found for hard delete' });

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

    res.json({ success: true, id, hard: true });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

router.delete('/transactions/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = new mongoose.Types.ObjectId(req.businessId); // Transactions use ObjectId

    const transaction = await Transaction.findOne({ businessId, id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    if (req.query.restock === 'true' && transaction.items) {
        for (const item of transaction.items) {
             const multiplier = item.multiplier || 1;
             await restoreStock({ businessId: req.businessId, productId: item.productId, qty: item.quantity * multiplier });
        }
    }

    const performerName = req.userRole === 'owner' ? 'Owner' : 'Staff';
    await Notification.create({
        businessId: req.businessId,
        message: `Sale to ${transaction.customerName || 'Customer'} deleted`,
        amount: transaction.totalAmount || 0,
        performedBy: performerName,
        type: 'deletion',
        payload: { transactionId: transaction.id }
    });

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
