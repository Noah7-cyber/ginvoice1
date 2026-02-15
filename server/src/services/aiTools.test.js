const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { executeTool } = require('./aiTools');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Business = require('../models/Business');

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

        // 4. Create Cash Injection (In) - Grant - 50
        await Expenditure.create({
            id: 'exp-inj',
            business: businessId,
            amount: 50,
            flowType: 'in',
            category: 'Grant',
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
        expect(result.revenue.injections).toBe(50);

        // Expenses Breakdown
        expect(result.expenses.business).toBe(300);
        expect(result.expenses.personal).toBe(100);
        expect(result.expenses.totalOut).toBe(400); // 300 + 100

        // Financials
        // Business Profit = Revenue - Business Expense = 1000 - 300 = 700
        expect(result.financials.netBusinessProfit).toBe(700);

        // Net Cash Flow = (Revenue + Injections) - (Total Expenses)
        // (1000 + 50) - 400 = 650
        expect(result.financials.netCashFlow).toBe(650);

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
