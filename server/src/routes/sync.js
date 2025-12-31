const express = require('express');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Business = require('../models/Business');
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

router.post('/', auth, async (req, res) => {
  try {
    const { products = [], transactions = [], expenditures = [], business } = req.body || {};
    const businessId = req.businessId;

    if (business && typeof business === 'object') {
      await Business.findByIdAndUpdate(businessId, {
        $set: {
          name: business.name,
          phone: business.phone,
          address: business.address,
          logo: business.logo,
          theme: business.theme
        }
      });
    }

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
              stock: p.stock,
              costPrice: toDecimal(p.costPrice),
              units: (p.units || []).map(u => ({
                name: u.name,
                multiplier: u.multiplier,
                sellingPrice: toDecimal(u.sellingPrice)
              })),
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));
      await Product.bulkWrite(productOps, { ordered: false });
    }

    if (Array.isArray(transactions) && transactions.length > 0) {
      const productUpdateOps = [];
      const txOps = transactions.map((t) => {
        (t.items || []).forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            const unit = (product.units || []).find(u => u.name === item.unit);
            if (unit) {
              const stockDeduction = item.quantity * unit.multiplier;
              productUpdateOps.push({
                updateOne: {
                  filter: { businessId, id: item.productId },
                  update: { $inc: { stock: -stockDeduction } }
                }
              });
            }
          }
        });

        return {
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
                  unit: item.unit,
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
        };
      });

      if (productUpdateOps.length > 0) {
        await Product.bulkWrite(productUpdateOps, { ordered: false });
      }
      await Transaction.bulkWrite(txOps, { ordered: false });
    }

    if (Array.isArray(expenditures) && expenditures.length > 0) {
      const expenditureOps = expenditures.map((e) => ({
        updateOne: {
          filter: { businessId, id: e.id },
          update: {
            $set: {
              businessId,
              id: e.id,
              date: e.date ? new Date(e.date) : new Date(),
              amount: e.amount,
              category: e.category,
              note: e.note,
              createdBy: e.createdBy
            }
          },
          upsert: true
        }
      }));
      await Expenditure.bulkWrite(expenditureOps, { ordered: false });
    }

    return res.json({ syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Sync error:', err);
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
