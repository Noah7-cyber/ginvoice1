const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../index');
const Business = require('../models/Business');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_secret'; // Ensure auth middleware uses this
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  // Check if mongoose is already connected
  if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Ghost Note Deletion Logic', () => {
  let token;
  let businessId;
  let transactionId;

  beforeEach(async () => {
    // Clear DB
    await Business.deleteMany({});
    await Transaction.deleteMany({});
    await Notification.deleteMany({});

    // Create Business
    const business = await Business.create({
      name: 'Test Biz',
      email: 'test@biz.com',
      phone: '1234567890',
      ownerPin: '1234',
      staffPin: '5678',
      trialEndsAt: new Date(Date.now() + 86400000), // +1 day
      settings: {},
      staffPermissions: {}
    });
    businessId = business._id;
    token = jwt.sign({ businessId, role: 'owner' }, process.env.JWT_SECRET || 'test_secret');

    // Create Transaction
    const tx = await Transaction.create({
      businessId,
      id: 'tx-123',
      totalAmount: 5000,
      customerName: 'John Doe',
      transactionDate: new Date(),
      items: []
    });
    transactionId = tx.id;
  });

  it('should create a notification when deleting a transaction via /api/transactions/:id', async () => {
    // Delete Transaction
    const res = await request(app)
      .delete(`/api/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${token}`);

    if (res.status !== 200) console.log(res.body);
    expect(res.status).toBe(200);

    // Check Transaction is deleted
    const tx = await Transaction.findOne({ id: transactionId });
    expect(tx).toBeNull();

    // Check Notification is created
    const notifications = await Notification.find({ businessId });
    expect(notifications.length).toBe(1);
    expect(notifications[0].message).toContain('Sale to John Doe deleted');
    expect(notifications[0].amount).toBe(5000);
    expect(notifications[0].performedBy).toBe('Owner');
    expect(notifications[0].type).toBe('deletion');
  });

   it('should also work with sync route DELETE /api/sync/transactions/:id', async () => {
      const res = await request(app)
        .delete(`/api/sync/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`);

      if (res.status !== 200) console.log(res.body);
      expect(res.status).toBe(200);

      const tx = await Transaction.findOne({ id: transactionId });
      expect(tx).toBeNull();

      const notifications = await Notification.find({ businessId });
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toContain('Sale to John Doe deleted');
   });
});
