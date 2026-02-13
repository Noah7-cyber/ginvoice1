const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Business = require('../models/Business');
const Product = require('../models/Product');
const { computeRiskScore, generateVerificationQueue } = require('./stockVerification');

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
  await Business.deleteMany({});
  await Product.deleteMany({});
});

describe('stock verification scoring', () => {
  it('computeRiskScore returns bounded risk', () => {
    const score = computeRiskScore({ stock: 20, sellingPrice: 200, varianceCount: 1, lastAbsVar: 5 }, { unitsSold7d: 20, manualEdits30d: 2, normalizedValue: 1 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('queue generation respects thresholding', async () => {
    const biz = await Business.create({
      name: 'Q Biz',
      phone: '111',
      ownerPin: '1234',
      staffPin: '4321',
      trialEndsAt: new Date(Date.now() + 86400000),
      settings: { stockVerification: { enabled: true, riskThreshold: 90, maxQueuePerDay: 5 } }
    });

    await Product.create({ businessId: String(biz._id), id: 'p1', name: 'Slow Item', stock: 1, sellingPrice: 10, varianceCount: 0, lastAbsVar: 0, lastVerifiedAt: new Date() });

    const result = await generateVerificationQueue(String(biz._id));
    expect(result.queue.length).toBe(0);
  });
});
