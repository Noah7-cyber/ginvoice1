const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { archiveInactiveBusinesses } = require('./archiver');
const Business = require('../models/Business');
const Expenditure = require('../models/Expenditure');
const Transaction = require('../models/Transaction');
const MonthlySummary = require('../models/MonthlySummary');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});


describe('archiveInactiveBusinesses', () => {
    it('should archive data for inactive businesses and not for active ones', async () => {
        // 1. Setup
        const sixtyOneDaysAgo = new Date();
        sixtyOneDaysAgo.setDate(sixtyOneDaysAgo.getDate() - 61);

        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        const inactiveBusiness = await Business.create({
            name: 'Inactive Co',
            lastActiveAt: sixtyOneDaysAgo,
            phone: '123-456-7890',
            ownerPin: '1234',
            staffPin: '5678',
            trialEndsAt: new Date(),
        });

        const activeBusiness = await Business.create({
            name: 'Active Co',
            lastActiveAt: tenDaysAgo,
            phone: '098-765-4321',
            ownerPin: '4321',
            staffPin: '8765',
            trialEndsAt: new Date(),
        });

        // Data for inactive business (should be archived)
        // Note: New schema requires 'business' (ObjectId) but also keeps 'businessId' (String) in sync logic?
        // The archiver likely uses one or the other. Let's provide BOTH to cover bases for this test helper,
        // or check how archiver queries. Archiver likely queries by whatever the model was.
        // The new model requires 'business'.
        await Expenditure.create({ business: inactiveBusiness._id, businessId: inactiveBusiness._id, amount: 100, date: new Date('2023-01-15') });
        await Transaction.create({ businessId: inactiveBusiness._id, id: 'test-tx-1', totalAmount: 200, transactionDate: new Date('2023-01-20') });
        await Expenditure.create({ business: inactiveBusiness._id, businessId: inactiveBusiness._id, amount: 50, date: new Date('2023-02-10') });

        // Data for active business (should not be archived)
        await Expenditure.create({ business: activeBusiness._id, businessId: activeBusiness._id, amount: 1000, date: new Date('2023-01-15') });


        // 2. Execute
        await archiveInactiveBusinesses();

        // 3. Assert
        // Inactive business data should be gone
        // Archiver usually queries by businessId or business.
        // We'll check both queries to be sure it's gone.
        const inactiveExpenditures = await Expenditure.countDocuments({ business: inactiveBusiness._id });
        const inactiveTransactions = await Transaction.countDocuments({ businessId: inactiveBusiness._id });
        expect(inactiveExpenditures).toBe(0);
        expect(inactiveTransactions).toBe(0);

        // Active business data should remain
        const activeExpenditures = await Expenditure.countDocuments({ business: activeBusiness._id });
        expect(activeExpenditures).toBe(1);

        // Monthly summaries should be created for the inactive business
        const summaries = await MonthlySummary.find({ businessId: inactiveBusiness._id }).sort('month');
        expect(summaries.length).toBe(2);

        // Check January summary
        expect(summaries[0].year).toBe(2023);
        expect(summaries[0].month).toBe(1);
        expect(parseFloat(summaries[0].totalExpenditure.toString())).toBe(100);
        expect(parseFloat(summaries[0].totalRevenue.toString())).toBe(200);

        // Check February summary
        expect(summaries[1].year).toBe(2023);
        expect(summaries[1].month).toBe(2);
        expect(parseFloat(summaries[1].totalExpenditure.toString())).toBe(50);
        expect(parseFloat(summaries[1].totalRevenue.toString())).toBe(0);
    });

    it('should do nothing if there are no inactive businesses', async () => {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const business = await Business.create({
            name: 'Active Co',
            lastActiveAt: tenDaysAgo,
            phone: '111-222-3333',
            ownerPin: '0000',
            staffPin: '9999',
            trialEndsAt: new Date(),
        });
        await Expenditure.create({ business: business._id, businessId: business._id, amount: 100 });

        await archiveInactiveBusinesses();

        const expendituresCount = await Expenditure.countDocuments();
        const summariesCount = await MonthlySummary.countDocuments();
        expect(expendituresCount).toBe(1);
        expect(summariesCount).toBe(0);
    });
});
