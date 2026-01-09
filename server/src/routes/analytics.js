const express = require('express');
const mongoose = require('mongoose');

const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');

const router = express.Router();

router.get('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    const businessId = new mongoose.Types.ObjectId(req.businessId);
    const range = req.query.range || '7d'; // '7d', '30d', '1y'

    const now = new Date();
    let startDate = new Date();
    let dateFormat = '%Y-%m-%d';

    if (range === '30d') {
        startDate.setDate(now.getDate() - 30);
    } else if (range === '1y') {
        startDate.setMonth(now.getMonth() - 11); // Last 12 months
        startDate.setDate(1);
        dateFormat = '%Y-%m'; // Group by month
    } else {
        startDate.setDate(now.getDate() - 6); // Default 7d
    }
    startDate.setHours(0,0,0,0);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Daily Revenue Start (Today 00:00)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      summaryStats,
      currentMonthStats,
      previousMonthStats,
      chartAgg,
      topProducts,
      inventoryValuation,
      dailyRevenueAgg
    ] = await Promise.all([
      // 1. Overall Summary (Revenue, Debt, Counts)
      Transaction.aggregate([
        { $match: { businessId } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $toDouble: '$totalAmount' } },
            totalDebt: { $sum: { $toDouble: '$balance' } },
            totalSales: { $sum: 1 },
            cashSales: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, 1, 0] }
            },
            transferSales: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'transfer'] }, 1, 0] }
            }
          }
        },
        { $project: { _id: 0 } }
      ]),

      // 2. Current Month Revenue
      Transaction.aggregate([
        { $match: { businessId, transactionDate: { $gte: currentMonthStart } } },
        { $group: { _id: null, revenue: { $sum: { $toDouble: '$totalAmount' } } } }
      ]),

      // 3. Previous Month Revenue
      Transaction.aggregate([
        { $match: { businessId, transactionDate: { $gte: previousMonthStart, $lte: previousMonthEnd } } },
        { $group: { _id: null, revenue: { $sum: { $toDouble: '$totalAmount' } } } }
      ]),

      // 4. Dynamic Chart Aggregation
      Transaction.aggregate([
        { $match: { businessId, transactionDate: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: '$transactionDate' } },
            amount: { $sum: { $toDouble: '$totalAmount' } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // 5. Top Products
      Transaction.aggregate([
        { $match: { businessId } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.productName' },
            qty: { $sum: '$items.quantity' }
          }
        },
        { $sort: { qty: -1 } },
        { $limit: 5 }
      ]),

      // 6. Inventory Valuation (Shop Cost & Shop Worth)
      Product.aggregate([
        { $match: { businessId } }, // Fixed: uses ObjectId `businessId` instead of `req.businessId` string
        {
          $group: {
            _id: null,
            shopCost: {
              $sum: {
                $multiply: [ '$stock', { $toDouble: '$costPrice' } ]
              }
            },
            shopWorth: {
              $sum: {
                $multiply: [ '$stock', { $toDouble: '$sellingPrice' } ]
              }
            }
          }
        }
      ]),

      // 7. Daily Revenue
      Transaction.aggregate([
        { $match: { businessId, transactionDate: { $gte: todayStart } } },
        { $group: { _id: null, dailyRevenue: { $sum: { $toDouble: '$totalAmount' } } } }
      ])
    ]);

    const stats = summaryStats[0] || { totalRevenue: 0, totalDebt: 0, totalSales: 0, cashSales: 0, transferSales: 0 };
    const curRev = currentMonthStats[0]?.revenue || 0;
    const prevRev = previousMonthStats[0]?.revenue || 0;

    // New Metrics
    const shopCost = inventoryValuation[0]?.shopCost || 0;
    const shopWorth = inventoryValuation[0]?.shopWorth || 0;
    const dailyRevenue = dailyRevenueAgg[0]?.dailyRevenue || 0;

    // --- Profit Calculation ---
    const [productSalesAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { businessId } },
        { $unwind: '$items' },
        {
          $group: {
            _id: { id: '$items.productId', unit: '$items.unit' },
            totalSales: { $sum: { $multiply: ['$items.quantity', { $toDouble: '$items.unitPrice' }] } }, // Revenue per product
            totalQty: { $sum: '$items.quantity' }
          }
        }
      ])
    ]);

    // Current Month Profit Aggregation
    const productSalesCurrentMonth = await Transaction.aggregate([
      { $match: { businessId, transactionDate: { $gte: currentMonthStart } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { id: '$items.productId', unit: '$items.unit' },
          totalSales: { $sum: { $multiply: ['$items.quantity', { $toDouble: '$items.unitPrice' }] } },
          totalQty: { $sum: '$items.quantity' }
        }
      }
    ]);

     // Previous Month Profit Aggregation
     const productSalesPrevMonth = await Transaction.aggregate([
      { $match: { businessId, transactionDate: { $gte: previousMonthStart, $lte: previousMonthEnd } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { id: '$items.productId', unit: '$items.unit' },
          totalSales: { $sum: { $multiply: ['$items.quantity', { $toDouble: '$items.unitPrice' }] } },
          totalQty: { $sum: '$items.quantity' }
        }
      }
    ]);

    // Fetch Product Costs
    const toNumber = (val) => {
      if (!val) return 0;
      if (val.toString) return parseFloat(val.toString());
      return Number(val);
    };

    const products = await Product.find({ businessId: req.businessId }, { id: 1, costPrice: 1, units: 1 }).lean();
    const productMap = new Map();
    products.forEach(p => productMap.set(p.id, p));

    const calculateProfit = (aggResult) => {
      let profit = 0;
      aggResult.forEach(group => {
        const product = productMap.get(group._id.id);
        if (!product) return; // Should not happen if data is consistent

        let itemCost = toNumber(product.costPrice);

        // Find specific unit cost if applicable
        if (group._id.unit && Array.isArray(product.units)) {
           const unitDef = product.units.find(u => u.name === group._id.unit);
           if (unitDef && unitDef.costPrice) {
             itemCost = toNumber(unitDef.costPrice);
           }
        }

        const revenue = toNumber(group.totalSales);
        const qty = group.totalQty;
        profit += (revenue - (qty * itemCost));
      });
      return profit;
    };

    const totalProfit = calculateProfit(productSalesAgg);
    const currentMonthProfit = calculateProfit(productSalesCurrentMonth);
    const previousMonthProfit = calculateProfit(productSalesPrevMonth);

    // Format Chart Data
    // We'll fill gaps based on range
    const chartDataFormatted = [];
    const chartMap = new Map();
    chartAgg.forEach(d => chartMap.set(d._id, d.amount));

    if (range === '1y') {
       for (let i = 11; i >= 0; i--) {
           const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
           const dateKey = d.toISOString().slice(0, 7); // YYYY-MM
           const displayDate = d.toLocaleDateString('en-NG', { month: 'short', year: '2-digit' });
           const amount = chartMap.get(dateKey) || 0;
           chartDataFormatted.push({ date: displayDate, amount: toNumber(amount) });
       }
    } else {
        const days = range === '30d' ? 29 : 6;
        for (let i = days; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const displayDate = d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' });
          const amount = chartMap.get(dateStr) || 0;
          chartDataFormatted.push({ date: displayDate, amount: toNumber(amount) });
        }
    }

    const formatTrendText = (current, previous) => {
      if (previous <= 0) return '0% from last month';
      const pct = ((current - previous) / previous) * 100;
      const rounded = Math.round(pct * 10) / 10;
      const sign = rounded >= 0 ? '+' : '';
      return `${sign}${rounded}% from last month`;
    };

    return res.json({
      stats: {
        totalRevenue: toNumber(stats.totalRevenue),
        totalProfit,
        totalDebt: toNumber(stats.totalDebt),
        totalSales: stats.totalSales,
        cashSales: stats.cashSales,
        transferSales: stats.transferSales,
        shopCost: toNumber(shopCost),
        shopWorth: toNumber(shopWorth),
        dailyRevenue: toNumber(dailyRevenue),
        revenueTrendText: formatTrendText(toNumber(curRev), toNumber(prevRev)),
        profitTrendText: formatTrendText(currentMonthProfit, previousMonthProfit)
      },
      chartData: chartDataFormatted,
      topProducts: topProducts.map(p => ({ name: p.name, qty: p.qty }))
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Analytics fetch failed' });
  }
});

module.exports = router;
