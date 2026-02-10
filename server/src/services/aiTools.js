const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Expenditure = require('../models/Expenditure');

const get_business_data = async ({ metric, startDate, endDate, groupBy }, { businessId }) => {
  // CRITICAL SECURITY: Ensure businessId is present
  if (!businessId) {
    throw new Error('Unauthorized access to business data');
  }

  const start = startDate ? new Date(startDate) : new Date(0); // Default to beginning of time
  const end = endDate ? new Date(endDate) : new Date(); // Default to now
  // Set end of day for end date if it's just a date string
  if (endDate && endDate.length <= 10) {
      end.setHours(23, 59, 59, 999);
  }

  let result = {};

  if (metric === 'revenue') {
    const match = {
      businessId: new mongoose.Types.ObjectId(businessId),
      transactionDate: { $gte: start, $lte: end }
    };

    const aggregation = [
      { $match: match },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ];
    const data = await Transaction.aggregate(aggregation);
    result = { revenue: data[0]?.total || 0 };

  } else if (metric === 'profit') {
      const revenueMatch = {
        businessId: new mongoose.Types.ObjectId(businessId),
        transactionDate: { $gte: start, $lte: end }
      };
      const revenueData = await Transaction.aggregate([
          { $match: revenueMatch },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);
      const revenue = revenueData[0]?.total || 0;

      const expenseMatch = {
        business: new mongoose.Types.ObjectId(businessId),
        date: { $gte: start, $lte: end },
        flowType: 'out'
      };
      const expenseData = await Expenditure.aggregate([
          { $match: expenseMatch },
          { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const expenses = parseFloat(expenseData[0]?.total?.toString() || 0);

      result = { profit: revenue - expenses, revenue, expenses };

  } else if (metric === 'expenses') {
    const match = {
      business: new mongoose.Types.ObjectId(businessId),
      date: { $gte: start, $lte: end },
      flowType: 'out'
    };
    const data = await Expenditure.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    result = { expenses: parseFloat(data[0]?.total?.toString() || 0) };

  } else if (metric === 'inventory_count') {
    // Product uses String businessId
    const match = {
      businessId: businessId.toString()
    };
    const count = await Product.countDocuments(match);

    // Also get total value
    const data = await Product.aggregate([
        { $match: match },
        {
            $project: {
                stockValue: { $multiply: ['$stock', '$sellingPrice'] }
            }
        },
        { $group: { _id: null, totalValue: { $sum: '$stockValue' } } }
    ]);

    result = {
        item_count: count,
        total_value: parseFloat(data[0]?.totalValue?.toString() || 0)
    };
  } else {
      result = { message: "Supported metrics: revenue, profit, expenses, inventory_count" };
  }

  return result;
};

module.exports = { get_business_data };
