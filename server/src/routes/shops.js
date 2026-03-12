const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');
const Shop = require('../models/Shop');
const Business = require('../models/Business');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const ProductShopStock = require('../models/ProductShopStock');
const { ensureDefaultShopForBusiness } = require('../services/shopContext');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const businessId = String(req.businessId);
    const defaultShopId = await ensureDefaultShopForBusiness(businessId);
    const shops = await Shop.find({ businessId }).sort({ isMain: -1, createdAt: 1 }).lean();

    const payload = shops.map((shop) => ({
      id: String(shop._id),
      name: shop.name,
      isMain: Boolean(shop.isMain),
      status: shop.status || 'active',
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt
    }));

    res.json({
      shops: payload,
      defaultShopId,
      meta: {
        activeShopCount: payload.filter((s) => s.status === 'active').length,
        totalShopCount: payload.length
      }
    });
  } catch (err) {
    console.error('List shops error:', err);
    res.status(500).json({ message: 'Could not load shops' });
  }
});

router.post('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    if (req.userRole !== 'owner') {
      return res.status(403).json({ message: 'Only owner can create shops.' });
    }

    const businessId = String(req.businessId);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Shop name is required.' });

    await ensureDefaultShopForBusiness(businessId);
    const shop = await Shop.create({ businessId, name, normalizedName: name.toLowerCase(), isMain: false, status: 'active' });

    res.status(201).json({
      shop: {
        id: String(shop._id),
        name: shop.name,
        isMain: shop.isMain,
        status: shop.status,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt
      }
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'A shop with this name already exists.' });
    }
    console.error('Create shop error:', err);
    res.status(500).json({ message: 'Could not create shop' });
  }
});

router.put('/:shopId', auth, requireActiveSubscription, async (req, res) => {
  try {
    if (req.userRole !== 'owner') {
      return res.status(403).json({ message: 'Only owner can rename shops.' });
    }

    const businessId = String(req.businessId);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Shop name is required.' });

    const shop = await Shop.findOneAndUpdate(
      { _id: req.params.shopId, businessId },
      { $set: { name, normalizedName: name.toLowerCase() } },
      { new: true, runValidators: true }
    );
    if (!shop) return res.status(404).json({ message: 'Shop not found.' });

    res.json({
      shop: {
        id: String(shop._id),
        name: shop.name,
        isMain: shop.isMain,
        status: shop.status,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt
      }
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'A shop with this name already exists.' });
    }
    console.error('Rename shop error:', err);
    res.status(500).json({ message: 'Could not rename shop' });
  }
});

router.get('/summary/overview', auth, async (req, res) => {
  try {
    const businessId = String(req.businessId);
    const shops = await Shop.find({ businessId, status: 'active' }).lean();
    const shopIds = shops.map((s) => String(s._id));

    const [sales, expenses, stock] = await Promise.all([
      Transaction.aggregate([
        { $match: { businessId: req.businessId, shopId: { $in: shopIds } } },
        { $group: { _id: '$shopId', sales: { $sum: { $toDouble: '$totalAmount' } } } }
      ]),
      Expenditure.aggregate([
        { $match: { business: new mongoose.Types.ObjectId(req.businessId), shopId: { $in: shopIds } } },
        { $group: { _id: '$shopId', expenses: { $sum: { $toDouble: '$amount' } } } }
      ]),
      ProductShopStock.aggregate([
        { $match: { businessId, shopId: { $in: shopIds } } },
        { $group: { _id: '$shopId', itemCount: { $sum: '$onHand' } } }
      ])
    ]);

    const salesMap = new Map(sales.map((x) => [x._id, Number(x.sales || 0)]));
    const expMap = new Map(expenses.map((x) => [x._id, Number(x.expenses || 0)]));
    const stockMap = new Map(stock.map((x) => [x._id, Number(x.itemCount || 0)]));

    const rows = shops.map((s) => ({
      shopId: String(s._id),
      name: s.name,
      sales: salesMap.get(String(s._id)) || 0,
      expenses: expMap.get(String(s._id)) || 0,
      inventoryUnits: stockMap.get(String(s._id)) || 0
    }));

    const totals = rows.reduce((acc, row) => ({
      sales: acc.sales + row.sales,
      expenses: acc.expenses + row.expenses,
      inventoryUnits: acc.inventoryUnits + row.inventoryUnits
    }), { sales: 0, expenses: 0, inventoryUnits: 0 });

    res.json({ rows, totals });
  } catch (err) {
    console.error('Shop overview error:', err);
    res.status(500).json({ message: 'Could not fetch shop overview' });
  }
});

module.exports = router;
