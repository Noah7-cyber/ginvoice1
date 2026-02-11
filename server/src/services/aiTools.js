const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Expenditure = require('../models/Expenditure');

// --- Helper: Data Diet ---
const sanitizeData = (doc) => {
  if (Array.isArray(doc)) {
    return doc.map(d => sanitizeData(d));
  }
  if (typeof doc === 'object' && doc !== null) {
    // Handle Mongoose Document
    const data = doc.toObject ? doc.toObject() : doc;
    const { _id, __v, businessId, createdAt, updatedAt, image, password, items, ...rest } = data;

    // Recursively sanitize nested objects/arrays
    Object.keys(rest).forEach(key => {
      if (typeof rest[key] === 'object' && rest[key] !== null) {
        rest[key] = sanitizeData(rest[key]);
      }
    });

    // Handle Decimal128 conversion
    if (data.sellingPrice && data.sellingPrice.toString) rest.sellingPrice = parseFloat(data.sellingPrice.toString());
    if (data.costPrice && data.costPrice.toString) rest.costPrice = parseFloat(data.costPrice.toString());

    return rest;
  }
  return doc;
};

// --- Tool Definitions ---

const tools = [
  {
    type: "function",
    function: {
      name: "get_business_data",
      description: "Calculates specific business metrics (revenue, profit, expenses, inventory) for a given date range. Can also provide breakdowns by day, product, or category. Can also look up a specific product.",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            description: "The metric to calculate.",
            enum: ["revenue", "profit", "expenses", "inventory_count"]
          },
          startDate: { type: "string", description: "Start date (YYYY-MM-DD)." },
          endDate: { type: "string", description: "End date (YYYY-MM-DD)." },
          breakdownBy: {
            type: "string",
            description: "Optional breakdown for the data.",
            enum: ["day", "product", "category"]
          },
          productName: {
            type: "string",
            description: "Optional. The name of the product to search for. If provided, metric is ignored."
          }
        },
        required: ["metric"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "MapsApp",
      description: "Navigates the user to a specific screen within the application.",
      parameters: {
        type: "object",
        properties: {
          screenName: {
            type: "string",
            description: "The name of the screen to navigate to.",
            enum: ["Sales", "Inventory", "Settings", "Invoice", "Dashboard", "Expenditure", "History"]
          }
        },
        required: ["screenName"]
      }
    }
  },
  {
      type: "function",
      function: {
          name: "check_debtors",
          description: "Checks for customers who owe money (debtors).",
          parameters: { type: "object", properties: {}, required: [] }
      }
  },
  {
      type: "function",
      function: {
          name: "check_low_stock",
          description: "Checks for products with low stock (quantity <= 5).",
          parameters: { type: "object", properties: {}, required: [] }
      }
  },
  {
      type: "function",
      function: {
          name: "product_search",
          description: "Searches for a product by name to check stats or profit.",
          parameters: {
              type: "object",
              properties: {
                  searchQuery: { type: "string", description: "The product name to search for." }
              },
              required: ["searchQuery"]
          }
      }
  },
  {
      type: "function",
      function: {
          name: "get_recent_transaction",
          description: "Retrieves the single most recent transaction/sale.",
          parameters: { type: "object", properties: {}, required: [] }
      }
  }
];

// --- Tool Logic ---

const get_business_data = async ({ metric, startDate, endDate, breakdownBy, productName }, { businessId }) => {
  // CRITICAL SECURITY: Ensure businessId is present
  if (!businessId) {
    return { error: "Please log in to see this data." };
  }

  try {
      // --- 1. Product Lookup (Priority) ---
      if (productName) {
         const businessIdStr = businessId.toString();
         // Search for product
         const product = await Product.findOne({
             businessId: businessIdStr,
             name: { $regex: productName, $options: 'i' }
         });

         if (product) {
             return {
                 product: product.name,
                 stock: product.currentStock || product.stock || 0, // Handle schema variations
                 price: parseFloat((product.sellingPrice || 0).toString()),
                 currency: "NGN"
             };
         } else {
             return { error: `Product '${productName}' not found.` };
         }
      }

      // --- 2. Metric Calculation ---
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

  } catch (err) {
      console.error("Tool Execution Error (get_business_data):", err);
      return { error: "I cannot access that specific data right now. Please check your inputs." };
  }
};

const check_debtors = async ({}, { businessId }) => {
    if (!businessId) return { error: "Login required." };

    // Find transactions with outstanding balance
    const debtors = await Transaction.find({
        businessId,
        balance: { $gt: 0 }
    }).select('customerName balance totalAmount transactionDate id').sort({ transactionDate: -1 }).limit(10);

    const count = await Transaction.countDocuments({ businessId, balance: { $gt: 0 } });

    if (count > 5) {
        return {
            special_action: "NAVIGATE",
            screen: "history",
            filter: "unpaid",
            message: `You have ${count} debtors. Opening Debtor List...`
        };
    } else if (count > 0) {
        return {
            message: `Found ${count} debtors.`,
            debtors: sanitizeData(debtors)
        };
    } else {
        return { message: "No debtors found. Everyone has paid up!" };
    }
};

const check_low_stock = async ({}, { businessId }) => {
    if (!businessId) return { error: "Login required." };
    const businessIdStr = businessId.toString();

    const lowStockItems = await Product.find({
        businessId: businessIdStr,
        stock: { $lte: 5 }
    }).select('name stock sellingPrice').limit(10);

    const count = await Product.countDocuments({ businessId: businessIdStr, stock: { $lte: 5 } });

    if (count > 5) {
        return {
            special_action: "NAVIGATE",
            screen: "inventory",
            filter: "low_stock",
            message: `You have ${count} items running low. Opening Inventory...`
        };
    } else if (count > 0) {
        return {
            message: `Found ${count} low stock items.`,
            items: sanitizeData(lowStockItems)
        };
    } else {
        return { message: "Stock levels look good! No items below 5 units." };
    }
};

const product_search = async ({ searchQuery }, { businessId }) => {
    if (!businessId) return { error: "Login required." };
    const businessIdStr = businessId.toString();

    const products = await Product.find({
        businessId: businessIdStr,
        name: { $regex: searchQuery, $options: 'i' }
    });

    const count = products.length;

    if (count === 1) {
        const p = products[0];
        const cost = parseFloat(p.costPrice?.toString() || 0);
        const price = parseFloat(p.sellingPrice?.toString() || 0);
        const stock = p.stock || 0;
        const profit = price - cost;
        const margin = price > 0 ? ((profit / price) * 100).toFixed(1) + '%' : '0%';

        return {
            name: p.name,
            cost,
            price,
            stock,
            profit_per_unit: profit,
            margin
        };
    } else if (count > 5) {
        return {
            special_action: "NAVIGATE",
            screen: "inventory",
            search: searchQuery,
            message: `Found ${count} items matching "${searchQuery}". Opening Inventory...`
        };
    } else if (count > 0) {
        return {
            message: `Found ${count} items.`,
            items: sanitizeData(products.map(p => ({
                name: p.name,
                stock: p.stock,
                price: parseFloat(p.sellingPrice?.toString() || 0)
            })))
        };
    } else {
        return { message: `No products found matching "${searchQuery}".` };
    }
};

const get_recent_transaction = async ({}, { businessId }) => {
    if (!businessId) return { error: "Login required." };

    const transaction = await Transaction.findOne({ businessId })
        .sort({ transactionDate: -1 });

    if (transaction) {
        const date = new Date(transaction.transactionDate).toLocaleString();
        return {
            summary: `Last sale was to ${transaction.customerName || 'Walk-in Customer'} for NGN ${transaction.totalAmount} at ${date}.`,
            details: sanitizeData(transaction)
        };
    } else {
        return { message: "No recent transactions found." };
    }
};

// --- Executor ---

const executeTool = async (call, businessId) => {
  try {
      if (call.name === 'get_business_data') {
          return sanitizeData(await get_business_data(call.args, { businessId }));
      }

      if (call.name === 'check_debtors') {
          return await check_debtors(call.args, { businessId });
      }
      if (call.name === 'check_low_stock') {
          return await check_low_stock(call.args, { businessId });
      }
      if (call.name === 'product_search') {
          return await product_search(call.args, { businessId });
      }
      if (call.name === 'get_recent_transaction') {
          return await get_recent_transaction(call.args, { businessId });
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
              status: "success",
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
