const express = require('express');
const mongoose = require('mongoose');
const { Decimal128 } = mongoose.Types;

// Models
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Business = require('../models/Business');
const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');

// Middleware
const auth = require('../middleware/auth');

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

// --- ROUTES ---

// 1. GET Full State (Online-Only Mode) - EMERGENCY VERSION
router.get('/', auth, async (req, res) => {
  try {
    // FORCE FIX: Trim whitespace to prevent invisible mismatches
    const businessId = String(req.businessId).trim();

    console.log(`[SYNC] 🚀 STARTING FETCH for Business ID: "${businessId}"`);

    // Fetch All Data (Simple Query)
    const [businessData, rawProducts, rawTransactions, rawExpenditures, rawCategories] = await Promise.all([
      Business.findById(businessId).lean(),
      Product.find({ businessId: businessId }).lean(),
      Transaction.find({ businessId }).sort({ createdAt: -1 }).limit(1000).lean(),
      Expenditure.find({ business: businessId }).lean(),
      Category.find({ businessId }).sort({ usageCount: -1, name: 1 }).lean()
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
      defaultCostPrice: parseDecimal(c.defaultCostPrice)
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

    const expenditures = rawExpenditures.map(e => ({
      ...e,
      id: (e.id && e.id !== 'undefined' && e.id !== 'null') ? e.id : e._id.toString(),
      amount: parseDecimal(e.amount)
    }));

    return res.json({
      categories,
      products,
      transactions,
      expenditures,
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
router.post('/', auth, async (req, res) => {
  try {
    const { products = [], transactions = [], expenditures = [], business, categories = [] } = req.body || {};
    const businessId = req.businessId;

    if (business && typeof business === 'object') {
       const { staffPermissions, trialEndsAt, isSubscribed, ...safeUpdates } = business;
       await Business.findByIdAndUpdate(businessId, { $set: { ...safeUpdates, lastActiveAt: new Date() } });
    }

    if (categories.length > 0) {
      const catOps = categories.map(c => ({
        updateOne: {
          filter: { businessId, name: c.name },
          update: { $set: { businessId, name: c.name, defaultSellingPrice: toDecimal(c.defaultSellingPrice), defaultCostPrice: toDecimal(c.defaultCostPrice) } },
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
      const txOps = transactions.map((t) => ({
        updateOne: {
          filter: { businessId, id: t.id },
          update: {
            $set: {
              businessId,
              id: t.id,
              transactionDate: t.transactionDate ? new Date(t.transactionDate) : null,
              customerName: t.customerName,
              items: (t.items || []).map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unit: item.selectedUnit ? item.selectedUnit.name : undefined,
                multiplier: item.selectedUnit ? item.selectedUnit.multiplier : (item.multiplier || 1),
                unitPrice: toDecimal(item.unitPrice),
                discount: toDecimal(item.discount),
                total: toDecimal(item.total)
              })),
              subtotal: toDecimal(t.subtotal),
              globalDiscount: toDecimal(t.globalDiscount),
              totalAmount: toDecimal(t.totalAmount),
              amountPaid: toDecimal(t.amountPaid),
              balance: toDecimal(t.balance),
              createdAt: t.transactionDate ? new Date(t.transactionDate) : new Date(),
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));
      await Transaction.bulkWrite(txOps);
    }

    if (expenditures.length > 0) {
      const expOps = expenditures.map((e) => ({
        updateOne: {
          filter: { business: businessId, id: e.id },
          update: { $set: { business: businessId, id: e.id, date: e.date ? new Date(e.date) : new Date(), amount: toDecimal(e.amount), category: e.category, title: e.title, description: e.description, paymentMethod: e.paymentMethod, updatedAt: new Date() } },
          upsert: true
        }
      }));
      await Expenditure.bulkWrite(expOps);
    }

    return res.json({ success: true, syncedAt: new Date() });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sync failed' });
  }
});

module.exports = router;
