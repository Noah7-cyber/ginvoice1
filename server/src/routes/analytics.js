const express = require('express');

const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');

const router = express.Router();

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  if (typeof value.toString === 'function') return Number(value.toString()) || 0;
  return 0;
};

const formatTrendText = (current, previous) => {
  if (previous <= 0) return '0% from last month';
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded >= 0 ? '+' : '';
  return `${sign}${rounded}% from last month`;
};

router.get('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    const businessId = req.businessId;
    const [transactions, products] = await Promise.all([
      Transaction.find({ businessId }).lean(),
      Product.find({ businessId }).lean()
    ]);

    const productCostMap = new Map();
    products.forEach((p) => {
      productCostMap.set(p.id, toNumber(p.costPrice));
    });

    const totalRevenue = transactions.reduce((sum, tx) => sum + toNumber(tx.totalAmount), 0);
    const totalDebt = transactions.reduce((sum, tx) => sum + toNumber(tx.balance), 0);
    const totalProfit = transactions.reduce((sum, tx) => {
      const txProfit = (tx.items || []).reduce((pSum, item) => {
        const cost = productCostMap.get(item.productId) || 0;
        return pSum + (toNumber(item.unitPrice) - cost) * toNumber(item.quantity);
      }, 0);
      return sum + txProfit;
    }, 0);

    const cashSales = transactions.filter(t => t.paymentMethod === 'cash').length;
    const transferSales = transactions.filter(t => t.paymentMethod === 'transfer').length;

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const currentMonthTx = transactions.filter(t => t.transactionDate && new Date(t.transactionDate) >= currentMonthStart);
    const previousMonthTx = transactions.filter(t => t.transactionDate && new Date(t.transactionDate) >= previousMonthStart && new Date(t.transactionDate) <= previousMonthEnd);

    const currentMonthRevenue = currentMonthTx.reduce((sum, tx) => sum + toNumber(tx.totalAmount), 0);
    const previousMonthRevenue = previousMonthTx.reduce((sum, tx) => sum + toNumber(tx.totalAmount), 0);

    const currentMonthProfit = currentMonthTx.reduce((sum, tx) => {
      const txProfit = (tx.items || []).reduce((pSum, item) => {
        const cost = productCostMap.get(item.productId) || 0;
        return pSum + (toNumber(item.unitPrice) - cost) * toNumber(item.quantity);
      }, 0);
      return sum + txProfit;
    }, 0);
    const previousMonthProfit = previousMonthTx.reduce((sum, tx) => {
      const txProfit = (tx.items || []).reduce((pSum, item) => {
        const cost = productCostMap.get(item.productId) || 0;
        return pSum + (toNumber(item.unitPrice) - cost) * toNumber(item.quantity);
      }, 0);
      return sum + txProfit;
    }, 0);

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const chartData = last7Days.map(dateStr => {
      const daySales = transactions
        .filter(t => t.transactionDate && t.transactionDate.toISOString().split('T')[0] === dateStr)
        .reduce((sum, t) => sum + toNumber(t.totalAmount), 0);
      const displayDate = new Date(dateStr).toLocaleDateString('en-NG', { weekday: 'short' });
      return { date: displayDate, amount: daySales };
    });

    const productSales = {};
    transactions.forEach(tx => {
      (tx.items || []).forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, qty: 0 };
        }
        productSales[item.productId].qty += toNumber(item.quantity);
      });
    });
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return res.json({
      stats: {
        totalRevenue,
        totalProfit,
        totalDebt,
        totalSales: transactions.length,
        cashSales,
        transferSales,
        revenueTrendText: formatTrendText(currentMonthRevenue, previousMonthRevenue),
        profitTrendText: formatTrendText(currentMonthProfit, previousMonthProfit)
      },
      chartData,
      topProducts
    });
  } catch (err) {
    return res.status(500).json({ message: 'Analytics fetch failed' });
  }
});

module.exports = router;
