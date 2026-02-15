const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { executeTool } = require('./aiTools'); // Ensure path is correct relative to this file
// Note: In the original file it was require('./aiTools'), but since this file is IN services, it's correct.
// However, in the read_file output it showed require('./aiTools') which is correct if both are in services.

const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Business = require('../models/Business');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
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
        // Note: New logic counts ALL 'out' flows as expenses, regardless of expenseType
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
        // Should be IGNORED in simple logic
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
        // Should be IGNORED in simple logic
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

        // Check new structure: totalRevenue, totalExpenses, totalProfit
        expect(result.totalRevenue).toBe(1000);

        // Expenses: 300 (Transport) + 100 (Personal) = 400
        // Grant and Gift are 'in' flow, so ignored.
        expect(result.totalExpenses).toBe(400);

        // Profit: 1000 - 400 = 600
        expect(result.totalProfit).toBe(600);

        // Verify Category Breakdown exists (flat structure)
        expect(result.expensesByCategory).toBeDefined();
        const transport = result.expensesByCategory.find(c => c.category === 'Transport');
        expect(transport).toBeDefined();
        expect(transport.amount).toBe(300);

        const personal = result.expensesByCategory.find(c => c.category === 'Personal');
        expect(personal).toBeDefined();
        expect(personal.amount).toBe(100);
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
        expect(result.totalRevenue).toBeUndefined();
        expect(result.totalExpenses).toBeUndefined();
        expect(result.totalProfit).toBeUndefined();
        expect(result.topSellingProducts).toBeDefined();
        expect(result.topSellingProducts.length).toBeGreaterThan(0);
        expect(result.topSellingProducts[0].name).toBe('Item B');
    });
});
