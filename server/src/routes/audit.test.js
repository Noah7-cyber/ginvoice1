const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index');
const Business = require('../models/Business');
const Product = require('../models/Product');
const StockVerificationEvent = require('../models/StockVerificationEvent');

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_secret';
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('POST /api/audit/verify', () => {
  let token;
  let business;

  beforeEach(async () => {
    await Business.deleteMany({});
    await Product.deleteMany({});
    await StockVerificationEvent.deleteMany({});

    business = await Business.create({
      name: 'Audit Biz',
      phone: '123',
      ownerPin: '1111',
      staffPin: '2222',
      isSubscribed: true,
      subscriptionExpiresAt: new Date(Date.now() + 86400000),
      trialEndsAt: new Date(Date.now() + 86400000),
      settings: {}
    });

    token = jwt.sign({ businessId: business._id, role: 'owner' }, process.env.JWT_SECRET);

    await Product.create({ businessId: String(business._id), id: 'p1', name: 'Milk', stock: 10, sellingPrice: 500 });
  });

  it('updates stock and logs verification event', async () => {
    const res = await request(app)
      .post('/api/audit/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 'p1', countedQty: 7, expectedQtyAtOpen: 10, reasonCode: 'CYCLE_COUNT' });

    expect(res.status).toBe(200);
    expect(res.body.variance).toBe(-3);

    const updated = await Product.findOne({ businessId: String(business._id), id: 'p1' });
    expect(updated.stock).toBe(7);
    expect(updated.lastVerifiedQty).toBe(7);
    expect(updated.lastAbsVar).toBe(3);

    const events = await StockVerificationEvent.find({ businessId: String(business._id), productId: 'p1' });
    expect(events.length).toBe(1);
    expect(events[0].variance).toBe(-3);
  });

  it('returns conflict when expected qty changed and confirm flag missing', async () => {
    await Product.updateOne({ businessId: String(business._id), id: 'p1' }, { $set: { stock: 12 } });

    const res = await request(app)
      .post('/api/audit/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 'p1', countedQty: 8, expectedQtyAtOpen: 10, reasonCode: 'CYCLE_COUNT' });

    expect(res.status).toBe(409);
  });
});
