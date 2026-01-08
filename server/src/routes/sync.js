const express = require('express');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Business = require('../models/Business');
const Expenditure = require('../models/Expenditure');
const auth = require('../middleware/auth');

const router = express.Router();

const toDecimal = (value) => {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return mongoose.Types.Decimal128.fromString('0');
  return mongoose.Types.Decimal128.fromString(String(value));
};

// Helper to safely convert Decimal128 to Number
const parseDecimal = (val) => parseFloat((val || 0).toString());

router.get('/check', auth, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId).lean();
    if (!business) return res.status(404).json({ message: 'Business not found' });

    const now = new Date();
    const trialEndsAt = business.trialEndsAt ? new Date(business.trialEndsAt) : null;
    const accessActive = Boolean(trialEndsAt && trialEndsAt >= now);

    return res.json({
      trialEndsAt: business.trialEndsAt,
      isSubscribed: business.isSubscribed,
      accessActive
    });
  } catch (err) {
    return res.status(500).json({ message: 'Sync check failed' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const businessId = req.businessId;

    // 1. Fetch raw data
    const businessData = await Business.findById(businessId).lean();
    // FIX: Expenditures must query by 'business' (ObjectId), not 'businessId' (String)
    const rawProducts = await Product.find({ businessId }).lean();
    const rawTransactions = await Transaction.find({ businessId }).lean();
    const rawExpenditures = await Expenditure.find({ business: businessId }).lean();

    // 2. Map backend data to frontend-friendly formats (Numbers instead of Decimals)

    const products = rawProducts.map(p => ({
      ...p,
      currentStock: p.stock,
      sellingPrice: parseDecimal(p.sellingPrice),
      costPrice: parseDecimal(p.costPrice),
      units: (p.units || []).map(u => ({
        ...u,
        sellingPrice: parseDecimal(u.sellingPrice),
        costPrice: parseDecimal(u.costPrice)
      }))
    }));

    // FIX FOR INVOICE PREVIEW: Convert Transaction Decimals to Numbers
    const transactions = rawTransactions.map(t => ({
      ...t,
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

    // FIX FOR EXPENDITURES: Convert Decimals to Numbers
    const expenditures = rawExpenditures.map(e => ({
      ...e,
      amount: parseDecimal(e.amount)
    }));

    return res.json({
      products,
      transactions,
      expenditures,
      business: {
        name: businessData.name,
        email: businessData.email,
        phone: businessData.phone,
        address: businessData.address
        // Note: Logo and Theme are intentionally excluded from sync
      }
    });
  } catch (err) {
    console.error('Fetch State Error:', err);
    return res.status(500).json({ message: 'Fetch state failed' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { products = [], transactions = [], expenditures = [], business } = req.body || {};
    const businessId = req.businessId;

    if (business && typeof business === 'object') {
       await Business.findByIdAndUpdate(businessId, { $set: { ...business, lastActiveAt: new Date() } });
    }

    // --- PHASE 1: Strict Transaction Processing (Deduct Stock First) ---
    // Iterate new transactions and deduct stock using $inc to guarantee accuracy.
    if (Array.isArray(transactions) && transactions.length > 0) {
      // 1. Identify which transactions are ALREADY in the DB to avoid double counting.
      const txIds = transactions.map(t => t.id);
      const existingTxs = await Transaction.find({ businessId, id: { $in: txIds } }).select('id').lean();
      const existingTxIds = new Set(existingTxs.map(t => t.id));

      const newTransactions = transactions.filter(t => !existingTxIds.has(t.id));

      // 2. For each NEW transaction, decrement stock atomically.
      const deductionOps = [];
      for (const tx of newTransactions) {
        if (tx.items && Array.isArray(tx.items)) {
          for (const item of tx.items) {
             // Logic: quantity * multiplier. e.g. 2 Cartons (x12) = 24 units deduction.
             const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
             const qtyToDeduct = (item.quantity || 0) * multiplier;

             if (qtyToDeduct > 0) {
                deductionOps.push(
                  Product.updateOne(
                    { businessId, id: item.productId },
                    { $inc: { stock: -qtyToDeduct } }
                  )
                );
             }
          }
        }
      }

      if (deductionOps.length > 0) {
        await Promise.all(deductionOps);
      }
    }

    // --- PHASE 2: Product Synchronization (Smart Updates) ---
    // Apply product updates. Only overwrite 'stock' if it's a manual update.
    if (Array.isArray(products) && products.length > 0) {
      const productOps = products.map((p) => {
        // Base update fields (Always update details like name, price, etc.)
        const setFields = {
          businessId,
          id: p.id,
          name: p.name,
          category: p.category,
          baseUnit: p.baseUnit || 'Piece',
          sellingPrice: toDecimal(p.sellingPrice),
          costPrice: toDecimal(p.costPrice),
          units: Array.isArray(p.units) ? p.units.map(u => ({
            name: u.name,
            multiplier: u.multiplier,
            sellingPrice: toDecimal(u.sellingPrice),
            costPrice: toDecimal(u.costPrice)
          })) : [],
          updatedAt: new Date()
        };

        const setOnInsertFields = {};

        // CONDITIONAL STOCK UPDATE:
        if (p.isManualUpdate) {
          // Manual override: Force update stock
          setFields.stock = p.currentStock !== undefined ? p.currentStock : p.stock;
        } else {
          // Not manual: Only set stock if we are INSERTING a new document
          setOnInsertFields.stock = p.currentStock !== undefined ? p.currentStock : 0;
        }

        const updateOp = {
          $set: setFields
        };

        if (Object.keys(setOnInsertFields).length > 0) {
          updateOp.$setOnInsert = setOnInsertFields;
        }

        return {
          updateOne: {
            filter: { businessId, id: p.id },
            update: updateOp,
            upsert: true
          }
        };
      });

      await Product.bulkWrite(productOps, { ordered: false });
    }

    // --- PHASE 3: Save Transactions (Persist History) ---
    if (Array.isArray(transactions) && transactions.length > 0) {
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
                unit: item.selectedUnit ? item.selectedUnit.name : (item.unit || undefined),
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
              isSignatureLocked: t.isSignatureLocked,
              staffId: t.staffId,
              createdAt: t.transactionDate ? new Date(t.transactionDate) : new Date()
            }
          },
          upsert: true
        }
      }));
      await Transaction.bulkWrite(txOps, { ordered: false });
    }

    // 4. Save Expenditures
    if (Array.isArray(expenditures) && expenditures.length > 0) {
      const expOps = expenditures.map((e) => ({
        updateOne: {
          filter: { business: businessId, id: e.id },
          update: {
            $set: {
              business: businessId, // Matches Model (ObjectId)
              user: req.user ? req.user.id : undefined, // Audit trail
              id: e.id,
              date: e.date ? new Date(e.date) : new Date(),
              amount: toDecimal(e.amount),
              category: e.category,
              title: e.title,
              description: e.description,
              paymentMethod: e.paymentMethod,
              note: e.note,
              createdBy: e.createdBy
            }
          },
          upsert: true
        }
      }));
      await Expenditure.bulkWrite(expOps, { ordered: false });
    }

    // 5. Return Data (Re-using the GET logic for consistency)
    const rawProducts = await Product.find({ businessId }).lean();
    const rawTransactions = await Transaction.find({ businessId }).lean();
    const rawExpenditures = await Expenditure.find({ business: businessId }).lean();

    const fetchedProducts = rawProducts.map(p => ({
      ...p,
      currentStock: p.stock,
      sellingPrice: parseDecimal(p.sellingPrice),
      costPrice: parseDecimal(p.costPrice),
      units: (p.units || []).map(u => ({
        ...u,
        sellingPrice: parseDecimal(u.sellingPrice),
        costPrice: parseDecimal(u.costPrice)
      }))
    }));

    const fetchedTransactions = rawTransactions.map(t => ({
      ...t,
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

    const fetchedExpenditures = rawExpenditures.map(e => ({
      ...e,
      amount: parseDecimal(e.amount)
    }));

    return res.json({
      syncedAt: new Date().toISOString(),
      products: fetchedProducts,
      transactions: fetchedTransactions,
      expenditures: fetchedExpenditures
    });
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
