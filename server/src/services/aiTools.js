const mongoose = require('mongoose');
const OpenAI = require('openai');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Expenditure = require('../models/Expenditure');

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
            description: "Generates a business report for a specific date range (revenue, profit, expenses, top items).",
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
            name: "query_transactions",
            description: "Query transactions with optional filters and return summary + sample rows (Excel-like).",
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
            name: "get_recent_transaction",
            description: "Find the single most recent transaction.",
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
    // Parse ISO strings
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Set end of day for the end date to capture full day's transactions
    end.setHours(23, 59, 59, 999);

    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    // 2. Aggregations (Common)
    const transactionMatch = {
        businessId: businessObjectId,
        transactionDate: { $gte: start, $lte: end }
    };

    // Top Product (Always accessible)
    const topProductResult = await Transaction.aggregate([
        { $match: transactionMatch },
        { $unwind: '$items' },
        { $group: { _id: '$items.productName', sold: { $sum: '$items.quantity' } } },
        { $sort: { sold: -1 } },
        { $limit: 1 }
    ]);
    const topSellingProduct = topProductResult[0] ? { name: topProductResult[0]._id, sold: topProductResult[0].sold } : null;

    // 3. RBAC Check (Revenue, Profit, Expenses)
    if (userRole !== 'owner') {
        return {
            period: { start: startDate, end: endDate },
            topSellingProduct,
            message: "Financial totals (Revenue, Profit, Expenses) are restricted to Owner accounts."
        };
    }

    // Owner-Only Calculations
    const revenueResult = await Transaction.aggregate([
        { $match: transactionMatch },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Expenses (Expenditures)
    // Using 'business' field as per previous assumption/fix in earlier step
    const expensesResult = await Expenditure.aggregate([
        { $match: {
            business: businessObjectId,
            date: { $gte: start, $lte: end },
            flowType: 'out'
        } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalExpenses = expensesResult[0]?.total || 0;

    const totalProfit = totalRevenue - totalExpenses;

    return {
        period: { start: startDate, end: endDate },
        totalRevenue,
        totalExpenses,
        totalProfit,
        topSellingProduct
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


const query_transactions = async ({ startDate, endDate, customerName, paymentStatus, limit = 20 }, { businessId, userRole }) => {
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
            case 'query_transactions':
                return await query_transactions(args, context);
            case 'get_recent_transaction':
                return await get_recent_transaction(args, context);
            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return { error: "Tool execution failed" };
    }
};

module.exports = { client, MODEL_NAME, tools, executeTool, sanitizeData };
