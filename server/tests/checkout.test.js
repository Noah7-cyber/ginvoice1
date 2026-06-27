const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Product = require('../src/models/Product');
const { applyManualAdjustment, decrementStock } = require('../src/services/stockAdapter');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Product.deleteMany({});
});

describe('Checkout / Stock Adapter logic', () => {
  it('Test 1: A legacy product (missing itemType entirely) successfully subtracts stock', async () => {
    // Create a product without itemType via direct DB insertion to simulate legacy
    const pId = 'prod-legacy';
    await Product.collection.insertOne({
      businessId: 'bus-1',
      id: pId,
      name: 'Legacy Product',
      stock: 50,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Run stock deduction (which should apply since it defaults to PRODUCT / is not SERVICE)
    await decrementStock({ businessId: 'bus-1', productId: pId, qty: 5 });

    // Check stock
    const p = await Product.findOne({ id: pId });
    expect(p.stock).toBe(45);
  });

  it('Test 2: A newly created SERVICE item successfully bypasses stock deduction', async () => {
    const pId = 'prod-service';
    const p = new Product({
      businessId: 'bus-1',
      id: pId,
      name: 'Repair Service',
      stock: 10,
      itemType: 'SERVICE'
    });
    await p.save();

    // Run stock deduction
    await decrementStock({ businessId: 'bus-1', productId: pId, qty: 5 });

    // Check stock (should remain 10)
    const updated = await Product.findOne({ id: pId });
    expect(updated.stock).toBe(10);
  });
});
