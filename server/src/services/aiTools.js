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
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
            description: "Financial summary for a date range: net profit, revenue vs expenses, and cash flow. Use for broad performance summaries.",
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
            description: "Find customers with outstanding balances (balance > 0), typically credit sales.",
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
            name: "get_product_performance",
            description: "Get focused performance for ONE product (revenue, quantity sold, outstanding balance) over an optional date range.",
            parameters: {
                type: "object",
                properties: {
                    productName: { type: "string", description: "Product name to match (partial allowed)." },
                    productId: { type: "string", description: "Exact product id if known." },
                    startDate: { type: "string", description: "Optional start date (YYYY-MM-DD)." },
                    endDate: { type: "string", description: "Optional end date (YYYY-MM-DD)." }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_category_performance",
            description: "Get focused performance for ONE category (revenue, quantity sold, invoice count) over an optional date range.",
            parameters: {
                type: "object",
                properties: {
                    category: { type: "string", description: "Category name to analyze." },
                    startDate: { type: "string", description: "Optional start date (YYYY-MM-DD)." },
                    endDate: { type: "string", description: "Optional end date (YYYY-MM-DD)." }
                },
                required: ["category"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_inventory_intelligence",
            description: "Inventory analytics: top-selling products, dead stock candidates, and restock recommendations based on recent sales velocity.",
            parameters: {
                type: "object",
                properties: {
                    days: { type: "number", description: "Analysis window in days (default 30, max 120)." },
                    restockHorizonDays: { type: "number", description: "How many upcoming days to cover for restock recommendation (default 30, max 60)." },
                    topN: { type: "number", description: "How many products to return in each list (default 10, max 50)." }
                },
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

    // 5. Expenses & Cash Flow (Split by Type)
    const expenseAggregation = await Expenditure.aggregate([
        { $match: {
            business: businessObjectId,
            date: { $gte: start, $lte: end }
        }},
        { $group: {
            _id: {
                category: { $ifNull: ['$category', 'Uncategorized'] },
                flow: { $ifNull: ['$flowType', 'out'] },
                type: { $ifNull: ['$expenseType', 'business'] } // Distinction: business vs personal
            },
            total: { $sum: '$amount' }
        }}
    ]);

    let businessExpenses = 0;
    let personalExpenses = 0;
    let businessIncome = 0; // NEW: Track business grants/loans separately
    let personalIncome = 0;
    let totalCashInjections = 0;
    const categoryMap = {};

    expenseAggregation.forEach(item => {
        // FIX: Database stores expenses as negative. Force absolute value.
        const rawVal = item.total.toString ? parseFloat(item.total.toString()) : Number(item.total);
        const val = Math.abs(rawVal); // Keep the Math.abs() fix!

        const flow = item._id.flow;
        const type = item._id.type;
        const cat = item._id.category;

        if (flow === 'in') {
            totalCashInjections += val;
            if (type === 'business') {
                businessIncome += val; // Grant/Loan to business
            } else {
                personalIncome += val;
            }
        } else if (flow === 'out') {
            if (type === 'personal') {
                personalExpenses += val;
            } else {
                businessExpenses += val;
            }
            categoryMap[cat] = (categoryMap[cat] || 0) + val;
        }
    });

    // 6. Explicit Summaries
    // Metric 1: Business Performance = (Sales + Business Grants) - Business Costs
    const netBusinessProfit = (totalRevenue + businessIncome) - businessExpenses;

    // Metric 2: Wallet Reality = (Sales + All Money In) - (All Money Out)
    const netCashFlow = (totalRevenue + totalCashInjections) - (businessExpenses + personalExpenses);

    const expensesByCategory = Object.entries(categoryMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

    return {
        period: { start: startDate, end: endDate },
        revenue: {
            sales: totalRevenue,
            businessInjections: businessIncome, // Explicitly show this
            totalIn: totalCashInjections
        },
        expenses: {
            business: businessExpenses,
            personal: personalExpenses,
            totalOut: businessExpenses + personalExpenses,
            breakdown: expensesByCategory
        },
        financials: {
            netBusinessProfit, // <--- The number users care about for "How is my business doing?"
            netCashFlow,       // <--- The number users care about for "How much cash do I have?"
            note: "Profit = Sales - Business Costs. Cash Flow = (Sales + Money In) - All Money Out."
        },
        topSellingProducts: topSellingProducts
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

    if (count > 20) {
        return {
            special_action: "NAVIGATE",
            screen: "inventory",
            params: { search: query },
            message: `Found ${count} items matching "${query}". Opening list...`
        };
    } else if (count > 0) {
        const results = await Product.find(criteria).limit(20);

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


const resolveDateRange = (startDate, endDate) => {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date('1970-01-01T00:00:00.000Z');

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
    }

    end.setHours(23, 59, 59, 999);
    return { start, end };
};

const get_product_performance = async ({ productName, productId, startDate, endDate }, { businessId, userRole }) => {
    if (!businessId) return { error: 'Login required.' };

    const range = resolveDateRange(startDate, endDate);
    if (!range) return { error: 'Invalid date format. Use YYYY-MM-DD.' };

    const txMatch = {
        businessId,
        transactionDate: { $gte: range.start, $lte: range.end }
    };

    const productFilter = [];
    if (productId && String(productId).trim()) {
        productFilter.push({ 'items.productId': String(productId).trim() });
    }
    if (productName && String(productName).trim()) {
        productFilter.push({ 'items.productName': { $regex: String(productName).trim(), $options: 'i' } });
    }

    if (productFilter.length > 0) {
        txMatch.$or = productFilter;
    }

    const rows = await Transaction.aggregate([
        { $match: txMatch },
        { $unwind: '$items' },
        {
            $match: {
                ...(productId && String(productId).trim() ? { 'items.productId': String(productId).trim() } : {}),
                ...(productName && String(productName).trim() ? { 'items.productName': { $regex: String(productName).trim(), $options: 'i' } } : {})
            }
        },
        {
            $group: {
                _id: {
                    productId: '$items.productId',
                    productName: '$items.productName'
                },
                quantitySold: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.total' },
                invoiceCount: { $sum: 1 }
            }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
    ]);

    if (!rows.length) {
        return {
            period: { start: startDate || 'all-time', end: endDate || new Date().toISOString().split('T')[0] },
            message: 'No matching product sales found for that range.'
        };
    }

    const top = rows[0];
    const revenue = Number(top.revenue || 0);

    return {
        period: { start: startDate || 'all-time', end: endDate || new Date().toISOString().split('T')[0] },
        product: {
            id: top._id.productId || '',
            name: top._id.productName,
            quantitySold: Number(top.quantitySold || 0),
            invoiceCount: Number(top.invoiceCount || 0),
            ...(userRole === 'owner' ? { revenue } : {})
        },
        alternatives: sanitizeData(rows.slice(1).map(r => ({
            id: r._id.productId || '',
            name: r._id.productName,
            quantitySold: Number(r.quantitySold || 0),
            invoiceCount: Number(r.invoiceCount || 0),
            ...(userRole === 'owner' ? { revenue: Number(r.revenue || 0) } : {})
        }))),
        ...(userRole !== 'owner' ? { note: 'Revenue values are owner-only; showing quantities and invoice count.' } : {})
    };
};

const get_category_performance = async ({ category, startDate, endDate }, { businessId, userRole }) => {
    if (!businessId) return { error: 'Login required.' };
    if (!category || !String(category).trim()) return { error: 'Category is required.' };

    const range = resolveDateRange(startDate, endDate);
    if (!range) return { error: 'Invalid date format. Use YYYY-MM-DD.' };

    const categoryName = String(category).trim();

    const result = await Transaction.aggregate([
        {
            $match: {
                businessId,
                transactionDate: { $gte: range.start, $lte: range.end }
            }
        },
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                let: { pId: '$items.productId', bId: '$businessId' },
                pipeline: [
                    { $match: { $expr: { $and: [ { $eq: ['$id', '$$pId'] }, { $eq: ['$businessId', { $toString: '$$bId' }] } ] } } }
                ],
                as: 'productDetails'
            }
        },
        { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
        {
            $match: {
                'productDetails.category': { $regex: `^${escapeRegex(categoryName)}$`, $options: 'i' }
            }
        },
        {
            $group: {
                _id: '$productDetails.category',
                quantitySold: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.total' },
                invoiceCount: { $sum: 1 },
                uniqueProducts: { $addToSet: '$items.productId' }
            }
        }
    ]);

    if (!result.length) {
        return {
            period: { start: startDate || 'all-time', end: endDate || new Date().toISOString().split('T')[0] },
            category: categoryName,
            message: 'No sales found for that category in the selected range.'
        };
    }

    const row = result[0];
    return {
        period: { start: startDate || 'all-time', end: endDate || new Date().toISOString().split('T')[0] },
        category: row._id || categoryName,
        quantitySold: Number(row.quantitySold || 0),
        invoiceCount: Number(row.invoiceCount || 0),
        uniqueProducts: Array.isArray(row.uniqueProducts) ? row.uniqueProducts.length : 0,
        ...(userRole === 'owner' ? { revenue: Number(row.revenue || 0) } : {}),
        ...(userRole !== 'owner' ? { note: 'Revenue values are owner-only; showing operational metrics.' } : {})
    };
};

const get_inventory_intelligence = async ({ days = 30, restockHorizonDays = 30, topN = 10 } = {}, { businessId, userRole }) => {
    if (!businessId) return { error: 'Login required.' };

    const safeDays = Math.min(Math.max(Number(days) || 30, 7), 120);
    const safeHorizon = Math.min(Math.max(Number(restockHorizonDays) || 30, 7), 60);
    const safeTopN = Math.min(Math.max(Number(topN) || 10, 1), 50);

    const businessKey = businessId.toString();
    const periodStart = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const [products, recentTransactions] = await Promise.all([
        Product.find({ businessId: businessKey }).lean(),
        Transaction.find({ businessId: businessId, transactionDate: { $gte: periodStart } })
            .select('transactionDate items')
            .lean()
    ]);

    const soldMap = new Map();
    recentTransactions.forEach((tx) => {
        (tx.items || []).forEach((item) => {
            const productId = item?.productId;
            if (!productId) return;
            soldMap.set(productId, (soldMap.get(productId) || 0) + Number(item?.quantity || 0));
        });
    });

    const topSelling = products
        .map((product) => {
            const sold = Number(soldMap.get(product.id) || 0);
            return {
                id: product.id,
                name: product.name,
                category: product.category || 'Uncategorized',
                sold,
                currentStock: Number(product.stock || 0)
            };
        })
        .filter((item) => item.sold > 0)
        .sort((a, b) => b.sold - a.sold)
        .slice(0, safeTopN);

    const deadStockCandidates = products
        .map((product) => ({
            id: product.id,
            name: product.name,
            category: product.category || 'Uncategorized',
            currentStock: Number(product.stock || 0),
            soldInPeriod: Number(soldMap.get(product.id) || 0)
        }))
        .filter((item) => item.currentStock > 0 && item.soldInPeriod <= 0)
        .sort((a, b) => b.currentStock - a.currentStock)
        .slice(0, safeTopN);

    const restockRecommendations = products
        .map((product) => {
            const soldInPeriod = Number(soldMap.get(product.id) || 0);
            const avgDailySales = soldInPeriod / safeDays;
            const forecastNeed = Math.ceil(avgDailySales * safeHorizon);
            const currentStock = Number(product.stock || 0);
            const recommendedQty = Math.max(0, forecastNeed - currentStock);
            return {
                id: product.id,
                name: product.name,
                category: product.category || 'Uncategorized',
                soldInPeriod,
                avgDailySales: Number(avgDailySales.toFixed(2)),
                currentStock,
                recommendedQty,
                horizonDays: safeHorizon
            };
        })
        .filter((item) => item.recommendedQty > 0)
        .sort((a, b) => b.recommendedQty - a.recommendedQty)
        .slice(0, safeTopN);

    const output = {
        periodDays: safeDays,
        horizonDays: safeHorizon,
        inventorySize: products.length,
        topSelling,
        deadStockCandidates,
        restockRecommendations,
        message: `Inventory intelligence ready (${safeDays}d window).`
    };

    if (userRole !== 'owner') {
        return {
            ...output,
            note: 'Detailed financial totals stay owner-only; inventory insights are shared for operations.'
        };
    }

    return output;
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
            case 'get_product_performance':
                return await get_product_performance(args, context);
            case 'get_category_performance':
                return await get_category_performance(args, context);
            case 'search_sales_records':
                return await search_sales_records(args, context);
            case 'search_expenses':
                return await search_expenses(args, context);
            case 'get_inventory_intelligence':
                return await get_inventory_intelligence(args, context);
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
