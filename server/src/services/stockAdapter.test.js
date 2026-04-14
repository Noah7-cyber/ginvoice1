const mongoose = require('mongoose');
const {
    decrementStock,
    restoreStock,
    reconcileSaleEdit,
    setCountedQuantity,
    applyManualAdjustment,
    getOnHand
} = require('./stockAdapter');
const Product = require('../models/Product');
const ProductShopStock = require('../models/ProductShopStock');

describe('Stock Adapter Edge Cases', () => {
    const businessId = 'test-biz';
    const shopId = 'test-shop';
    const productId = 'test-prod';

    let mongod;
    beforeAll(async () => {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        await mongoose.connect(uri);
    });

    afterEach(async () => {
        await Product.deleteMany({});
        await ProductShopStock.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.disconnect();
        if (mongod) await mongod.stop();
    });

    describe('applyManualAdjustment', () => {
        it('should initialize stock from Product model if ProductShopStock does not exist', async () => {
            await Product.create({
                businessId,
                id: productId,
                name: 'Test Prod',
                stock: 50
            });

            const onHand = await getOnHand({ businessId, shopId, productId });
            expect(onHand).toBe(50);

            await applyManualAdjustment({ businessId, shopId, productId, delta: -10 });
            const updated = await getOnHand({ businessId, shopId, productId });
            expect(updated).toBe(40);
        });

        it('should handle zero delta', async () => {
            await ProductShopStock.create({ businessId, shopId, productId, onHand: 20 });
            const result = await applyManualAdjustment({ businessId, shopId, productId, delta: 0 });
            expect(result).toBe(20);
        });

        it('should handle currentStock override', async () => {
            await ProductShopStock.create({ businessId, shopId, productId, onHand: 20 });
            const result = await applyManualAdjustment({ businessId, shopId, productId, currentStock: 100 });
            expect(result).toBe(100);
            const inDb = await ProductShopStock.findOne({ businessId, shopId, productId });
            expect(inDb.onHand).toBe(100);
        });
    });

    describe('decrementStock and restoreStock', () => {
        it('should correctly decrement (absolute value of qty)', async () => {
            await ProductShopStock.create({ businessId, shopId, productId, onHand: 30 });
            await decrementStock({ businessId, shopId, productId, qty: 5 });
            expect(await getOnHand({ businessId, shopId, productId })).toBe(25);

            // Edge case: passing negative qty to decrement should still decrement
            await decrementStock({ businessId, shopId, productId, qty: -5 });
            expect(await getOnHand({ businessId, shopId, productId })).toBe(20);
        });

        it('should correctly restore (absolute value of qty)', async () => {
            await ProductShopStock.create({ businessId, shopId, productId, onHand: 30 });
            await restoreStock({ businessId, shopId, productId, qty: 10 });
            expect(await getOnHand({ businessId, shopId, productId })).toBe(40);

            // Edge case: passing negative qty to restore should still increment
            await restoreStock({ businessId, shopId, productId, qty: -10 });
            expect(await getOnHand({ businessId, shopId, productId })).toBe(50);
        });
    });

    describe('reconcileSaleEdit', () => {
        it('should correctly reconcile stock when items are changed', async () => {
            const p1 = 'p1';
            const p2 = 'p2';
            await ProductShopStock.create([
                { businessId, shopId, productId: p1, onHand: 10 },
                { businessId, shopId, productId: p2, onHand: 10 }
            ]);

            const originalItems = [
                { productId: p1, quantity: 2, multiplier: 1 }
            ];
            const newItems = [
                { productId: p1, quantity: 1, multiplier: 1 },
                { productId: p2, quantity: 3, multiplier: 2 } // 3 * 2 = 6
            ];

            await reconcileSaleEdit({ businessId, shopId, originalItems, newItems });

            expect(await getOnHand({ businessId, shopId, productId: p1 })).toBe(11); // 10 + 2 - 1 = 11
            expect(await getOnHand({ businessId, shopId, productId: p2 })).toBe(4);  // 10 - 6 = 4
        });
    });
});
