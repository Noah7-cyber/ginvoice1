const express = require('express');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Business = require('../models/Business');
const Expenditure = require('../models/Expenditure');
const auth = require('../middleware/auth');

const router = express.Router();

const toDecimal = (value) => {
  if (value === null || value === undefined || value === '') return mongoose.Types.Decimal128.fromString('0');
  return mongoose.Types.Decimal128.fromString(String(value));
};

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
    // We don't use .lean() here so that the global decimal128ToNumberPlugin applies during JSON serialization
    const products = await Product.find({ businessId });
    const transactions = await Transaction.find({ businessId });
    const expenditures = await Expenditure.find({ businessId });

    return res.json({
      products,
      transactions,
      expenditures
    });
  } catch (err) {
    return res.status(500).json({ message: 'Fetch state failed' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    // 1. Destructure expenditures from body
    const { products = [], transactions = [], expenditures = [], business } = req.body || {};
    const businessId = req.businessId;

    if (business && typeof business === 'object') {
      await Business.findByIdAndUpdate(businessId, {
        $set: {
          name: business.name,
          phone: business.phone,
          address: business.address,
          logo: business.logo,
          theme: business.theme,
          lastActiveAt: new Date()
        }
      });
    }

    // 2. Fix Product Units to include costPrice
    if (Array.isArray(products) && products.length > 0) {
      const productOps = products.map((p) => ({
        updateOne: {
          filter: { businessId, id: p.id },
          update: {
            $set: {
              businessId,
              id: p.id,
              name: p.name,
              category: p.category,
              baseUnit: p.baseUnit || 'Piece',
              stock: p.currentStock !== undefined ? p.currentStock : p.stock,
              costPrice: toDecimal(p.costPrice),
              units: Array.isArray(p.units) ? p.units.map(u => ({
                name: u.name,
                multiplier: u.multiplier,
                sellingPrice: toDecimal(u.sellingPrice),
                costPrice: toDecimal(u.costPrice) // <--- ADDED: Persist cost price
              })) : [],
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));
      await Product.bulkWrite(productOps, { ordered: false });
    }

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

    // 3. Add Logic to Save Expenditures
    if (Array.isArray(expenditures) && expenditures.length > 0) {
      const expOps = expenditures.map((e) => ({
        updateOne: {
          filter: { businessId, id: e.id },
          update: {
            $set: {
              businessId,
              id: e.id,
              date: e.date ? new Date(e.date) : new Date(),
              amount: toDecimal(e.amount),
              category: e.category,
              note: e.note,
              createdBy: e.createdBy
            }
          },
          upsert: true
        }
      }));
      await Expenditure.bulkWrite(expOps, { ordered: false });
    }

    // Fetch latest state to return
    const fetchedProducts = await Product.find({ businessId });
    const fetchedTransactions = await Transaction.find({ businessId });
    const fetchedExpenditures = await Expenditure.find({ businessId }); // <--- Include in response

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

module.exports = router;
