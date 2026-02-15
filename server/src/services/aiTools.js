const mongoose = require('mongoose');
const OpenAI = require('openai');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Expenditure = require('../models/Expenditure');
const { generateVerificationQueue } = require('./stockVerification');

const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    // Keep module load safe in test/offline envs; route guards prevent real calls when key is missing.
    apiKey: process.env.DEEPSEEK_API_KEY || 'disabled'
});

const MODEL_NAME = "deepseek-chat";

// --- Helper: Data Diet ---
const sanitizeData = (doc) => {
    if (Array.isArray(doc)) {
        return doc.map(d => sanitizeData(d));
    }
    if (typeof doc === 'object' && doc !== null) {
        // Handle Mongoose Document
        const data = doc.toObject ? doc.toObject() : doc;

        // Fields to remove explicitly to save tokens
        const {
            _id,
            __v,
            password,
            businessId,
            createdAt,
            updatedAt,
            __proto__,
            image, // Remove image data
            ...rest
        } = data;

        // Recursively sanitize nested objects/arrays
        Object.keys(rest).forEach(key => {
            if (typeof rest[key] === 'object' && rest[key] !== null) {
                // Check if it's a Decimal128 (often has .toString())
                if (rest[key].constructor && rest[key].constructor.name === 'Decimal128') {
                    rest[key] = parseFloat(rest[key].toString());
                } else {
                    rest[key] = sanitizeData(rest[key]);
                }
            }
        });

        // Explicitly handle common numeric fields that might be Decimal128 or Strings
        ['sellingPrice', 'costPrice', 'amount', 'totalAmount', 'balance', 'unitPrice', 'discount'].forEach(field => {
             if (rest[field] !== undefined && rest[field] !== null) {
                 // Convert to float if it has toString (Decimal128) or just parse it
                 const val = rest[field].toString ? rest[field].toString() : rest[field];
                 rest[field] = parseFloat(val);
             }
        });

        // Ensure stock/quantity is number
        if (rest.stock !== undefined) rest.stock = Number(rest.stock);
        if (rest.currentStock !== undefined) rest.currentStock = Number(rest.currentStock);
        if (rest.quantity !== undefined) rest.quantity = Number(rest.quantity);

        return rest;
    }
    return doc;
};

// --- Tool Definitions (OpenAI Format) ---
const tools = [
    {
        type: "function",
        function: {
            name: "get_business_report",
            description: "THE FINANCIAL AUTHORITY. Calculates Net Profit, Total Revenue vs Expenses, and Cash Flow. MUST use this for questions like 'how much did I make', 'daily performance', 'profit', or 'summary'.",
            parameters: {
                type: "object",
                properties: {
                    startDate: {
                        type: "string",
                        description: "The start date for the report (ISO format YYYY-MM-DD)."
                    },
                    endDate: {
                        type: "string",
                        description: "The end date for the report (ISO format YYYY-MM-DD)."
                    }
                },
                required: ["startDate", "endDate"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "check_debtors",
            description: "Find transactions where paymentStatus is 'partial' or 'pending'. Checks for customers who owe money.",
            parameters: {
                type: "object",
                properties: {},
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "check_low_stock",
            description: "Find products where stockQuantity <= 5.",
            parameters: {
                type: "object",
                properties: {},
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "product_search",
            description: "Regex search on product name.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The name of the product to search for."
                    }
                },
                required: ["query"],
                additionalProperties: false
            }
        }
    },

    {
        type: "function",
        function: {
            name: "search_sales_records",
            description: "Search for specific PAST SALES or RECEIPT records by customer name or ID. DO NOT use this for calculating profit or daily totals.",
            parameters: {
                type: "object",
                properties: {
                    startDate: { type: "string", description: "Optional ISO date YYYY-MM-DD" },
                    endDate: { type: "string", description: "Optional ISO date YYYY-MM-DD" },
                    customerName: { type: "string", description: "Optional customer name contains filter" },
                    paymentStatus: { type: "string", enum: ["paid", "credit"], description: "Optional payment status filter" },
                    limit: { type: "number", description: "Rows to return, max 50" }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_expenses",
            description: "Search for specific EXPENSE records by description or category. DO NOT use this for calculating totals.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search term for description or category" },
                    startDate: { type: "string", description: "Optional ISO date YYYY-MM-DD" },
                    endDate: { type: "string", description: "Optional ISO date YYYY-MM-DD" }
                },
                required: ["query"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_recent_transaction",
            description: "Find the single most recent transaction.",
            parameters: {
                type: "object",
                properties: {},
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_stock_verification_queue",
            description: "Get recommended micro-count items for stock verification today.",
            parameters: {
                type: "object",
                properties: {},
                additionalProperties: false
            }
        }
    }
];

// --- Tool Logic ---

const get_business_report = async ({ startDate, endDate }, { businessId, userRole }) => {
    if (!businessId) return { error: "Login required." };

    // 1. Determine Date Range
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const transactionMatch = {
        businessId: businessObjectId,
        transactionDate: { $gte: start, $lte: end }
    };

    // 2. Top Products
    const topProductResult = await Transaction.aggregate([
        { $match: transactionMatch },
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                let: { pId: '$items.productId' },
                pipeline: [ { $match: { $expr: { $eq: ['$id', '$$pId'] } } } ],
                as: 'productDetails'
            }
        },
        { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
        {
             $group: {
                 _id: '$items.productName',
                 sold: { $sum: '$items.quantity' },
                 category: { $first: '$productDetails.category' }
             }
        },
        { $sort: { sold: -1 } },
        { $limit: 3 }
    ]);
    const topSellingProducts = topProductResult.map(p => ({
        name: p._id,
        category: p.category || 'Uncategorized',
        sold: p.sold
    }));

    // 3. RBAC Check
    if (userRole !== 'owner') {
        return {
            period: { start: startDate, end: endDate },
            topSellingProducts,
            message: "Financial totals (Revenue, Profit, Expenses) are restricted to Owner accounts."
        };
    }

    // 4. Revenue (Transaction Sales)
    const revenueResult = await Transaction.aggregate([
        { $match: transactionMatch },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // 5. Expenses (Net Expense Calculation: Out - In)
    const expenseAggregation = await Expenditure.aggregate([
        { $match: {
            business: businessObjectId,
            date: { $gte: start, $lte: end }
        } },
        {
            $group: {
                _id: {
                    category: { $ifNull: ['$category', 'Uncategorized'] },
                    flow: { $ifNull: ['$flowType', 'out'] }
                },
                total: { $sum: '$amount' }
            }
        }
    ]);

    // Process in JS to handle Decimal128 and Logic
    let totalOut = 0;
    let totalIn = 0;
    const categoryMap = {}; // Map<CategoryName, number>

    expenseAggregation.forEach(item => {
        // Convert Decimal128 to number safely
        const val = item.total.toString ? parseFloat(item.total.toString()) : Number(item.total);
        const cat = item._id.category;
        const flow = item._id.flow;

        if (flow === 'out') {
            totalOut += val;
            categoryMap[cat] = (categoryMap[cat] || 0) + val;
        } else if (flow === 'in') {
            totalIn += val;
            // Subtract 'in' from category expense (Refund reduces expense)
            categoryMap[cat] = (categoryMap[cat] || 0) - val;
        }
    });

    const totalExpenses = totalOut - totalIn;
    const totalProfit = totalRevenue - totalExpenses;

    // Format expensesByCategory
    const expensesByCategory = Object.entries(categoryMap)
        .map(([category, amount]) => ({ category, amount }))
        // Filter out zero-amount categories if desired, or keep them. Keeping for now but sorting.
        .filter(item => Math.abs(item.amount) > 0.01)
        .sort((a, b) => b.amount - a.amount);

    return {
        period: { start: startDate, end: endDate },
        totalRevenue,
        totalExpenses,
        totalProfit,
        topSellingProducts,
        expensesByCategory
    };
};

const check_debtors = async ({}, { businessId }) => {
    if (!businessId) return { error: "Login required." };

    const criteria = {
        businessId,
        balance: { $gt: 0 }
    };

    const count = await Transaction.countDocuments(criteria);

    if (count > 5) {
        return {
            special_action: "NAVIGATE",
            screen: "history",
            params: { filter: "unpaid" },
            message: `Found ${count} debtors. Opening list...`
        };
    } else if (count > 0) {
        const results = await Transaction.find(criteria)
            .sort({ transactionDate: -1 })
            .limit(5);
        return {
            message: `Found ${count} debtors.`,
            debtors: sanitizeData(results)
        };
    } else {
        return { message: "No debtors found." };
    }
};

const check_low_stock = async ({}, { businessId }) => {
    if (!businessId) return { error: "Login required." };

    const criteria = {
        businessId,
        stock: { $lte: 5 }
    };

    const count = await Product.countDocuments(criteria);

    if (count > 5) {
        return {
            special_action: "NAVIGATE",
            screen: "inventory",
            params: { filter: "low_stock" },
            message: `You have ${count} items running low. Opening Inventory...`
        };
    } else if (count > 0) {
        const results = await Product.find(criteria).limit(5);
        return {
            message: `Found ${count} low stock items.`,
            items: sanitizeData(results)
        };
    } else {
        return { message: "Stock levels look good! No items below 5 units." };
    }
};

const product_search = async ({ query }, { businessId }) => {
    if (!businessId) return { error: "Login required." };

    const criteria = {
        businessId,
        name: { $regex: query, $options: 'i' }
    };

    const count = await Product.countDocuments(criteria);

    if (count > 5) {
        return {
            special_action: "NAVIGATE",
            screen: "inventory",
            params: { search: query },
            message: `Found ${count} items matching "${query}". Opening list...`
        };
    } else if (count > 0) {
        const results = await Product.find(criteria).limit(5);

        // Ensure sanitizeData handles the conversion, so the AI gets clean numbers
        const cleanItems = sanitizeData(results);

        return {
            message: `Found ${count} items.`,
            items: cleanItems
        };
    } else {
        return { message: `No products found matching "${query}".` };
    }
};

const search_expenses = async ({ query, startDate, endDate }, { businessId }) => {
    if (!businessId) return { error: "Login required." };

    const criteria = {
        business: businessId,
        $or: [
            { description: { $regex: query, $options: 'i' } },
            { title: { $regex: query, $options: 'i' } },
            { category: { $regex: query, $options: 'i' } }
        ]
    };

    if (startDate || endDate) {
        criteria.date = {};
        if (startDate) criteria.date.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            criteria.date.$lte = end;
        }
    }

    const results = await Expenditure.find(criteria)
        .sort({ date: -1 })
        .limit(20);

    if (results.length === 0) {
        return { message: `No expenses found matching "${query}".` };
    }

    return {
        message: `Found ${results.length} expenses.`,
        expenses: sanitizeData(results)
    };
};


const search_sales_records = async ({ startDate, endDate, customerName, paymentStatus, limit = 20 }, { businessId, userRole }) => {
    if (!businessId) return { error: "Login required." };

    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const criteria = { businessId };

    if (startDate || endDate) {
        criteria.transactionDate = {};
        if (startDate) criteria.transactionDate.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            criteria.transactionDate.$lte = end;
        }
    }

    if (customerName && customerName.trim()) {
        criteria.customerName = { $regex: customerName.trim(), $options: 'i' };
    }

    if (paymentStatus === 'paid' || paymentStatus === 'credit') {
        criteria.paymentStatus = paymentStatus;
    }

    const [rows, metrics] = await Promise.all([
        Transaction.find(criteria)
            .sort({ transactionDate: -1 })
            .limit(parsedLimit),
        Transaction.aggregate([
            { $match: criteria },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                    totalOutstanding: { $sum: '$balance' }
                }
            }
        ])
    ]);

    const summary = metrics[0] || { count: 0, totalRevenue: 0, totalOutstanding: 0 };
    const baseResult = {
        filters: { startDate, endDate, customerName: customerName || null, paymentStatus: paymentStatus || null },
        count: Number(summary.count || 0),
        totalRevenue: Number(summary.totalRevenue || 0),
        totalOutstanding: Number(summary.totalOutstanding || 0),
        rows: sanitizeData(rows)
    };

    if (userRole !== 'owner') {
        return {
            ...baseResult,
            totalRevenue: undefined,
            totalOutstanding: undefined,
            message: 'Financial totals are restricted to Owner accounts; showing transaction rows only.'
        };
    }

    return baseResult;
};

const get_recent_transaction = async ({}, { businessId }) => {
    if (!businessId) return { error: "Login required." };

    const result = await Transaction.findOne({ businessId })
        .sort({ transactionDate: -1 });

    if (!result) {
        return { message: "No recent transactions found." };
    }

    return sanitizeData(result);
};


const get_stock_verification_queue = async ({}, { businessId }) => {
    if (!businessId) return { error: "Login required." };
    const result = await generateVerificationQueue(businessId);
    return {
        message: result.queue.length ? `Recommended ${result.queue.length} item(s) to verify today.` : 'No verification needed right now.',
        items: result.queue
    };
};

// --- Executor ---
const executeTool = async ({ name, args }, businessId, userRole = 'staff') => {
    try {
        const context = { businessId, userRole };
        switch (name) {
            case 'get_business_report':
                return await get_business_report(args, context);
            case 'check_debtors':
                return await check_debtors(args, context);
            case 'check_low_stock':
                return await check_low_stock(args, context);
            case 'product_search':
                return await product_search(args, context);
            case 'search_sales_records':
                return await search_sales_records(args, context);
            case 'search_expenses':
                return await search_expenses(args, context);
            case 'get_recent_transaction':
                return await get_recent_transaction(args, context);
            case 'get_stock_verification_queue':
                return await get_stock_verification_queue(args, context);
            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return { error: "Tool execution failed" };
    }
};

module.exports = { client, MODEL_NAME, tools, executeTool, sanitizeData };
