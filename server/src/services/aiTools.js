const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Expenditure = require('../models/Expenditure');

// --- Tool Definitions ---

const businessToolDef = {
  name: "get_business_data",
  description: "Calculates specific business metrics (revenue, profit, expenses, inventory) for a given date range. Can also provide breakdowns by day, product, or category.",
  parameters: {
    type: "OBJECT",
    properties: {
      metric: {
        type: "STRING",
        description: "The metric to calculate.",
        enum: ["revenue", "profit", "expenses", "inventory_count"]
      },
      startDate: { type: "STRING", description: "Start date (YYYY-MM-DD)." },
      endDate: { type: "STRING", description: "End date (YYYY-MM-DD)." },
      breakdownBy: {
        type: "STRING",
        description: "Optional breakdown for the data.",
        enum: ["day", "product", "category"]
      }
    },
    required: ["metric"]
  }
};

const mapsToolDef = {
  name: "MapsApp",
  description: "Navigates the user to a specific screen within the application.",
  parameters: {
    type: "OBJECT",
    properties: {
      screenName: {
        type: "STRING",
        description: "The name of the screen to navigate to.",
        enum: ["Sales", "Inventory", "Settings", "Invoice", "Dashboard", "Expenditure", "History"]
      }
    },
    required: ["screenName"]
  }
};

const tools = [
  { functionDeclarations: [businessToolDef, mapsToolDef] }
];

// --- Tool Logic ---

const get_business_data = async ({ metric, startDate, endDate, breakdownBy }, { businessId }) => {
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

  const businessObjectId = new mongoose.Types.ObjectId(businessId);
  let result = {};

  if (metric === 'revenue') {
    const match = {
      businessId: businessObjectId,
      transactionDate: { $gte: start, $lte: end }
    };

    if (breakdownBy === 'day') {
       const data = await Transaction.aggregate([
          { $match: match },
          { $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$transactionDate" } },
              total: { $sum: '$totalAmount' }
            }
          },
          { $sort: { _id: 1 } }
       ]);
       result = { revenue_by_day: data };
    } else if (breakdownBy === 'product') {
       // Unwind items to sum by product
       const data = await Transaction.aggregate([
          { $match: match },
          { $unwind: "$items" },
          { $group: {
              _id: "$items.productName",
              total: { $sum: { $multiply: ["$items.quantity", "$items.unitPrice"] } } // Approx revenue contribution
            }
          },
          { $sort: { total: -1 } },
          { $limit: 10 }
       ]);
       result = { top_products: data };
    } else {
      // Default Total
      const data = await Transaction.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);
      result = { revenue: data[0]?.total || 0 };
    }

  } else if (metric === 'profit') {
      // Profit breakdown is complex, sticking to totals for now
      const revenueMatch = {
        businessId: businessObjectId,
        transactionDate: { $gte: start, $lte: end }
      };
      const revenueData = await Transaction.aggregate([
          { $match: revenueMatch },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);
      const revenue = revenueData[0]?.total || 0;

      const expenseMatch = {
        business: businessObjectId,
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
      business: businessObjectId,
      date: { $gte: start, $lte: end },
      flowType: 'out'
    };

    if (breakdownBy === 'category') {
        const data = await Expenditure.aggregate([
           { $match: match },
           { $group: { _id: "$category", total: { $sum: '$amount' } } },
           { $sort: { total: -1 } }
        ]);
        result = { expenses_by_category: data };
    } else {
        const data = await Expenditure.aggregate([
          { $match: match },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        result = { expenses: parseFloat(data[0]?.total?.toString() || 0) };
    }

  } else if (metric === 'inventory_count') {
    // Product uses String businessId
    const businessIdStr = businessId.toString();
    const match = {
      businessId: businessIdStr
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

    // Fallback if aggregation fails or returns nothing
    const totalValue = data[0]?.totalValue || 0;

    result = {
        item_count: count,
        total_value: parseFloat(totalValue.toString())
    };
  } else {
      result = { message: "Supported metrics: revenue, profit, expenses, inventory_count" };
  }

  return result;
};

// --- Executor ---

const executeTool = async (call, businessId) => {
  try {
      if (call.name === 'get_business_data') {
          return await get_business_data(call.args, { businessId });
      }

      if (call.name === 'MapsApp') {
          const { screenName } = call.args;
          // Map friendly names to internal routes
          const routeMap = {
              'Sales': 'sales',
              'Inventory': 'inventory',
              'Settings': 'settings',
              'Invoice': 'history', // Assuming Invoice refers to History/Orders
              'Dashboard': 'dashboard',
              'Expenditure': 'expenditure',
              'History': 'history'
          };

          const route = routeMap[screenName] || 'dashboard';

          // Return the JSON command the model should output
          return {
              type: "NAVIGATE",
              payload: route,
              message: `Navigating to ${screenName}...`
          };
      }

      return { error: `Unknown tool: ${call.name}` };
  } catch (error) {
      console.error(`Error executing tool ${call.name}:`, error);
      return { error: "Tool execution failed" };
  }
};

module.exports = { get_business_data, tools, executeTool };
