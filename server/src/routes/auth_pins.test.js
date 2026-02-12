const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../index'); // Corrected path
const Business = require('../models/Business');

// Mock env variables for testing if they are not set
process.env.JWT_SECRET = 'test_secret';
process.env.SMTP_HOST = 'smtp.test.com'; // Fake
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'user';
process.env.SMTP_PASS = 'pass';
process.env.MAIL_FROM = 'noreply@ginvoice.com';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Auth Routes - PIN Updates', () => {
  let token;
  let businessId;

  beforeEach(async () => {
    // Register a business first
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Business',
      phone: '1234567890',
      ownerPassword: 'owner',
      staffPassword: 'staff',
      email: 'test@business.com'
    });

    // Check if registration failed
    if (res.status !== 200) {
       console.error('Registration failed:', res.body);
    }

    token = res.body.token;
    if (res.body.business) {
      businessId = res.body.business.id;
    }
  });

  afterEach(async () => {
    await Business.deleteMany({});
  });

  it('should update staff PIN successfully', async () => {
    const res = await request(app)
      .put('/api/auth/change-pins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentOwnerPin: 'owner',
        newStaffPin: 'newstaff'
      });

    if (res.status !== 200) console.error('Update failed', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('PINs updated successfully');
  });

  it('should require correct current owner PIN', async () => {
     const res = await request(app)
      .put('/api/auth/change-pins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentOwnerPin: 'wrongpin',
        newStaffPin: 'newstaff'
      });

    expect(res.status).toBe(401);
  });

  it('should enforce 30 day trial duration on registration', async () => {
      const business = await Business.findOne({ email: 'test@business.com' });
      expect(business).toBeTruthy();
      const createdAt = new Date(business.createdAt).getTime();
      const trialEnds = new Date(business.trialEndsAt).getTime();
      const diffDays = Math.round((trialEnds - createdAt) / (1000 * 60 * 60 * 24));
      // Allow slight variance (29-31) but aim for 30
      expect(diffDays).toBe(30);
  });
});
