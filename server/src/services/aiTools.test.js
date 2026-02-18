const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { executeTool } = require('./aiTools');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Business = require('../models/Business');
const Product = require('../models/Product');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Transaction.deleteMany({});
    await Expenditure.deleteMany({});
    await Business.deleteMany({});
    await Product.deleteMany({});
});

describe('get_business_report Logic Check', () => {
    it('calculates Business vs Personal Expenses and Cash Flow correctly', async () => {
        const businessId = new mongoose.Types.ObjectId();

        // 1. Create Revenue (Transaction) - 1000
        const productId = 'PRD-12345';
        await Transaction.create({
            businessId: businessId,
            id: 'txn-1',
            totalAmount: 1000,
            transactionDate: new Date(),
            items: [{ productId: productId, productName: 'Item A', quantity: 1, total: 1000 }]
        });

        // 2. Create Business Expense (Out) - Transport - 300
        await Expenditure.create({
            id: 'exp-biz',
            business: businessId,
            amount: 300,
            flowType: 'out',
            category: 'Transport',
            expenseType: 'business',
            date: new Date()
        });

        // 3. Create Personal Expense (Out) - Food - 100
        await Expenditure.create({
            id: 'exp-pers',
            business: businessId,
            amount: 100,
            flowType: 'out',
            category: 'Personal',
            expenseType: 'personal',
            date: new Date()
        });

        // 4. Create Business Injection (In) - Grant - 50
        await Expenditure.create({
            id: 'exp-biz-in',
            business: businessId,
            amount: 50,
            flowType: 'in',
            expenseType: 'business',
            category: 'Grant',
            date: new Date()
        });

        // 5. Create Personal Injection (In) - Gift - 20
        await Expenditure.create({
            id: 'exp-pers-in',
            business: businessId,
            amount: 20,
            flowType: 'in',
            expenseType: 'personal',
            category: 'Gift',
            date: new Date()
        });

        // Execute Tool
        const today = new Date().toISOString().slice(0, 10);
        const result = await executeTool({
            name: 'get_business_report',
            args: { startDate: today, endDate: today }
        }, businessId.toString(), 'owner');

        // Assertions
        console.log('Report Result:', result);

        // Check new structure: revenue.sales, expenses.business, etc.
        expect(result.revenue.sales).toBe(1000);
        expect(result.revenue.businessInjections).toBe(50);
        expect(result.revenue.totalIn).toBe(70); // 50 + 20

        // Expenses Breakdown
        expect(result.expenses.business).toBe(300);
        expect(result.expenses.personal).toBe(100);
        expect(result.expenses.totalOut).toBe(400); // 300 + 100

        // Financials
        // Business Profit = (Revenue + Business Injection) - Business Expense = (1000 + 50) - 300 = 750
        expect(result.financials.netBusinessProfit).toBe(750);

        // Net Cash Flow = (Revenue + All Injections) - (Total Expenses)
        // (1000 + 70) - 400 = 670
        expect(result.financials.netCashFlow).toBe(670);

        // Verify Category Breakdown exists
        expect(result.expenses.breakdown).toBeDefined();
        const transport = result.expenses.breakdown.find(c => c.category === 'Transport');
        expect(transport.amount).toBe(300);
    });

    it('returns restricted message for staff role', async () => {
        const businessId = new mongoose.Types.ObjectId();

        // Setup data to ensure top products logic runs with String ID
        const productId = 'PRD-STAFF-999';
        await Transaction.create({
            businessId: businessId,
            id: 'txn-staff',
            totalAmount: 500,
            transactionDate: new Date(),
            items: [{ productId: productId, productName: 'Item B', quantity: 2, total: 500 }]
        });

        const today = new Date().toISOString().slice(0, 10);
        const result = await executeTool({
            name: 'get_business_report',
            args: { startDate: today, endDate: today }
        }, businessId.toString(), 'staff');

        expect(result.message).toContain('restricted to Owner accounts');
        expect(result.revenue).toBeUndefined();
        expect(result.expenses).toBeUndefined();
        expect(result.financials).toBeUndefined();
        expect(result.topSellingProducts).toBeDefined();
        expect(result.topSellingProducts.length).toBeGreaterThan(0);
        expect(result.topSellingProducts[0].name).toBe('Item B');
    });
});

describe('product_search Logic Check', () => {
    it('returns items directly if count <= 20', async () => {
        const businessId = new mongoose.Types.ObjectId();
        // Create 20 products
        const products = [];
        for (let i = 0; i < 20; i++) {
            products.push({
                businessId: businessId.toString(),
                id: `prod-${i}`,
                name: `Test Product ${i}`,
                category: 'Test',
                costPrice: 100,
                sellingPrice: 150,
                currentStock: 10
            });
        }
        await Product.insertMany(products);

        const result = await executeTool({
            name: 'product_search',
            args: { query: 'Test Product' }
        }, businessId.toString(), 'owner');

        expect(result.special_action).toBeUndefined();
        expect(result.items).toHaveLength(20);
    });

    it('returns NAVIGATE if count > 20', async () => {
        const businessId = new mongoose.Types.ObjectId();
        // Create 21 products
        const products = [];
        for (let i = 0; i < 21; i++) {
             products.push({
                businessId: businessId.toString(),
                id: `prod-nav-${i}`,
                name: `Nav Product ${i}`,
                category: 'Test',
                costPrice: 100,
                sellingPrice: 150,
                currentStock: 10
            });
        }
        await Product.insertMany(products);

        const result = await executeTool({
            name: 'product_search',
            args: { query: 'Nav Product' }
        }, businessId.toString(), 'owner');

        expect(result.special_action).toBe('NAVIGATE');
        expect(result.items).toBeUndefined();
    });
});


describe('get_inventory_intelligence', () => {
    it('returns top sellers, dead stock and restock recommendations', async () => {
        const businessId = new mongoose.Types.ObjectId();

        await Product.insertMany([
            {
                businessId: businessId.toString(),
                id: 'prod-fast',
                name: 'Fast Item',
                category: 'Snacks',
                costPrice: 100,
                sellingPrice: 150,
                stock: 2
            },
            {
                businessId: businessId.toString(),
                id: 'prod-dead',
                name: 'Dead Item',
                category: 'Misc',
                costPrice: 50,
                sellingPrice: 80,
                stock: 20
            }
        ]);

        await Transaction.create({
            businessId,
            id: 'txn-intel-1',
            transactionDate: new Date(),
            totalAmount: 750,
            items: [
                { productId: 'prod-fast', productName: 'Fast Item', quantity: 5, total: 750 }
            ]
        });

        const result = await executeTool({
            name: 'get_inventory_intelligence',
            args: { days: 30, restockHorizonDays: 30, topN: 10 }
        }, businessId.toString(), 'owner');

        expect(result.topSelling.length).toBeGreaterThan(0);
        expect(result.topSelling[0].name).toBe('Fast Item');

        const dead = result.deadStockCandidates.find((item) => item.id === 'prod-dead');
        expect(dead).toBeDefined();

        const restock = result.restockRecommendations.find((item) => item.id === 'prod-fast');
        expect(restock).toBeDefined();
        expect(restock.recommendedQty).toBeGreaterThan(0);
    });
});
