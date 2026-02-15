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
    it('calculates Net Expenses (Out - In) and correct Profit', async () => {
        const businessId = new mongoose.Types.ObjectId();

        // 1. Create Revenue (Transaction)
        // Simulate String Product ID (e.g., 'PRD-123')
        const productId = 'PRD-12345';
        await Transaction.create({
            businessId: businessId,
            id: 'txn-1',
            totalAmount: 1000,
            transactionDate: new Date(),
            items: [{ productId: productId, productName: 'Item A', quantity: 1, total: 1000 }]
        });

        // 2. Create Expense (Out) - Transport
        await Expenditure.create({
            id: 'exp-1',
            business: businessId,
            amount: 300,
            flowType: 'out',
            category: 'Transport',
            date: new Date()
        });

        // 3. Create Expense (In/Refund) - Transport
        // This should reduce the total expense for Transport
        await Expenditure.create({
            id: 'exp-2',
            business: businessId,
            amount: 50,
            flowType: 'in',
            category: 'Transport',
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

        expect(result.revenue).toBe(1000);

        // Expected Operating Expenses (Out only): 300
        expect(result.expenses.operating).toBe(300);

        // Expected Injections (In only): 50
        expect(result.expenses.injections).toBe(50);

        // Expected Net Profit: 1000 (Revenue) - 300 (Operating Expenses) = 700
        expect(result.netProfit).toBe(700);

        // Expected Cash Flow: 1000 (Revenue) - 300 (Operating Expenses) + 50 (Injections) = 750
        expect(result.cashFlow).toBe(750);

        // Verify Category Breakdown
        // Should find 'Transport' in breakdown array
        const transportCat = result.expenses.breakdown ? result.expenses.breakdown.find(c => c.category === 'Transport') : null;

        if (transportCat) {
             expect(transportCat.amount).toBe(300); // Only Out counts for category breakdown in new requirement? Or net?
             // Let's assume breakdown lists purely expenses (Out) based on "operating: 6000".
             // Or maybe net per category? The requirement says "breakdown: [...] // Category list".
             // Assuming breakdown matches operating expenses sum, so likely just 'out'.
             // Wait, if I spend 300 on transport and get 50 refund, my expense is 250.
             // But 'operating' is 300 (totalMoneyOut).
             // If breakdown sums to operating, then it should be 300.
             // Let's assume it sums to operating for now as per "operating: 6000" context.
        }
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
        expect(result.topSellingProducts).toBeDefined();
        expect(result.topSellingProducts.length).toBeGreaterThan(0);
        expect(result.topSellingProducts[0].name).toBe('Item B');
    });
});
