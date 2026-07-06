const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const MerchantWrapped = require('../models/MerchantWrapped');

async function calculateProductVelocities(businessId) {
  // We look at the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find all 'sale' transactions in the last 30 days
  const transactions = await Transaction.find({
    businessId,
    inventoryEffect: 'sale',
    transactionDate: { $gte: thirtyDaysAgo }
  });

  const productStats = {};
  
  transactions.forEach(tx => {
    tx.items.forEach(item => {
      if (!item.productId) return;
      if (!productStats[item.productId]) {
        productStats[item.productId] = { quantitySold: 0, txCount: 0 };
      }
      const qty = Number(item.quantity || 0) * Number(item.multiplier || 1);
      productStats[item.productId].quantitySold += qty;
      productStats[item.productId].txCount += 1;
    });
  });

  const productOps = [];
  for (const [productId, stats] of Object.entries(productStats)) {
    // If enough transactions exist (e.g. > 15), calculate dynamic velocity
    if (stats.txCount > 15) {
      const dailyVelocity = stats.quantitySold / 30;
      const safetyStock = Math.ceil(dailyVelocity * 3); // 3 days lead time
      
      productOps.push({
        updateOne: {
          filter: { businessId, id: productId },
          update: { $set: { dailyVelocity, safetyStock } }
        }
      });
    }
  }

  if (productOps.length > 0) {
    await Product.bulkWrite(productOps, { ordered: false });
  }
}

async function generateWrappedStory(businessId, year, month) {
  // Month is 1-12
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const transactions = await Transaction.find({
    businessId,
    transactionDate: { $gte: startDate, $lt: endDate }
  });

  let totalSalesVolume = 0;
  let totalDiscount = 0;
  let totalDebtRecovered = 0;
  
  const productRevenue = {};
  const dayCounts = {};
  const customerCounts = {};
  const paymentMethods = {};
  
  let totalSaleTxs = 0;

  transactions.forEach(tx => {
    if (tx.inventoryEffect === 'sale') {
      totalSalesVolume += Number(tx.totalAmount || 0);
      totalDiscount += Number(tx.globalDiscount || 0);
      totalSaleTxs += 1;

      // Product Revenue
      tx.items.forEach(item => {
        if (!item.productId) return;
        if (!productRevenue[item.productName]) productRevenue[item.productName] = 0;
        productRevenue[item.productName] += Number(item.total ? item.total.toString() : 0);
      });

      // Busiest Day
      const dateKey = tx.transactionDate ? tx.transactionDate.toISOString().split('T')[0] : 'Unknown';
      if (!dayCounts[dateKey]) dayCounts[dateKey] = 0;
      dayCounts[dateKey] += 1;

      // Customer Loyalty
      if (tx.customerPhone) {
        if (!customerCounts[tx.customerPhone]) customerCounts[tx.customerPhone] = 0;
        customerCounts[tx.customerPhone] += 1;
      }

      // Payment Preferences
      if (!paymentMethods[tx.paymentMethod]) paymentMethods[tx.paymentMethod] = 0;
      paymentMethods[tx.paymentMethod] += 1;
    } else if (tx.isPreviousDebt && tx.paymentStatus === 'paid') {
      totalDebtRecovered += Number(tx.amountPaid || tx.totalAmount || 0);
    }
  });

  // Top Product
  let topProduct = 'None';
  let topProductRevenue = 0;
  for (const [name, rev] of Object.entries(productRevenue)) {
    if (rev > topProductRevenue) {
      topProduct = name;
      topProductRevenue = rev;
    }
  }

  // Busiest Day
  let busiestDay = 'None';
  let busiestDayCount = 0;
  for (const [date, count] of Object.entries(dayCounts)) {
    if (count > busiestDayCount) {
      busiestDay = date;
      busiestDayCount = count;
    }
  }

  // Repeat Customers
  let repeatCustomers = 0;
  for (const count of Object.values(customerCounts)) {
    if (count > 1) repeatCustomers += 1;
  }

  // Top Payment Method
  let topPaymentMethod = 'cash';
  let topPaymentCount = 0;
  for (const [method, count] of Object.entries(paymentMethods)) {
    if (count > topPaymentCount) {
      topPaymentMethod = method;
      topPaymentCount = count;
    }
  }

  // Average Ticket Size
  const avgTicket = totalSaleTxs > 0 ? (totalSalesVolume / totalSaleTxs) : 0;

  // Empty Shelves (Top 3 low stock)
  const lowStockProducts = await Product.find({ businessId, isDeleted: false })
    .sort({ stock: 1 })
    .limit(3);
  
  const lowStockNames = lowStockProducts.length > 0 ? lowStockProducts.map(p => p.name).join(', ') : 'None';

  // Persona Logic
  let persona = 'The Hustler';
  if (totalDebtRecovered > 100000) persona = 'The Debt Collector';
  else if (topPaymentMethod === 'cash' && paymentMethods['cash'] > (totalSaleTxs * 0.7)) persona = 'The Cash King';
  else if (totalDiscount > 50000) persona = 'The Generous Boss';

  const cards = [
    { type: 'volume', title: 'The Month in Money', metric: `₦${totalSalesVolume.toLocaleString()}`, copy: `You moved ₦${totalSalesVolume.toLocaleString()} this month. Your hustle is paying off!` },
    { type: 'top_product', title: 'The Breadwinner', metric: topProduct, copy: `${topProduct} was the MVP, bringing in the most revenue.` },
    { type: 'busy_day', title: 'The Rush Hour', metric: busiestDay, copy: `You were on fire on ${busiestDay}! That was your busiest day with ${busiestDayCount} sales.` },
    { type: 'loyalty', title: 'Familiar Faces', metric: `${repeatCustomers}`, copy: `Your customers love you. ${repeatCustomers} of your buyers came back for more.` },
    { type: 'debt', title: 'The Debt Collector', metric: `₦${totalDebtRecovered.toLocaleString()}`, copy: `No loose ends! You successfully recovered ₦${totalDebtRecovered.toLocaleString()} in previous debts.` },
    { type: 'payment', title: 'How Money Moves', metric: topPaymentMethod.toUpperCase(), copy: `Most of your payments were via ${topPaymentMethod}. Cash is king, but you take it all!` },
    { type: 'discount', title: 'The Good Boss', metric: `₦${totalDiscount.toLocaleString()}`, copy: `You gave away ₦${totalDiscount.toLocaleString()} in discounts. A little generosity keeps them coming back.` },
    { type: 'ticket', title: 'The Typical Basket', metric: `₦${Math.round(avgTicket).toLocaleString()}`, copy: `On average, a customer spent ₦${Math.round(avgTicket).toLocaleString()} per visit this month.` },
    { type: 'restock', title: 'Empty Shelves', metric: lowStockNames, copy: `You sold out of these fast! Don't forget to restock ${lowStockNames}.` },
    { type: 'persona', title: 'Your Persona', metric: persona, copy: `This month, you were ${persona}. Share your hustle!` }
  ];

  const wrapped = await MerchantWrapped.findOneAndUpdate(
    { businessId, year, month },
    { cards, persona, generatedAt: new Date() },
    { upsert: true, new: true }
  );

  return wrapped;
}

module.exports = {
  calculateProductVelocities,
  generateWrappedStory
};
