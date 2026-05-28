const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../index');
const Business = require('../models/Business');
const PaymentEvent = require('../models/PaymentEvent');

describe('POST /api/payments/webhook', () => {
  let mongoServer;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test_secret';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'whsec_test';
    process.env.PLAN_PRICE_KOBO = '200000';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Business.deleteMany({});
    await PaymentEvent.deleteMany({});
  });

  it('extends subscription for invoice.payment_succeeded using paystack customer fallback', async () => {
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const business = await Business.create({
      name: 'Renewal Biz',
      phone: '08012345678',
      ownerPin: '1111',
      staffPin: '2222',
      trialEndsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      isSubscribed: false,
      subscriptionExpiresAt: expiredDate,
      paystackCustomerCode: 'CUS_renew_123'
    });

    const payload = {
      event: 'invoice.payment_succeeded',
      data: {
        id: 'inv_evt_1',
        amount: 200000,
        customer: { customer_code: 'CUS_renew_123' },
        subscription: { subscription_code: 'SUB_new_code_123' }
      }
    };

    const body = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(Buffer.from(body))
      .digest('hex');

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-paystack-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const updated = await Business.findById(business._id).lean();
    expect(updated.isSubscribed).toBe(true);
    expect(new Date(updated.subscriptionExpiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(updated.paystackSubscriptionCode).toBe('SUB_new_code_123');

    const event = await PaymentEvent.findOne({ reference: 'inv_evt_1' }).lean();
    expect(event).toBeTruthy();
  });
});
