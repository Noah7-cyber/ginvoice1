
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../index');
const Business = require('../models/Business');

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret'; // Mock JWT Secret
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

describe('Auth Verification Lifecycle', () => {

    test('should allow login if emailVerified is TRUE', async () => {
        const business = await Business.create({
            name: 'Test Biz',
            email: 'verified@test.com',
            phone: '1234567890',
            ownerPin: '$2b$10$abcdefg...', // Mock hash
            staffPin: '$2b$10$abcdefg...',
            trialEndsAt: new Date(),
            emailVerified: true
        });

        // We can't easily login with mock hash, so let's register a real one
        await request(app).post('/api/auth/register').send({
            name: 'Verified Biz',
            email: 'verified-real@test.com',
            phone: '123',
            address: 'Addr',
            ownerPassword: '1234',
            staffPassword: '5678'
        });

        // Manually verify
        await Business.updateOne({ email: 'verified-real@test.com' }, { emailVerified: true });

        const res = await request(app).post('/api/auth/login').send({
            email: 'verified-real@test.com',
            pin: '1234',
            role: 'owner'
        });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });

    test('should BLOCK login if emailVerified is FALSE', async () => {
        await request(app).post('/api/auth/register').send({
            name: 'Unverified Biz',
            email: 'unverified@test.com',
            phone: '123',
            address: 'Addr',
            ownerPassword: '1234',
            staffPassword: '5678'
        });

        // Ensure it is false
        const biz = await Business.findOne({ email: 'unverified@test.com' });
        expect(biz.emailVerified).toBe(false);

        const res = await request(app).post('/api/auth/login').send({
            email: 'unverified@test.com',
            pin: '1234',
            role: 'owner'
        });

        expect(res.status).toBe(403);
        expect(res.body.requiresVerification).toBe(true);
    });

    test('should allow resend verification email', async () => {
         await request(app).post('/api/auth/register').send({
            name: 'Resend Biz',
            email: 'resend@test.com',
            phone: '123',
            address: 'Addr',
            ownerPassword: '1234',
            staffPassword: '5678'
        });

        const res = await request(app).post('/api/auth/resend-verification').send({
            email: 'resend@test.com'
        });

        expect(res.status).toBe(200);

        const biz = await Business.findOne({ email: 'resend@test.com' });
        expect(biz.emailVerificationToken).toBeDefined();
    });

    test('should check verification status', async () => {
         await request(app).post('/api/auth/register').send({
            name: 'Status Biz',
            email: 'status@test.com',
            phone: '123',
            address: 'Addr',
            ownerPassword: '1234',
            staffPassword: '5678'
        });

        const res1 = await request(app).post('/api/auth/verification-status').send({
            email: 'status@test.com'
        });
        expect(res1.body.verified).toBe(false);

        await Business.updateOne({ email: 'status@test.com' }, { emailVerified: true });

        const res2 = await request(app).post('/api/auth/verification-status').send({
            email: 'status@test.com'
        });
        expect(res2.body.verified).toBe(true);
    });
});
