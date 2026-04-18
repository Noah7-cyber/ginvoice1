const request = require('supertest');
const app = require('../index');
const mongoose = require('mongoose');
const Business = require('../models/Business');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Shop = require('../models/Shop');
const ProductShopStock = require('../models/ProductShopStock');
const jwt = require('jsonwebtoken');

describe('Sync API Edge Cases', () => {
  let token;
  const businessId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  let shopId;

  let mongod;
  beforeAll(async () => {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'a-test-secret-that-is-long-enough';
    }

    await Business.create({
      _id: businessId,
      name: 'Test Business',
      isSubscribed: true,
      trialEndsAt: new Date(Date.now() + 86400000),
      phone: '08000000000',
      ownerPin: '1234',
      staffPin: '0000'
    });

    const shop = await Shop.create({
        businessId: businessId.toString(),
        name: 'Main Shop',
        isMain: true
    });
    shopId = shop._id.toString();

    token = jwt.sign({ userId: userId.toString(), businessId: businessId.toString(), role: 'owner' }, process.env.JWT_SECRET);
  });

  afterEach(async () => {
    await Product.deleteMany({});
    await Transaction.deleteMany({});
    await Expenditure.deleteMany({});
    await ProductShopStock.deleteMany({});
    // Delete all shops EXCEPT the main one to avoid unique index collisions in tests
    await Shop.deleteMany({ isMain: false });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  describe('POST /api/sync (Push Updates)', () => {
    it('should be idempotent (duplicate push should not create duplicates)', async () => {
      const payload = {
        products: [{
          id: 'p-sync-1',
          name: 'Sync Prod',
          sellingPrice: 10,
          updatedAt: new Date().toISOString()
        }],
        transactions: [{
          id: 'tx-sync-1',
          transactionDate: new Date().toISOString(),
          customerName: 'Sync Cust',
          items: [],
          totalAmount: 100,
          amountPaid: 100,
          updatedAt: new Date().toISOString()
        }]
      };

      // Push 1
      await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send(payload);
      // Push 2
      await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send(payload);

      const products = await Product.find({ businessId: businessId.toString() });
      const transactions = await Transaction.find({ businessId });

      expect(products.length).toBe(1);
      expect(transactions.length).toBe(1);
    });

    it('should ignore stale updates (older updatedAt)', async () => {
        const newerDate = new Date();
        const olderDate = new Date(newerDate.getTime() - 10000);

        // Initial Push (Newer)
        await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send({
            products: [{
                id: 'p-stale',
                name: 'New Name',
                updatedAt: newerDate.toISOString()
            }]
        });

        // Stale Push (Older)
        const response = await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send({
            products: [{
                id: 'p-stale',
                name: 'Old Name',
                updatedAt: olderDate.toISOString()
            }]
        });

        expect(response.statusCode).toBe(200);
        const p = await Product.findOne({ id: 'p-stale' });
        expect(p.name).toBe('New Name');
    });

    it('should handle shop scoping for staff', async () => {
        const shop2 = await Shop.create({ businessId: businessId.toString(), name: 'Shop 2' });
        const shop2Id = shop2._id.toString();

        const staffToken = jwt.sign({
            userId: 'staff-1',
            businessId: businessId.toString(),
            role: 'staff',
            assignedShopId: shopId
        }, process.env.JWT_SECRET);

        // Try to sync to shop2Id while assigned to shopId
        const response = await request(app)
            .post('/api/sync')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({
                shopId: shop2Id,
                products: [{ id: 'p-staff', name: 'Staff Prod' }]
            });

        expect(response.statusCode).toBe(403);
        expect(response.body.message).toMatch(/locked to an assigned shop/i);
    });

    it('should ignore product stock fields during sync payload', async () => {
        const productId = 'p-abs-stock';
        await Product.create({ businessId: businessId.toString(), id: productId, name: 'Abs Stock' });
        await ProductShopStock.create({ businessId: businessId.toString(), shopId, productId, onHand: 7 });

        await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send({
            products: [{
                id: productId,
                name: 'Abs Stock',
                currentStock: 50,
                stockDelta: 100,
                updatedAt: new Date().toISOString()
            }]
        });

        const stock = await ProductShopStock.findOne({ productId });
        expect(stock.onHand).toBe(7);
    });

    it('should not fail entire sync when one expenditure payload is malformed', async () => {
      const response = await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send({
        expenditures: [
          { id: 'exp-good-1', title: 'Valid', amount: -100, date: new Date().toISOString() },
          { title: 'Missing ID', amount: -50, date: new Date().toISOString() }
        ]
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.skipped.expenditures).toBe(1);

      const saved = await Expenditure.find({ business: businessId });
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('exp-good-1');
    });

    it('should process large offline transaction replay batch and remain idempotent', async () => {
      const now = Date.now();
      const productId = 'offline-stock-prod';
      await Product.create({ businessId: businessId.toString(), id: productId, name: 'Tracked Product', stock: 100 });
      await ProductShopStock.create({ businessId: businessId.toString(), shopId, productId, onHand: 100 });

      const transactions = Array.from({ length: 12 }).map((_, i) => ({
        id: `offline-tx-${i + 1}`,
        transactionId: `offline-tx-${i + 1}`,
        idempotencyKey: `offline-tx-${i + 1}`,
        transactionDate: new Date(now + i * 1000).toISOString(),
        customerName: `Offline ${i + 1}`,
        items: [{ productId, productName: 'Tracked Product', quantity: 1, multiplier: 1, total: 10 }],
        totalAmount: 10,
        amountPaid: 10,
        updatedAt: new Date(now + i * 1000).toISOString(),
        shopId
      }));

      const payload = { transactions, shopId };

      const first = await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send(payload);
      const second = await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send(payload);

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);

      const savedTransactions = await Transaction.find({ businessId });
      expect(savedTransactions).toHaveLength(12);
      const stock = await ProductShopStock.findOne({ businessId: businessId.toString(), shopId, productId });
      expect(stock.onHand).toBe(88);
    });

    it('should safely handle partial failures and keep successful tx idempotent', async () => {
      const productId = 'partial-stock-prod';
      await Product.create({ businessId: businessId.toString(), id: productId, name: 'Partial Product', stock: 30 });
      await ProductShopStock.create({ businessId: businessId.toString(), shopId, productId, onHand: 30 });

      const response = await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send({
        shopId,
        transactions: [
          {
            id: 'partial-ok',
            idempotencyKey: 'partial-ok',
            transactionDate: new Date().toISOString(),
            customerName: 'OK',
            items: [{ productId, productName: 'Partial Product', quantity: 2, multiplier: 1, total: 20 }],
            totalAmount: 20,
            amountPaid: 20,
            updatedAt: new Date().toISOString()
          },
          {
            id: '',
            idempotencyKey: 'partial-bad',
            transactionDate: new Date().toISOString(),
            customerName: 'Bad',
            items: [{ productId, productName: 'Partial Product', quantity: 5, multiplier: 1, total: 50 }],
            totalAmount: 50,
            amountPaid: 50,
            updatedAt: new Date().toISOString()
          }
        ]
      });

      expect(response.statusCode).toBe(200);
      const txCount = await Transaction.countDocuments({ businessId });
      expect(txCount).toBe(1);
      const stock = await ProductShopStock.findOne({ businessId: businessId.toString(), shopId, productId });
      expect(stock.onHand).toBe(28);

      const replay = await request(app).post('/api/sync').set('Authorization', `Bearer ${token}`).send({
        shopId,
        transactions: [{
          id: 'partial-ok',
          idempotencyKey: 'partial-ok',
          transactionDate: new Date().toISOString(),
          customerName: 'OK',
          items: [{ productId, productName: 'Partial Product', quantity: 2, multiplier: 1, total: 20 }],
          totalAmount: 20,
          amountPaid: 20,
          updatedAt: new Date(Date.now() - 1000).toISOString()
        }]
      });
      expect(replay.statusCode).toBe(200);
      const stockAfterReplay = await ProductShopStock.findOne({ businessId: businessId.toString(), shopId, productId });
      expect(stockAfterReplay.onHand).toBe(28);
    });
  });

  describe('GET /api/sync (Full State)', () => {
    it('should return correct data version', async () => {
        const response = await request(app)
            .get('/api/sync/version')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('versions');
        expect(typeof response.body.version).toBe('number');
        expect(typeof response.body.versions.transactions).toBe('number');
    });

    it('should filter data by shopId', async () => {
        const shop2 = await Shop.create({ businessId: businessId.toString(), name: 'Shop 2' });
        const shop2Id = shop2._id.toString();

        await Transaction.create([
            { businessId, id: 'tx-s1', shopId, totalAmount: 10, items: [] },
            { businessId, id: 'tx-s2', shopId: shop2Id, totalAmount: 20, items: [] }
        ]);

        const response = await request(app)
            .get('/api/sync')
            .set('Authorization', `Bearer ${token}`)
            .query({ shopId });

        expect(response.statusCode).toBe(200);
        expect(response.body.transactions.length).toBe(1);
        expect(response.body.transactions[0].id).toBe('tx-s1');
    });

    it('should support partial domain fetch for transactions only', async () => {
        await Transaction.create({ businessId, id: 'tx-partial-1', shopId, totalAmount: 15, items: [] });
        await Product.create({ businessId: businessId.toString(), id: 'p-partial-1', name: 'Partial Product' });

        const response = await request(app)
            .get('/api/sync')
            .set('Authorization', `Bearer ${token}`)
            .query({ domains: 'transactions' });

        expect(response.statusCode).toBe(200);
        expect(response.body.partial).toBe(true);
        expect(Array.isArray(response.body.transactions)).toBe(true);
        expect(response.body.products).toBeUndefined();
    });

    it('should return all transactions (no 1000-record truncation)', async () => {
        const rows = Array.from({ length: 1005 }).map((_, index) => ({
            businessId,
            id: `tx-full-${index}`,
            shopId,
            totalAmount: 1,
            amountPaid: 1,
            items: []
        }));
        await Transaction.insertMany(rows);

        const response = await request(app)
            .get('/api/sync')
            .set('Authorization', `Bearer ${token}`)
            .query({ shopId });

        expect(response.statusCode).toBe(200);
        expect(response.body.transactions.length).toBeGreaterThanOrEqual(1005);
    });
  });
});
