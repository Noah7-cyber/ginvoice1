const request = require('supertest');
const app = require('../index'); // Assuming app is exported from index.js for testing
const mongoose = require('mongoose');
const Expenditure = require('../models/Expenditure');
const Business = require('../models/Business');
const jwt = require('jsonwebtoken');

describe('Expenditures API', () => {
  let token;
  const businessId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  // Connect to MongoDB before running tests
  let mongod;
  beforeAll(async () => {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    // Register the global plugin we added
    const decimal128ToNumberPlugin = require('../services/mongoosePlugin');
    mongoose.plugin(decimal128ToNumberPlugin);

    await mongoose.connect(uri);

    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'a-test-secret-that-is-long-enough';
    }

    // Create Business for Subscription Check
    await Business.create({
      _id: businessId,
      name: 'Test Business',
      isSubscribed: true,
      trialEndsAt: new Date(Date.now() + 86400000), // 1 day future
      phone: '08000000000',
      ownerPin: '1234',
      staffPin: '0000'
    });

    // Update token to include fields needed by auth middleware population
    token = jwt.sign({ userId, businessId, role: 'owner', id: userId }, process.env.JWT_SECRET);

    // Create a real shop to avoid CastError in resolveShopId
    await mongoose.model('Shop').create({
        _id: new mongoose.Types.ObjectId(),
        businessId: businessId.toString(),
        name: 'Test Shop',
        isMain: true
    });
  });

  // Clear the expenditures collection after each test
  afterEach(async () => {
    await Expenditure.deleteMany({});
  });

  // Disconnect from MongoDB after all tests are done
  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  describe('POST /api/expenditures', () => {
    it('should create a new expenditure and return it', async () => {
      const newExpenditure = {
        id: 'test-uuid-1',
        date: '2024-01-01T00:00:00.000Z',
        amount: 150.75,
        category: 'Office Supplies',
        description: 'Pens and notebooks', // Changed from note to description
        title: 'Office Supplies', // Added title
        paymentMethod: 'Cash' // Added paymentMethod
      };

      const response = await request(app)
        .post('/api/expenditures')
        .set('Authorization', `Bearer ${token}`)
        .send(newExpenditure);

      expect(response.statusCode).toBe(200); // Changed from 201
      expect(response.body).toHaveProperty('_id');
      expect(response.body.amount).toBe(newExpenditure.amount);
      expect(response.body.category).toBe(newExpenditure.category);
      expect(response.body.description).toBe(newExpenditure.description);

      const savedExpenditure = await Expenditure.findById(response.body._id);
      expect(savedExpenditure).not.toBeNull();
      // Handle Decimal128 comparison
      const amountVal = savedExpenditure.amount.toString();
      expect(parseFloat(amountVal)).toBe(newExpenditure.amount);
      expect(savedExpenditure.business.toString()).toBe(businessId); // Changed from businessId
    });

    it('should return 500 for an invalid amount', async () => {
      const invalidExpenditure = {
        id: 'test-uuid-2',
        amount: 'not-a-number',
        category: 'Invalid',
        title: 'Test',
        description: 'Test',
        paymentMethod: 'Cash'
      };

      const response = await request(app)
        .post('/api/expenditures')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidExpenditure);

      expect(response.statusCode).toBe(400);
    });

    it('should force negative amount for flowType: out', async () => {
        const payload = {
            id: 'exp-out',
            amount: 50, // Positive in payload
            flowType: 'out',
            category: 'Force Sign',
            title: 'Test Out'
        };

        const response = await request(app)
            .post('/api/expenditures')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);

        expect(response.statusCode).toBe(200);
        expect(response.body.amount).toBe(-50);
        expect(response.body.flowType).toBe('out');
    });

    it('should force positive amount for flowType: in', async () => {
        const payload = {
            id: 'exp-in',
            amount: -100, // Negative in payload
            flowType: 'in',
            category: 'Force Sign',
            title: 'Test In'
        };

        const response = await request(app)
            .post('/api/expenditures')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);

        expect(response.statusCode).toBe(200);
        expect(response.body.amount).toBe(100);
        expect(response.body.flowType).toBe('in');
    });
  });

  describe('GET /api/expenditures', () => {
    it('should return a list of expenditures for the business', async () => {
      // Find a shopId to use
      const shop = await mongoose.model('Shop').findOne({ businessId });
      const shopId = shop._id.toString();

      await Expenditure.create({
        id: 'test-uuid-3',
        business: businessId, // Changed from businessId
        shopId,
        amount: 200,
        category: 'Utilities',
        user: userId, // Changed from createdBy
        title: 'Util',
        description: 'Elec',
        paymentMethod: 'Cash'
      });

       await Expenditure.create({
        id: 'test-uuid-4',
        business: new mongoose.Types.ObjectId().toString(),
        amount: 1000,
        category: 'Rent',
        user: userId,
        title: 'Rent',
        description: 'Rent',
        paymentMethod: 'Transfer'
      });

      const response = await request(app)
        .get('/api/expenditures')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].amount).toBe(-200);
      expect(response.body[0].category).toBe('Utilities');
    });
  });
});
