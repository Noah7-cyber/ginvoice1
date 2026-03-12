const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');
const Shop = require('../models/Shop');
const Business = require('../models/Business');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Notification = require('../models/Notification');
const Product = require('../models/Product');
const ProductShopStock = require('../models/ProductShopStock');
const { ensureDefaultShopForBusiness, resolveShopId } = require('../services/shopContext');

const parseDecimal = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val?.toString === 'function') {
    const parsed = Number(val.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : 0;
};

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const businessId = String(req.businessId);
    const defaultShopId = await ensureDefaultShopForBusiness(businessId);
    const shops = await Shop.find({ businessId, status: 'active' }).sort({ isMain: -1, createdAt: 1 }).lean();

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
    const initializationMode = String(req.body?.initializationMode || 'fresh');
    const sourceShopId = req.body?.sourceShopId ? String(req.body.sourceShopId) : null;
    if (!name) return res.status(400).json({ message: 'Shop name is required.' });
    if (!['fresh', 'copy_inventory', 'share_catalog'].includes(initializationMode)) {
      return res.status(400).json({ message: 'Invalid shop initialization mode.' });
    }

    const defaultShopId = await ensureDefaultShopForBusiness(businessId);
    const shop = await Shop.create({
      businessId,
      name,
      normalizedName: name.toLowerCase(),
      isMain: false,
      status: 'active',
      inventoryMode: 'explicit'
    });

    if (initializationMode === 'share_catalog') {
      const catalogProducts = await Product.find({ businessId, isDeleted: { $ne: true } }).select('id').lean();
      if (catalogProducts.length > 0) {
        const rows = catalogProducts.map((product) => ({
          updateOne: {
            filter: {
              businessId,
              shopId: String(shop._id),
              productId: String(product.id)
            },
            update: {
              $set: {
                businessId,
                shopId: String(shop._id),
                productId: String(product.id),
                onHand: 0,
                isListed: true
              }
            },
            upsert: true
          }
        }));
        await ProductShopStock.bulkWrite(rows);
      }
    }

    if (initializationMode === 'copy_inventory') {
      const safeSourceShopId = await resolveShopId({
        businessId,
        requestedShopId: sourceShopId || defaultShopId
      });

      const sourceStock = await ProductShopStock.find({ businessId, shopId: safeSourceShopId, isListed: { $ne: false } }).lean();
      if (sourceStock.length > 0) {
        const rows = sourceStock.map((row) => ({
          updateOne: {
            filter: {
              businessId,
              shopId: String(shop._id),
              productId: String(row.productId)
            },
            update: {
              $set: {
                businessId,
                shopId: String(shop._id),
                productId: String(row.productId),
                onHand: Number(row.onHand || 0),
                isListed: true
              }
            },
            upsert: true
          }
        }));
        await ProductShopStock.bulkWrite(rows);
      }
    }

    res.status(201).json({
      shop: {
        id: String(shop._id),
        name: shop.name,
        isMain: shop.isMain,
        status: shop.status,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt
      },
      initializationMode
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

router.delete('/:shopId', auth, requireActiveSubscription, async (req, res) => {
  try {
    if (req.userRole !== 'owner') {
      return res.status(403).json({ message: 'Only owner can delete shops.' });
    }

    const businessId = String(req.businessId);
    const targetShopId = String(req.params.shopId);
    const replacementShopId = req.body?.replacementShopId ? String(req.body.replacementShopId) : null;

    const shops = await Shop.find({ businessId, status: 'active' }).sort({ isMain: -1, createdAt: 1 }).lean();
    if (shops.length <= 1) {
      return res.status(400).json({ message: 'You must keep at least one active shop.' });
    }

    const target = shops.find((s) => String(s._id) === targetShopId);
    if (!target) return res.status(404).json({ message: 'Shop not found.' });

    const business = await Business.findById(businessId).select('defaultShopId').lean();
    const isDefault = String(business?.defaultShopId || '') === targetShopId;

    if ((target.isMain || isDefault) && !replacementShopId) {
      return res.status(400).json({ message: 'Select a replacement shop before deleting the main/default shop.' });
    }

    if (replacementShopId) {
      const replacement = shops.find((s) => String(s._id) === replacementShopId && String(s._id) !== targetShopId);
      if (!replacement) return res.status(400).json({ message: 'Replacement shop must be another active shop.' });

      await Shop.updateOne({ _id: replacementShopId, businessId }, { $set: { isMain: true } });
      await Business.updateOne({ _id: businessId }, { $set: { defaultShopId: replacementShopId } });
      await Shop.updateOne({ _id: targetShopId, businessId }, { $set: { isMain: false } });
    }

    await Shop.updateOne({ _id: targetShopId, businessId }, { $set: { status: 'inactive' } });

    await Promise.all([
      ProductShopStock.deleteMany({ businessId, shopId: targetShopId }),
      Transaction.deleteMany({ businessId, shopId: targetShopId }),
      Expenditure.deleteMany({ business: new mongoose.Types.ObjectId(req.businessId), shopId: targetShopId }),
      Notification.deleteMany({ businessId: new mongoose.Types.ObjectId(req.businessId), shopId: targetShopId })
    ]);

    return res.json({ success: true, shopId: targetShopId });
  } catch (err) {
    console.error('Delete shop error:', err);
    return res.status(500).json({ message: 'Could not delete shop' });
  }
});

router.get('/summary/overview', auth, async (req, res) => {
  try {
    const businessId = String(req.businessId);
    const shops = await Shop.find({ businessId, status: 'active' }).lean();
    const shopIds = shops.map((s) => String(s._id));
    const businessObjectId = mongoose.isValidObjectId(req.businessId) ? new mongoose.Types.ObjectId(req.businessId) : null;

    const [sales, expenses, stock, inventoryValue, lastSales, lastExpenses] = await Promise.all([
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
      ]),
      ProductShopStock.aggregate([
        { $match: { businessId, shopId: { $in: shopIds } } },
        {
          $lookup: {
            from: 'products',
            let: { pid: '$productId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$id', '$$pid'] },
                      { $or: [
                        { $eq: ['$businessId', businessId] },
                        ...(businessObjectId ? [{ $eq: ['$businessId', businessObjectId] }] : [])
                      ] }
                    ]
                  }
                }
              }
            ],
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$shopId',
            inventoryValue: {
              $sum: {
                $multiply: [
                  { $toDouble: '$onHand' },
                  { $toDouble: { $ifNull: ['$product.costPrice', 0] } }
                ]
              }
            }
          }
        }
      ]),
      Transaction.aggregate([
        { $match: { businessId: req.businessId, shopId: { $in: shopIds } } },
        { $group: { _id: '$shopId', lastActivity: { $max: '$transactionDate' } } }
      ]),
      Expenditure.aggregate([
        { $match: { business: new mongoose.Types.ObjectId(req.businessId), shopId: { $in: shopIds } } },
        { $group: { _id: '$shopId', lastExpenseAt: { $max: '$date' } } }
      ])
    ]);

    const salesMap = new Map(sales.map((x) => [x._id, Number(x.sales || 0)]));
    const expMap = new Map(expenses.map((x) => [x._id, Number(x.expenses || 0)]));
    const stockMap = new Map(stock.map((x) => [x._id, Number(x.itemCount || 0)]));
    const inventoryValueMap = new Map(inventoryValue.map((x) => [x._id, parseDecimal(x.inventoryValue)]));
    const lastSalesMap = new Map(lastSales.map((x) => [x._id, x.lastActivity]));
    const lastExpenseMap = new Map(lastExpenses.map((x) => [x._id, x.lastExpenseAt]));

    const rows = shops.map((s) => ({
      shopId: String(s._id),
      name: s.name,
      sales: salesMap.get(String(s._id)) || 0,
      expenses: expMap.get(String(s._id)) || 0,
      profit: (salesMap.get(String(s._id)) || 0) - (expMap.get(String(s._id)) || 0),
      inventoryUnits: stockMap.get(String(s._id)) || 0,
      inventoryValue: inventoryValueMap.get(String(s._id)) || 0,
      lastActivity: [lastSalesMap.get(String(s._id)), lastExpenseMap.get(String(s._id))].filter(Boolean).sort().slice(-1)[0] || null
    }));

    const totals = rows.reduce((acc, row) => ({
      sales: acc.sales + row.sales,
      expenses: acc.expenses + row.expenses,
      profit: acc.profit + row.profit,
      inventoryUnits: acc.inventoryUnits + row.inventoryUnits,
      inventoryValue: acc.inventoryValue + row.inventoryValue
    }), { sales: 0, expenses: 0, profit: 0, inventoryUnits: 0, inventoryValue: 0 });

    res.json({ rows, totals });
  } catch (err) {
    console.error('Shop overview error:', err);
    res.status(500).json({ message: 'Could not fetch shop overview' });
  }
});

module.exports = router;
