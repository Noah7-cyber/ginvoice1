
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../index'); // Adjusted path
const Business = require('../models/Business'); // Adjusted path

// Mock Mail Service to avoid errors during registration
jest.mock('../services/mail', () => ({ // Adjusted path
  sendSystemEmail: jest.fn().mockResolvedValue({ sent: true })
}));

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
    await Business.deleteMany({});
});

describe('Subscription Enforcement', () => {

    const expiredBizData = {
        name: 'Expired Biz',
        email: 'expired@test.com',
        phone: '123',
        address: 'Addr',
        ownerPassword: '1234',
        staffPassword: '5678'
    };

    const validBizData = {
        name: 'Valid Biz',
        email: 'valid@test.com',
        phone: '123',
        address: 'Addr',
        ownerPassword: '1234',
        staffPassword: '5678'
    };

    async function createAndLogin(bizData, isExpired = false) {
        // Register
        await request(app).post('/api/auth/register').send(bizData);

        // Manually update business to match desired state
        const update = {
            emailVerified: true,
            trialEndsAt: isExpired ? new Date(Date.now() - 86400000) : new Date(Date.now() + 86400000), // +/- 1 day
            isSubscribed: false
        };
        await Business.updateOne({ email: bizData.email }, update);

        // Login
        const res = await request(app).post('/api/auth/login').send({
            email: bizData.email,
            pin: bizData.ownerPassword,
            role: 'owner'
        });

        return res.body.token;
    }

    test('GET /api/analytics should be accessible for EXPIRED users', async () => {
        const token = await createAndLogin(expiredBizData, true);

        const res = await request(app)
            .get('/api/analytics')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    test('POST /api/sync should be BLOCKED (402) for EXPIRED users', async () => {
        const token = await createAndLogin(expiredBizData, true);

        const res = await request(app)
            .post('/api/sync')
            .set('Authorization', `Bearer ${token}`)
            .send({ products: [{ name: 'Test' }] });

        expect(res.status).toBe(402);
        expect(res.body.message).toMatch(/Subscription required/);
    });

    test('POST /api/sync should be ALLOWED for VALID users', async () => {
        const token = await createAndLogin(validBizData, false);

        const res = await request(app)
            .post('/api/sync')
            .set('Authorization', `Bearer ${token}`)
            .send({ products: [{ name: 'Test' }] });

        expect(res.status).toBe(200);
    });

    test('GET /api/sync (Pull) should be ALLOWED for EXPIRED users', async () => {
        const token = await createAndLogin(expiredBizData, true);

        const res = await request(app)
            .get('/api/sync')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    test('DELETE /api/sync/transactions/:id should be BLOCKED (402) for EXPIRED users', async () => {
        const token = await createAndLogin(expiredBizData, true);

        const res = await request(app)
            .delete('/api/sync/transactions/some-id')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(402);
    });

    test('PUT /api/settings should be BLOCKED (402) for EXPIRED users', async () => {
        const token = await createAndLogin(expiredBizData, true);

        const res = await request(app)
            .put('/api/settings')
            .set('Authorization', `Bearer ${token}`)
            .send({ settings: { someSetting: true } });

        expect(res.status).toBe(402);
    });

});
