const request = require('supertest');
const app = require('../index');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Business = require('../models/Business');
const Product = require('../models/Product');
const ProductShopStock = require('../models/ProductShopStock');
const jwt = require('jsonwebtoken');

describe('Transactions API Edge Cases', () => {
  let token;
  const businessId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const shopId = new mongoose.Types.ObjectId().toString();

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

    // Create a real shop to avoid CastError in resolveShopId
    await mongoose.model('Shop').create({
        _id: new mongoose.Types.ObjectId(shopId),
        businessId: businessId.toString(),
        name: 'Test Shop'
    });

    token = jwt.sign({ userId: userId.toString(), businessId: businessId.toString(), role: 'owner' }, process.env.JWT_SECRET);
  });

  afterEach(async () => {
    await Transaction.deleteMany({});
    await Product.deleteMany({});
    await ProductShopStock.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  describe('POST /api/transactions', () => {
    it('should handle overpayment (amountPaid > totalAmount)', async () => {
      const payload = {
        id: 'tx-1',
        items: [],
        totalAmount: 100,
        amountPaid: 150,
        paymentMethod: 'cash',
        shopId
      };

      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.statusCode).toBe(201);
      expect(response.body.balance).toBe(0);
      expect(response.body.paymentStatus).toBe('paid');
      expect(response.body.amountPaid).toBe(150);
    });

    it('should handle zero totalAmount', async () => {
      const payload = {
        id: 'tx-2',
        items: [],
        totalAmount: 0,
        amountPaid: 0,
        paymentMethod: 'cash',
        shopId
      };

      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.statusCode).toBe(201);
      expect(response.body.balance).toBe(0);
      expect(response.body.paymentStatus).toBe('paid');
    });

    it('should decrement stock correctly with multipliers', async () => {
        const productId = 'prod-1';
        await Product.create({
            businessId: businessId.toString(),
            id: productId,
            name: 'Product 1',
            stock: 100
        });
        await ProductShopStock.create({
            businessId: businessId.toString(),
            shopId,
            productId,
            onHand: 100
        });

        const payload = {
            id: 'tx-3',
            items: [{
                productId,
                productName: 'Product 1',
                quantity: 2,
                multiplier: 12, // e.g. 2 boxes of 12
                total: 240
            }],
            totalAmount: 240,
            amountPaid: 240,
            paymentMethod: 'cash',
            shopId
        };

        const response = await request(app)
            .post('/api/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);

        expect(response.statusCode).toBe(201);
        const stock = await ProductShopStock.findOne({ businessId: businessId.toString(), shopId, productId });
        expect(stock.onHand).toBe(100 - (2 * 12));
    });

    it('should be idempotent for repeated create requests with same idempotencyKey', async () => {
      const productId = 'prod-idem';
      await Product.create({ businessId: businessId.toString(), id: productId, name: 'Product idem', stock: 20 });
      await ProductShopStock.create({ businessId: businessId.toString(), shopId, productId, onHand: 20 });

      const payload = {
        id: 'tx-idem-1',
        transactionId: 'tx-idem-1',
        idempotencyKey: 'idem-key-1',
        items: [{ productId, productName: 'Product idem', quantity: 2, multiplier: 1, total: 20 }],
        totalAmount: 20,
        amountPaid: 20,
        paymentMethod: 'cash',
        shopId
      };

      const first = await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(payload);
      const second = await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(payload);

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(200);
      const txCount = await Transaction.countDocuments({ businessId, id: 'tx-idem-1' });
      expect(txCount).toBe(1);
      const stock = await ProductShopStock.findOne({ businessId: businessId.toString(), shopId, productId });
      expect(stock.onHand).toBe(18);
    });

    it('should handle multiple sync-now style rapid retries without double stock deduction', async () => {
      const productId = 'prod-multi-click';
      await Product.create({ businessId: businessId.toString(), id: productId, name: 'Product rapid', stock: 15 });
      await ProductShopStock.create({ businessId: businessId.toString(), shopId, productId, onHand: 15 });

      const payload = {
        id: 'tx-multi-click',
        transactionId: 'tx-multi-click',
        idempotencyKey: 'tx-multi-click',
        items: [{ productId, productName: 'Product rapid', quantity: 3, multiplier: 1, total: 30 }],
        totalAmount: 30,
        amountPaid: 30,
        paymentMethod: 'cash',
        shopId
      };

      await Promise.all([
        request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(payload),
        request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(payload),
        request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(payload)
      ]);

      const txCount = await Transaction.countDocuments({ businessId, id: 'tx-multi-click' });
      expect(txCount).toBe(1);
      const stock = await ProductShopStock.findOne({ businessId: businessId.toString(), shopId, productId });
      expect(stock.onHand).toBe(12);
    });
  });

  describe('PUT /api/transactions/:id', () => {
    it('should reconcile stock when items are changed in edit', async () => {
        const p1 = 'p1';
        const p2 = 'p2';
        await Product.create([
            { businessId: businessId.toString(), id: p1, name: 'P1', stock: 10 },
            { businessId: businessId.toString(), id: p2, name: 'P2', stock: 10 }
        ]);
        await ProductShopStock.create([
            { businessId: businessId.toString(), shopId, productId: p1, onHand: 10 },
            { businessId: businessId.toString(), shopId, productId: p2, onHand: 10 }
        ]);

        // Create initial transaction
        await request(app)
            .post('/api/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send({
                id: 'tx-edit',
                items: [{ productId: p1, productName: 'P1', quantity: 2, total: 20 }],
                totalAmount: 20,
                amountPaid: 20,
                shopId
            });

        // Verify stock after create
        let s1 = await ProductShopStock.findOne({ shopId, productId: p1 });
        expect(s1.onHand).toBe(8);

        // Edit: Change P1 qty from 2 to 1, and add P2 with qty 3
        const editPayload = {
            items: [
                { productId: p1, productName: 'P1', quantity: 1, total: 10 },
                { productId: p2, productName: 'P2', quantity: 3, total: 30 }
            ],
            totalAmount: 40,
            amountPaid: 40,
            paymentMethod: 'cash',
            shopId
        };

        const response = await request(app)
            .put('/api/transactions/tx-edit')
            .set('Authorization', `Bearer ${token}`)
            .send(editPayload);

        expect(response.statusCode).toBe(200);

        s1 = await ProductShopStock.findOne({ shopId, productId: p1 });
        const s2 = await ProductShopStock.findOne({ shopId, productId: p2 });

        expect(s1.onHand).toBe(9); // 10 - 1
        expect(s2.onHand).toBe(7); // 10 - 3
    });
  });

  describe('PATCH /api/transactions/:id/settle', () => {
    it('should handle partial payment and floating point tolerance', async () => {
        const txId = 'tx-settle';
        await Transaction.create({
            businessId,
            id: txId,
            totalAmount: 100.00,
            amountPaid: 40.00,
            balance: 60.00,
            paymentStatus: 'credit',
            shopId
        });

        // Pay 59.995 -> should settle to 0 balance if within 0.01 tolerance
        const response = await request(app)
            .patch(`/api/transactions/${txId}/settle`)
            .set('Authorization', `Bearer ${token}`)
            .send({ amountPaid: 99.995 });

        expect(response.statusCode).toBe(200);
        expect(response.body.balance).toBe(0);
        expect(response.body.paymentStatus).toBe('paid');
    });

    it('should remain credit if partial payment is insufficient', async () => {
        const txId = 'tx-partial';
        await Transaction.create({
            businessId,
            id: txId,
            totalAmount: 100,
            amountPaid: 20,
            balance: 80,
            paymentStatus: 'credit',
            shopId
        });

        const response = await request(app)
            .patch(`/api/transactions/${txId}/settle`)
            .set('Authorization', `Bearer ${token}`)
            .send({ amountPaid: 50 });

        expect(response.statusCode).toBe(200);
        expect(response.body.balance).toBe(50);
        expect(response.body.paymentStatus).toBe('credit');
    });
  });

  describe('DELETE /api/transactions/:id', () => {
      it('should restock items upon deletion', async () => {
          const productId = 'prod-del';
          await ProductShopStock.create({ businessId: businessId.toString(), shopId, productId, onHand: 5 });

          const txId = 'tx-del';
          await Transaction.create({
              businessId,
              id: txId,
              items: [{ productId, productName: 'Del', quantity: 3, multiplier: 1 }],
              totalAmount: 30,
              shopId
          });

          const response = await request(app)
            .delete(`/api/transactions/${txId}`)
            .set('Authorization', `Bearer ${token}`)
            .query({ restock: 'true', shopId });

          expect(response.statusCode).toBe(200);
          const stock = await ProductShopStock.findOne({ shopId, productId });
          expect(stock.onHand).toBe(8);
      });
  });
});
