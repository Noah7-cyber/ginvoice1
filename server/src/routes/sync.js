const express = require('express');
const mongoose = require('mongoose');
const { Decimal128 } = mongoose.Types;

// Models
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Business = require('../models/Business');
const Expenditure = require('../models/Expenditure');
const DiscountCode = require('../models/DiscountCode');
const Category = require('../models/Category');

// Middleware (This was missing!)
const auth = require('../middleware/auth');

const router = express.Router();

// --- HELPER FUNCTIONS (These were missing!) ---
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

// 1. GET Full State (Online-Only Mode)
router.get('/', auth, async (req, res) => {
  try {
    const businessId = req.businessId;

    // Fetch All Data (No "Traffic Lights", No "Versions")
    const [businessData, rawProducts, rawTransactions, rawExpenditures, rawCategories] = await Promise.all([
      Business.findById(businessId).lean(),
      Product.find({ businessId }).lean(),
      Transaction.find({ businessId }).sort({ createdAt: -1 }).limit(1000).lean(), // Limit to 1000 recent
      Expenditure.find({ business: businessId }).lean(),
      Category.find({ businessId }).sort({ usageCount: -1, name: 1 }).lean()
    ]);

    // Map Decimals to Numbers for Frontend
    const categories = rawCategories.map(c => ({
      id: c._id.toString(),
      name: c.name,
      businessId: c.businessId,
      defaultSellingPrice: parseDecimal(c.defaultSellingPrice),
      defaultCostPrice: parseDecimal(c.defaultCostPrice)
    }));

    // 1. Products: Fix invisible stock
    const products = rawProducts.map(p => ({
      ...p,
      // THE FIX: Use custom ID if present, otherwise use Database ID
      id: p.id || p._id.toString(),
      currentStock: p.stock,
      sellingPrice: parseDecimal(p.sellingPrice),
      costPrice: parseDecimal(p.costPrice),
      units: (p.units || []).map(u => ({
        ...u,
        sellingPrice: parseDecimal(u.sellingPrice),
        costPrice: parseDecimal(u.costPrice)
      }))
    }));

    // 2. Transactions: Fix invisible history
    const transactions = rawTransactions.map(t => ({
      ...t,
      // THE FIX: Safety ID
      id: t.id || t._id.toString(),
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

    // 3. Expenditures: Fix invisible expenses
    const expenditures = rawExpenditures.map(e => ({
      ...e,
      // THE FIX: Safety ID
      id: e.id || e._id.toString(),
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
    console.error('Fetch State Error:', err);
    return res.status(500).json({ message: 'Fetch state failed' });
  }
});

// 2. POST Updates (Direct-Push Mode)
router.post('/', auth, async (req, res) => {
  try {
    const { products = [], transactions = [], expenditures = [], business, categories = [] } = req.body || {};
    const businessId = req.businessId;

    // A. Business Updates
    if (business && typeof business === 'object') {
       const { staffPermissions, trialEndsAt, isSubscribed, ownerPin, staffPin, logo, theme, ...safeUpdates } = business;
       await Business.findByIdAndUpdate(businessId, { $set: { ...safeUpdates, lastActiveAt: new Date() } });
    }

    // B. Categories
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

    // C. Products (Direct Stock Update - No Manual Check)
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
              stock: p.currentStock, // Direct Truth from Frontend
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

    // D. Transactions (Save & Deduct if needed)
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
              customerPhone: t.customerPhone,
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
              paymentMethod: t.paymentMethod,
              amountPaid: toDecimal(t.amountPaid),
              balance: toDecimal(t.balance),
              signature: t.signature,
              staffId: t.staffId,
              createdAt: t.transactionDate ? new Date(t.transactionDate) : new Date(),
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));
      await Transaction.bulkWrite(txOps);

      // Increment Category Usage
      const categoryIds = transactions.flatMap(t => t.items.map(i => i.categoryId)).filter(Boolean);
      if (categoryIds.length > 0) {
         // Note: Frontend sends category names usually, but if IDs, this works.
         // If using names, we'd need to map. Assuming IDs based on schema.
         await Category.updateMany({ _id: { $in: categoryIds }, businessId }, { $inc: { usageCount: 1 } });
      }
    }

    // E. Expenditures
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

router.delete('/products/:id', auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    await Product.deleteOne({ businessId, id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Delete product failed' });
  }
});

router.delete('/transactions/:id', auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { restock } = req.query;

    if (restock === 'true') {
      const transaction = await Transaction.findOne({ businessId, id }).lean();
      if (transaction && transaction.items) {
        const restockOps = transaction.items.map(item => {
           const qty = parseFloat(String(item.quantity || 0));
           const mult = parseFloat(String(item.multiplier || 1));
           const qtyToAdd = qty * mult;
           return Product.updateOne(
              { businessId, id: item.productId },
              { $inc: { stock: qtyToAdd } }
           );
        });
        await Promise.all(restockOps);
      }
    }

    await Transaction.deleteOne({ businessId, id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Delete transaction failed' });
  }
});

router.delete('/expenditures/:id', auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    await Expenditure.deleteOne({ business: businessId, id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Delete expenditure failed' });
  }
});

module.exports = router;
