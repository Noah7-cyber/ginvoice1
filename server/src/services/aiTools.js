const mongoose = require('mongoose');
const OpenAI = require('openai');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Expenditure = require('../models/Expenditure');

const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY
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
            ...rest
        } = data;

        // Recursively sanitize nested objects/arrays
        Object.keys(rest).forEach(key => {
            if (typeof rest[key] === 'object' && rest[key] !== null) {
                rest[key] = sanitizeData(rest[key]);
            }
        });

        return rest;
    }
    return doc;
};

// --- Tool Definitions (OpenAI Format) ---
const tools = [
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
        return {
            message: `Found ${count} items.`,
            items: sanitizeData(results)
        };
    } else {
        return { message: `No products found matching "${query}".` };
    }
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
const executeTool = async ({ name, args }, businessId) => {
    try {
        switch (name) {
            case 'check_debtors':
                return await check_debtors(args, { businessId });
            case 'check_low_stock':
                return await check_low_stock(args, { businessId });
            case 'product_search':
                return await product_search(args, { businessId });
            case 'get_recent_transaction':
                return await get_recent_transaction(args, { businessId });
            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return { error: "Tool execution failed" };
    }
};

module.exports = { client, MODEL_NAME, tools, executeTool, sanitizeData };
