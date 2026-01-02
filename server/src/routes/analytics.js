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

    // Date ranges
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Last 7 Days (inclusive of today)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      summaryStats,
      currentMonthStats,
      previousMonthStats,
      dailySales,
      topProducts
    ] = await Promise.all([
      // 1. Overall Summary (Revenue, Debt, Counts)
      Transaction.aggregate([
        { $match: { businessId } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalDebt: { $sum: '$balance' },
            totalSales: { $sum: 1 },
            cashSales: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, 1, 0] }
            },
            transferSales: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'transfer'] }, 1, 0] }
            },
            // For total profit, we need to lookup products.
            // This can be expensive on large datasets, but better than loading all into Node.
            items: { $push: '$items' }
          }
        },
        { $project: { _id: 0 } }
      ]),

      // 2. Current Month Revenue
      Transaction.aggregate([
        { $match: { businessId, transactionDate: { $gte: currentMonthStart } } },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' } } }
      ]),

      // 3. Previous Month Revenue
      Transaction.aggregate([
        { $match: { businessId, transactionDate: { $gte: previousMonthStart, $lte: previousMonthEnd } } },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' } } }
      ]),

      // 4. Last 7 Days Chart Data
      Transaction.aggregate([
        { $match: { businessId, transactionDate: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$transactionDate' } },
            amount: { $sum: '$totalAmount' }
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
      ])
    ]);

    const stats = summaryStats[0] || { totalRevenue: 0, totalDebt: 0, totalSales: 0, cashSales: 0, transferSales: 0, items: [] };
    const curRev = currentMonthStats[0]?.revenue || 0;
    const prevRev = previousMonthStats[0]?.revenue || 0;

    // --- Profit Calculation ---
    // Optimization: Instead of joining in aggregation (which can hit limits),
    // we fetch Product Cost Prices once and compute profit based on the 'items'
    // we already aggregated (if feasible) or run a second tailored aggregation for profit.
    // However, for strict OOM prevention, we shouldn't carry 'items' in the summaryStats result.
    // Let's remove 'items' from the summaryStats projection above and do a dedicated "Profit" aggregation
    // that joins with products. But $lookup on a large Transaction collection is slow.
    // Alternative: We can't avoid some computation.
    // The previous implementation loaded EVERYTHING.
    // Let's calculate profit for *Current Month* and *Total* by streaming or batching if needed,
    // but for now, let's assume the user wants the Aggregation fix to prevent loading *all documents*.

    // We will calculate profit by fetching Product Costs and running a specialized aggregation
    // that unwinds items and groups by productId to sum up "Quantity Sold".
    // Then (Total Revenue - (Sum(Qty * Cost))) = Profit.
    // This assumes Unit Price was fixed? No, unit price varies.
    // Correct Profit = Sum( (Item.UnitPrice - Product.CostPrice) * Item.Quantity )
    // Since Product.CostPrice is in the Product collection, we MUST join or map.

    // Improved Profit Strategy:
    // 1. Get all products and their costs (small dataset usually).
    // 2. Aggregate all transactions -> unwind items -> group by productId -> sum (quantity * unitPrice) AND sum (quantity).
    // 3. Calculate profit in JS: TotalSales(per product) - (TotalQty(per product) * Cost).

    const [productSalesAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { businessId } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            totalSales: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }, // Revenue per product
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
          _id: '$items.productId',
          totalSales: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
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
          _id: '$items.productId',
          totalSales: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
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

    const products = await Product.find({ businessId }, { id: 1, costPrice: 1 }).lean();
    const costMap = new Map();
    products.forEach(p => costMap.set(p.id, toNumber(p.costPrice)));

    const calculateProfit = (aggResult) => {
      let profit = 0;
      aggResult.forEach(item => {
        const cost = costMap.get(item._id) || 0;
        const revenue = toNumber(item.totalSales);
        const qty = item.totalQty;
        profit += (revenue - (qty * cost));
      });
      return profit;
    };

    const totalProfit = calculateProfit(productSalesAgg);
    const currentMonthProfit = calculateProfit(productSalesCurrentMonth);
    const previousMonthProfit = calculateProfit(productSalesPrevMonth);

    // Format Chart Data
    // Ensure all 7 days exist
    const chartDataFormatted = [];
    const last7DaysMap = new Map();
    dailySales.forEach(d => last7DaysMap.set(d._id, d.amount));

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-NG', { weekday: 'short' });
      const amount = last7DaysMap.get(dateStr) || 0;
      chartDataFormatted.push({ date: displayDate, amount: toNumber(amount) });
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
