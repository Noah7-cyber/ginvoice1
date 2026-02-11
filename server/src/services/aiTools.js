const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Expenditure = require('../models/Expenditure');

// --- Helper: Data Diet (Sanitization) ---
const sanitizeData = (doc) => {
    if (Array.isArray(doc)) {
        return doc.map(d => sanitizeData(d));
    }
    if (doc && typeof doc === 'object') {
        const { _id, __v, businessId, business, createdAt, updatedAt, image, ...rest } = doc.toObject ? doc.toObject() : doc;
        // Also clean nested items if any
        if (rest.items) rest.items = sanitizeData(rest.items);
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
      description: "Finds customers who owe money (partial or pending payments).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "check_low_stock",
      description: "Finds products that are running low on stock (5 or fewer items).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "product_search",
      description: "Searches for products by name to check details like profit margin.",
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
      description: "Gets the most recent sale transaction details.",
      parameters: { type: "object", properties: {} }
    }
  }
];

// --- Tool Logic ---

const get_business_data = async ({ metric, startDate, endDate, breakdownBy, productName }, { businessId }) => {
  if (!businessId) return { error: "Please log in to see this data." };

  try {
      if (productName) {
         const businessIdStr = businessId.toString();
         const product = await Product.findOne({
             businessId: businessIdStr,
             name: { $regex: productName, $options: 'i' }
         });

         if (product) {
             return {
                 product: product.name,
                 stock: product.currentStock || product.stock || 0,
                 price: parseFloat((product.sellingPrice || 0).toString()),
                 currency: "NGN"
             };
         } else {
             return { error: `Product '${productName}' not found.` };
         }
      }

      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      if (endDate && endDate.length <= 10) end.setHours(23, 59, 59, 999);

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
           const data = await Transaction.aggregate([
              { $match: match },
              { $unwind: "$items" },
              { $group: {
                  _id: "$items.productName",
                  total: { $sum: { $multiply: ["$items.quantity", "$items.unitPrice"] } }
                }
              },
              { $sort: { total: -1 } },
              { $limit: 10 }
           ]);
           result = { top_products: data };
        } else {
          const data = await Transaction.aggregate([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          result = { revenue: data[0]?.total || 0 };
        }

      } else if (metric === 'profit') {
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
        const businessIdStr = businessId.toString();
        const match = { businessId: businessIdStr };
        const count = await Product.countDocuments(match);
        const data = await Product.aggregate([
            { $match: match },
            {
                $project: {
                    stockValue: { $multiply: ['$stock', '$sellingPrice'] }
                }
            },
            { $group: { _id: null, totalValue: { $sum: '$stockValue' } } }
        ]);
        const totalValue = data[0]?.totalValue || 0;
        result = { item_count: count, total_value: parseFloat(totalValue.toString()) };
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
    try {
        const debtors = await Transaction.find({
            businessId: new mongoose.Types.ObjectId(businessId),
            paymentStatus: { $in: ['credit', 'partial'] }
        }).limit(10); // Limit to check count

        if (debtors.length > 5) {
            return {
                special_action: "NAVIGATE",
                screen: "History",
                filter: "unpaid",
                message: `You have ${debtors.length} debtors. Opening History so you can manage them.`
            };
        }
        return sanitizeData(debtors);
    } catch (err) {
        return { error: "Could not fetch debtors." };
    }
};

const check_low_stock = async ({}, { businessId }) => {
    try {
        const products = await Product.find({
            businessId: businessId.toString(),
            $or: [
              { currentStock: { $lte: 5 } },
              { stock: { $lte: 5 } } // Support both schema fields
            ]
        }).limit(10);

        if (products.length > 5) {
            return {
                special_action: "NAVIGATE",
                screen: "Inventory",
                filter: "low_stock",
                message: `You have ${products.length} items running low. Opening Inventory...`
            };
        }
        return sanitizeData(products);
    } catch (err) {
        return { error: "Could not fetch stock." };
    }
};

const product_search = async ({ searchQuery }, { businessId }) => {
    try {
        const products = await Product.find({
            businessId: businessId.toString(),
            name: { $regex: searchQuery, $options: 'i' }
        }).limit(10);

        if (products.length > 5) {
            return {
                special_action: "NAVIGATE",
                screen: "Inventory",
                search: searchQuery,
                message: `Found ${products.length} items matching '${searchQuery}'. Opening Inventory...`
            };
        }

        if (products.length === 1) {
            const p = products[0];
            const selling = parseFloat((p.sellingPrice || 0).toString());
            const cost = parseFloat((p.costPrice || 0).toString());
            const stock = p.currentStock || p.stock || 0;
            return {
                name: p.name,
                sellingPrice: selling,
                costPrice: cost,
                stock: stock,
                profitMargin: selling - cost
            };
        }
        return sanitizeData(products);
    } catch (err) {
        return { error: "Search failed." };
    }
};

const get_recent_transaction = async ({}, { businessId }) => {
    try {
        const tx = await Transaction.findOne({
            businessId: new mongoose.Types.ObjectId(businessId)
        }).sort({ transactionDate: -1 });

        if (!tx) return { message: "No recent transactions found." };

        return {
            message: `Last sale was to ${tx.customerName || 'Walk-in Customer'} for ${tx.totalAmount} on ${new Date(tx.transactionDate).toLocaleString()}.`
        };
    } catch (err) {
        return { error: "Could not fetch transaction." };
    }
};

// --- Executor ---

const executeTool = async (call, businessId) => {
  try {
      if (call.name === 'get_business_data') {
          return await get_business_data(call.args, { businessId });
      }
      if (call.name === 'MapsApp') {
          const { screenName } = call.args;
          const routeMap = {
              'Sales': 'sales',
              'Inventory': 'inventory',
              'Settings': 'settings',
              'Invoice': 'history',
              'Dashboard': 'dashboard',
              'Expenditure': 'expenditure',
              'History': 'history'
          };
          const route = routeMap[screenName] || 'dashboard';
          return {
              type: "NAVIGATE",
              payload: route,
              status: "success",
              message: `Navigating to ${screenName}...`
          };
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

      return { error: `Unknown tool: ${call.name}` };
  } catch (error) {
      console.error(`Error executing tool ${call.name}:`, error);
      return { error: "Tool execution failed" };
  }
};

module.exports = { get_business_data, tools, executeTool };
