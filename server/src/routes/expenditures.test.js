const request = require('supertest');
const app = require('../index'); // Assuming app is exported from index.js for testing
const mongoose = require('mongoose');
const Expenditure = require('../models/Expenditure');
const jwt = require('jsonwebtoken');

describe('Expenditures API', () => {
  let token;
  const businessId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  // Connect to MongoDB before running tests
  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MongoDB URI not found. Please set MONGODB_URI or TEST_MONGODB_URI environment variable.");
    }
    await mongoose.connect(mongoUri);

    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'a-test-secret-that-is-long-enough';
    }
    token = jwt.sign({ userId, businessId, role: 'owner' }, process.env.JWT_SECRET);
  });

  // Clear the expenditures collection after each test
  afterEach(async () => {
    await Expenditure.deleteMany({});
  });

  // Disconnect from MongoDB after all tests are done
  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/expenditures', () => {
    it('should create a new expenditure and return it', async () => {
      const newExpenditure = {
        date: '2024-01-01T00:00:00.000Z',
        amount: 150.75,
        category: 'Office Supplies',
        note: 'Pens and notebooks',
      };

      const response = await request(app)
        .post('/api/expenditures')
        .set('Authorization', `Bearer ${token}`)
        .send(newExpenditure);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe(newExpenditure.amount);
      expect(response.body.category).toBe(newExpenditure.category);
      expect(response.body.note).toBe(newExpenditure.note);

      const savedExpenditure = await Expenditure.findById(response.body.id);
      expect(savedExpenditure).not.toBeNull();
      expect(savedExpenditure.amount).toBe(newExpenditure.amount);
      expect(savedExpenditure.businessId).toBe(businessId);
    });

    it('should return 400 for an invalid amount', async () => {
      const invalidExpenditure = {
        amount: 'not-a-number',
        category: 'Invalid',
      };

      const response = await request(app)
        .post('/api/expenditures')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidExpenditure);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Invalid amount');
    });
  });

  describe('GET /api/expenditures', () => {
    it('should return a list of expenditures for the business', async () => {
      await Expenditure.create({
        businessId,
        amount: 200,
        category: 'Utilities',
        createdBy: userId,
      });

       await Expenditure.create({
        businessId: new mongoose.Types.ObjectId().toString(),
        amount: 1000,
        category: 'Rent',
      });

      const response = await request(app)
        .get('/api/expenditures')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].amount).toBe(200);
      expect(response.body[0].category).toBe('Utilities');
    });
  });
});
