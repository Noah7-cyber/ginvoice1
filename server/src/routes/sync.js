const express = require('express');
const mongoose = require('mongoose');
const { Decimal128, ObjectId } = mongoose.Types;

// Models
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Business = require('../models/Business');
const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');
const Notification = require('../models/Notification');
const Shop = require('../models/Shop');
const ProductShopStock = require('../models/ProductShopStock');
const { maybeCreateStockVerificationNotification } = require('../services/stockVerification');
const { resolveShopId, isAllShopsMode } = require('../services/shopContext');
const { decrementStock, restoreStock } = require('../services/stockAdapter');

// Middleware
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');

const router = express.Router();

const withAtomic = async (work) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => work(session));
  } catch (err) {
    if (err?.code === 20 || String(err?.message || '').includes('Transaction numbers are only allowed')) {
      await work(null);
    } else {
      throw err;
    }
  } finally {
    await session.endSession();
  }
};

// --- HELPER FUNCTIONS ---
const toDecimal = (value) => {
  if (value === null || value === undefined || value === '') return mongoose.Types.Decimal128.fromString('0');
  if (value instanceof Decimal128) return value;
  return mongoose.Types.Decimal128.fromString(String(value));
};

const parseDecimal = (val) => {
  if (!val) return 0;
  if (val.toString) return parseFloat(val.toString());
  return Number(val);
};

const normalizeCustomerName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'Walk-in Customer';
  return clean
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

// --- ROUTES ---


const normalizeVersion = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(3));
};

const parseDomainsParam = (value) => {
  if (!value) return null;
  const requested = String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (requested.length === 0) return null;
  return new Set(requested);
};

const parseDateOrFallback = (value, fallback = null) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};


// 0. Time Check (Anti-Cheat)
router.get('/time', (req, res) => {
    // Return server time for drift calculation
    res.json({ time: Date.now() });
});

// 0. Version Check
router.get('/version', auth, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId).select('dataVersion syncVersions');
    // Return version as a float, defaulting to 0.000
    // Ensure it's a number for the JSON response
    const version = normalizeVersion(business?.dataVersion);
    const versions = {
      transactions: normalizeVersion(business?.syncVersions?.transactions),
      products: normalizeVersion(business?.syncVersions?.products),
      expenditures: normalizeVersion(business?.syncVersions?.expenditures),
      categories: normalizeVersion(business?.syncVersions?.categories)
    };
    res.json({ version, versions });
  } catch (err) {
    console.error('Version check failed:', err);
    res.status(500).json({
      version: 0.000,
      versions: { transactions: 0.000, products: 0.000, expenditures: 0.000, categories: 0.000 }
    });
  }
});

// 1. GET Full State (Online-Only Mode) - EMERGENCY VERSION
router.get('/', auth, async (req, res) => {
  try {
    // FORCE FIX: Trim whitespace to prevent invisible mismatches
    const businessId = String(req.businessId).trim();

    console.log(`[SYNC] 🚀 STARTING FETCH for Business ID: "${businessId}"`);

    const businessData = await Business.findById(businessId).lean();
    const defaultShopId = await resolveShopId({ businessId, requestedShopId: businessData?.defaultShopId });
    const requestedShopId = req.assignedShopId || (req.query.shopId ? String(req.query.shopId) : defaultShopId);
    const allShopsMode = req.assignedShopId ? false : (req.query.allShops === 'true');

    const requestedDomains = parseDomainsParam(req.query.domains);
    const shouldInclude = (domain) => !requestedDomains || requestedDomains.has(domain);

    const transactionFilter = { businessId, ...(allShopsMode ? {} : { shopId: requestedShopId }) };
    const expenditureFilter = { business: businessId, ...(allShopsMode ? {} : { shopId: requestedShopId }) };

    const productsPromise = shouldInclude('products')
      ? Product.find({
          businessId: { $in: [businessId, new ObjectId(businessId)] }
        }).lean()
      : Promise.resolve([]);
    const transactionsPromise = shouldInclude('transactions')
      ? Transaction.find(transactionFilter).sort({ createdAt: -1 }).lean()
      : Promise.resolve([]);
    const expendituresPromise = shouldInclude('expenditures')
      ? Expenditure.find(expenditureFilter).lean()
      : Promise.resolve([]);
    const categoriesPromise = shouldInclude('categories')
      ? Category.find({ businessId }).sort({ usageCount: -1, name: 1 }).lean()
      : Promise.resolve([]);
    const notificationsPromise = shouldInclude('notifications')
      ? Notification.find({ businessId, dismissedAt: null }).sort({ timestamp: -1 }).limit(50).lean()
      : Promise.resolve([]);
    const shopsPromise = shouldInclude('shops')
      ? Shop.find({ businessId }).sort({ isMain: -1, createdAt: 1 }).lean()
      : Promise.resolve([]);
    const shopStocksPromise = shouldInclude('products')
      ? ProductShopStock.find({ businessId, ...(allShopsMode ? {} : { shopId: requestedShopId }) }).lean()
      : Promise.resolve([]);

    const [rawProducts, fetchedTransactions, fetchedExpenditures, rawCategories, rawNotifications, rawShops, fetchedShopStocks] = await Promise.all([
      productsPromise,
      transactionsPromise,
      expendituresPromise,
      categoriesPromise,
      notificationsPromise,
      shopsPromise,
      shopStocksPromise
    ]);

    const activeShops = (rawShops || []).filter((shop) => (shop.status || 'active') === 'active');
    const activeShopIdSet = new Set(activeShops.map((shop) => String(shop._id)));
    const rawTransactions = allShopsMode
      ? (fetchedTransactions || []).filter((tx) => !tx.shopId || activeShopIdSet.has(String(tx.shopId)))
      : (fetchedTransactions || []);
    const rawExpenditures = allShopsMode
      ? (fetchedExpenditures || []).filter((exp) => !exp.shopId || activeShopIdSet.has(String(exp.shopId)))
      : (fetchedExpenditures || []);
    const rawShopStocks = allShopsMode
      ? (fetchedShopStocks || []).filter((row) => activeShopIdSet.has(String(row.shopId)))
      : (fetchedShopStocks || []);
    const selectedShop = requestedShopId ? activeShops.find((shop) => String(shop._id) === String(requestedShopId)) : null;

    const productStockMap = new Map();
    for (const row of rawShopStocks) {
      if (row?.isListed === false) continue;
      const key = String(row.productId);
      const current = Number(productStockMap.get(key) || 0);
      productStockMap.set(key, current + Number(row.onHand || 0));
    }

    // --- DETECTIVE MODE: DIAGNOSE EMPTY PRODUCTS ---
    console.log(`[SYNC] Found ${rawProducts.length} products.`);

    if (rawProducts.length === 0) {
        console.log(`[SYNC] ⚠️ PRODUCTS EMPTY! Running Emergency Check...`);

        // Check if ANY products exist in the DB at all
        const anyProduct = await Product.findOne({}).lean();

        if (anyProduct) {
            console.log(`[SYNC] 🕵️  DB Check: Products DO exist.`);
            console.log(`[SYNC] 🕵️  Comparison:`);
            console.log(`[SYNC]    👉 Your ID: "${businessId}"`);
            console.log(`[SYNC]    👉 DB ID:   "${anyProduct.businessId}"`);

            if (String(anyProduct.businessId) === String(businessId)) {
                console.log(`[SYNC] 🤯 IDs match but query failed? Check Mongoose version.`);
            } else {
                console.log(`[SYNC] ✅ Result: ID Mismatch. You are logged into the wrong account.`);
            }
        } else {
            console.log(`[SYNC] 🛑 Result: The 'products' collection is totally empty.`);
        }
    }
    // ------------------------------------------------

    // Map Decimals to Numbers
    const categories = rawCategories.map(c => ({
      id: c._id.toString(),
      name: c.name,
      businessId: c.businessId,
      defaultSellingPrice: parseDecimal(c.defaultSellingPrice),
      defaultCostPrice: parseDecimal(c.defaultCostPrice),
      defaultUnit: c.defaultUnit || ''
    }));

    const explicitVisibleIds = new Set((rawShopStocks || []).filter((row) => row?.isListed !== false).map((row) => String(row.productId)));
    const legacyHiddenIds = new Set((rawShopStocks || []).filter((row) => row?.isListed === false).map((row) => String(row.productId)));

    const products = rawProducts
      .filter((p) => {
        const productId = (p.id && p.id !== 'undefined' && p.id !== 'null') ? p.id : p._id.toString();
        if (allShopsMode) return true;
        if (!selectedShop) return true;
        if (selectedShop.inventoryMode === 'explicit') {
          return explicitVisibleIds.has(String(productId));
        }
        return !legacyHiddenIds.has(String(productId));
      })
      .map(p => ({
      ...p,
      id: (p.id && p.id !== 'undefined' && p.id !== 'null') ? p.id : p._id.toString(),
      currentStock: productStockMap.has((p.id && p.id !== 'undefined' && p.id !== 'null') ? p.id : p._id.toString())
        ? Number(productStockMap.get((p.id && p.id !== 'undefined' && p.id !== 'null') ? p.id : p._id.toString()) || 0)
        : (p.stock !== undefined ? p.stock : (p.currentStock || 0)),
      sellingPrice: parseDecimal(p.sellingPrice),
      costPrice: parseDecimal(p.costPrice),
      units: (p.units || []).map(u => ({
        ...u,
        sellingPrice: parseDecimal(u.sellingPrice),
        costPrice: parseDecimal(u.costPrice)
      }))
    }));

    const transactions = rawTransactions.map(t => ({
      ...t,
      id: (t.id && t.id !== 'undefined' && t.id !== 'null') ? t.id : t._id.toString(),
      shopId: t.shopId || (businessData?.defaultShopId || null),
      isPreviousDebt: Boolean(t.isPreviousDebt),
      items: (t.items || []).map(i => ({
        ...i,
        unitPrice: parseDecimal(i.unitPrice),
        discount: parseDecimal(i.discount),
        total: parseDecimal(i.total)
      })),
      subtotal: parseDecimal(t.subtotal),
      globalDiscount: parseDecimal(t.globalDiscount),
      totalAmount: parseDecimal(t.totalAmount),
      amountPaid: parseDecimal(t.amountPaid),
      balance: parseDecimal(t.balance)
    }));

    const expenditures = rawExpenditures.map(e => {
      const val = parseDecimal(e.amount);
      let finalAmount = val;
      let finalFlow = 'out'; // Default

      // 1. Respect existing label if present
      if (e.flowType === 'out') {
        finalFlow = 'out';
        finalAmount = -Math.abs(val); // Force Negative
      } else if (e.flowType === 'in') {
        finalFlow = 'in';
        finalAmount = Math.abs(val);  // Force Positive
      } else {
        // 2. Fallback to sign detection for new/undefined records
        finalFlow = val >= 0 ? 'in' : 'out';
        finalAmount = val;
      }

      return {
        ...e,
        id: (e.id && e.id !== 'undefined' && e.id !== 'null') ? e.id : e._id.toString(),
        shopId: e.shopId || (businessData?.defaultShopId || null),
        amount: finalAmount,
        flowType: finalFlow
      };
    });

    const notifications = (rawNotifications || [])
      .filter((n) => {
        if (allShopsMode) return true;
        const noteShopId = n.shopId || n?.payload?.shopId;
        if (!noteShopId) return true;
        return String(noteShopId) === String(requestedShopId);
      })
      .map(n => ({
        id: n._id.toString(),
        title: n.title || '',
        message: n.message,
        body: n.body || '',
        type: n.type,
        shopId: n.shopId || n?.payload?.shopId || null,
        amount: n.amount,
        performedBy: n.performedBy,
        payload: n.payload || null,
        timestamp: n.timestamp
    }));

    // Keep proactive prompts low-noise (max once/day)
    await maybeCreateStockVerificationNotification(businessId);

    const payload = {
      business: businessData ? {
        id: businessData._id,
        name: businessData.name,
        email: businessData.email,
        phone: businessData.phone,
        address: businessData.address,
        staffPermissions: businessData.staffPermissions,
        settings: businessData.settings,
        defaultShopId: businessData.defaultShopId || defaultShopId,
        trialEndsAt: businessData.trialEndsAt,
        isSubscribed: businessData.isSubscribed,
        logo: businessData.logo,
        theme: businessData.theme
      } : undefined,
      activeShopId: allShopsMode ? 'all' : requestedShopId,
      allShopsMode,
      versions: {
        global: normalizeVersion(businessData?.dataVersion),
        transactions: normalizeVersion(businessData?.syncVersions?.transactions),
        products: normalizeVersion(businessData?.syncVersions?.products),
        expenditures: normalizeVersion(businessData?.syncVersions?.expenditures),
        categories: normalizeVersion(businessData?.syncVersions?.categories)
      },
      partial: Boolean(requestedDomains),
      staffContext: req.userRole === 'staff' ? {
        assignedShopId: req.assignedShopId || requestedShopId,
        assignedShopName: req.user?.assignedShopName || selectedShop?.name || '',
        staffName: req.user?.staffName || ''
      } : null
    };

    if (shouldInclude('categories')) payload.categories = categories;
    if (shouldInclude('products')) payload.products = products;
    if (shouldInclude('transactions')) payload.transactions = transactions;
    if (shouldInclude('expenditures')) payload.expenditures = expenditures;
    if (shouldInclude('notifications')) payload.notifications = notifications;
    if (shouldInclude('shops')) {
      payload.shops = activeShops.map((shop) => ({
        id: String(shop._id),
        name: shop.name,
        isMain: Boolean(shop.isMain),
        status: shop.status || 'active'
      }));
    }

    return res.json(payload);

  } catch (err) {
    console.error('[SYNC DEBUG] ❌ Error:', err);
    return res.status(500).json({ message: 'Fetch state failed' });
  }
});

// 2. POST Updates (Direct-Push Mode)
router.post('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { products = [], transactions = [], expenditures = [], business, categories = [] } = req.body || {};
    if (isAllShopsMode(req.body?.allShops)) {
      return res.status(400).json({ message: 'All Shops mode is read-only. Select a specific shop to continue.' });
    }
    const businessId = req.businessId;
    const defaultShopId = req.assignedShopId || await resolveShopId({ businessId, requestedShopId: req.body?.shopId });
    if (req.assignedShopId && req.body?.shopId && String(req.body.shopId) !== String(req.assignedShopId)) {
      return res.status(403).json({ message: 'Staff account is locked to an assigned shop.' });
    }

    if (business && typeof business === 'object') {
       const { staffPermissions, trialEndsAt, isSubscribed, ...safeUpdates } = business;
       await Business.findByIdAndUpdate(businessId, { $set: { ...safeUpdates, lastActiveAt: new Date() } });
    }

    const changedDomains = {
      categories: categories.length > 0,
      products: products.length > 0,
      transactions: transactions.length > 0,
      expenditures: expenditures.length > 0
    };
    // 3. Increment Version(s) if changes detected
    if (Object.values(changedDomains).some(Boolean)) {
      const inc = { dataVersion: 0.001 };
      if (changedDomains.categories) inc['syncVersions.categories'] = 0.001;
      if (changedDomains.products) inc['syncVersions.products'] = 0.001;
      if (changedDomains.transactions) inc['syncVersions.transactions'] = 0.001;
      if (changedDomains.expenditures) inc['syncVersions.expenditures'] = 0.001;
      await Business.findByIdAndUpdate(businessId, { $inc: inc });
    }

    if (categories.length > 0) {
      const catOps = categories.map(c => ({
        updateOne: {
          filter: { businessId, name: c.name },
          update: { $set: { businessId, name: c.name, defaultSellingPrice: toDecimal(c.defaultSellingPrice), defaultCostPrice: toDecimal(c.defaultCostPrice), defaultUnit: c.defaultUnit || '' } },
          upsert: true
        }
      }));
      await Category.bulkWrite(catOps);
    }

    let skippedProducts = 0;
    let skippedTransactions = 0;
    let skippedExpenditures = 0;

    if (products.length > 0) {
      const incomingProductIds = products
        .map((p) => String(p?.id || '').trim())
        .filter(Boolean);

      const existingProducts = incomingProductIds.length > 0
        ? await Product.find({ businessId, id: { $in: incomingProductIds } }).lean()
        : [];

      // Pre-fetch server-side truth for manual update comparison
      const existingStocks = incomingProductIds.length > 0
        ? await ProductShopStock.find({ businessId, productId: { $in: incomingProductIds } }).lean()
        : [];

      const existingProductMap = new Map(existingProducts.map((p) => [p.id, p]));
      const existingStockMap = new Map(existingStocks.map((s) => [`${s.productId}_${s.shopId}`, s.onHand || 0]));

      const productNotifications = [];
      const shopPresenceOps = [];

      const productOps = products.map((p) => {
        const productId = String(p?.id || '').trim();
        if (!productId) {
          skippedProducts += 1;
          return null;
        }

        const existing = existingProductMap.get(productId);
        const incomingUpdatedAt = p.updatedAt ? new Date(p.updatedAt) : new Date();
        if (Number.isNaN(incomingUpdatedAt.getTime())) {
          skippedProducts += 1;
          return null;
        }

        const productShopId = req.assignedShopId || p.shopId || defaultShopId;

        if (p.expectedAbsoluteStock !== undefined && p.expectedAbsoluteStock !== null) {
            const currentStock = existingStockMap.get(`${productId}_${productShopId}`) || 0;
            const absoluteIncomingStock = Number(p.expectedAbsoluteStock);
            const serverDelta = absoluteIncomingStock - currentStock;

            if (serverDelta !== 0) {
                transactions.push({
                    idempotencyKey: `adj_${productId}_${Date.now()}_${Math.random()}`,
                    transactionId: `adj_${productId}_${Date.now()}_${Math.random()}`,
                    inventoryEffect: serverDelta > 0 ? 'restock' : 'sale',
                    customerName: 'Stock Adjustment',
                    paymentStatus: 'paid',
                    transactionDate: new Date().toISOString(),
                    shopId: productShopId,
                    items: [{
                        productId: productId,
                        productName: p.name || existing?.name || 'Unknown',
                        quantity: Math.abs(serverDelta),
                        multiplier: 1,
                        unitPrice: 0,
                        discount: 0,
                        total: 0
                    }],
                    subtotal: 0,
                    globalDiscount: 0,
                    totalAmount: 0,
                    amountPaid: 0,
                    balance: 0,
                    createdByRole: req.userRole === 'staff' ? 'staff' : 'owner'
                });
            }
        }

        shopPresenceOps.push({
          updateOne: {
            filter: { businessId, shopId: productShopId, productId },
            update: {
              $set: { businessId, shopId: productShopId, productId, isListed: true, ...(p.expectedAbsoluteStock !== undefined && p.expectedAbsoluteStock !== null ? { onHand: Number(p.expectedAbsoluteStock) } : {}) },
              $setOnInsert: { onHand: Number(p.expectedAbsoluteStock !== undefined && p.expectedAbsoluteStock !== null ? p.expectedAbsoluteStock : (p.currentStock || p.stock || 0)) }
            },
            upsert: true
          }
        });

        if (existing) {
          const existingUpdatedAt = existing.clientUpdatedAt
            ? new Date(existing.clientUpdatedAt)
            : new Date(0);

          if (existing.isDeleted && !p.isDeleted) {
            if (Number.isNaN(existingUpdatedAt.getTime()) || incomingUpdatedAt <= existingUpdatedAt) {
              return null;
            }
          }

          if (!Number.isNaN(existingUpdatedAt.getTime()) && incomingUpdatedAt <= existingUpdatedAt) {
            return null;
          }
        }

        if (p.isDeleted) {
          if (existing && !existing.isDeleted) {
            productNotifications.push({
              businessId,
              type: 'deletion',
              title: 'Product Deleted',
              message: `Product deleted: ${p.name || existing.name || productId}`,
              body: 'An item was removed from inventory.',
              amount: 0,
              performedBy: req.userRole === 'owner' ? 'Owner' : 'Staff',
              shopId: productShopId,
              payload: { productId, shopId: productShopId }
            });
          }
          return {
            updateOne: {
              filter: { businessId, id: productId },
              update: { $set: { isDeleted: true, deletedAt: new Date(), clientUpdatedAt: incomingUpdatedAt, updatedAt: new Date() } }
            }
          };
        }

        const nextSelling = Number(p.sellingPrice || 0);

        if (existing) {
          const prevSelling = parseDecimal(existing.sellingPrice);
          if (nextSelling !== prevSelling) {
            productNotifications.push({
              businessId,
              type: 'modification',
              title: 'Price Changed',
              message: `Price changed for ${p.name || productId}`,
              body: `Selling price: ${prevSelling} → ${nextSelling}`,
              amount: Math.abs(nextSelling - prevSelling),
              performedBy: req.userRole === 'owner' ? 'Owner' : 'Staff',
              shopId: productShopId,
              payload: { productId, shopId: productShopId, productName: p.name || '', field: 'sellingPrice', previous: prevSelling, next: nextSelling }
            });
          }
        }

        const updateSet = {
          businessId,
          id: productId,
          name: p.name || existing?.name || 'Unnamed Product',
          category: p.category,
          sellingPrice: toDecimal(p.sellingPrice),
          costPrice: toDecimal(p.costPrice),
          baseUnit: p.baseUnit || 'Piece',
          units: Array.isArray(p.units) ? p.units.map(u => ({
            name: u.name,
            multiplier: u.multiplier,
            sellingPrice: toDecimal(u.sellingPrice),
            costPrice: toDecimal(u.costPrice)
          })) : [],
          clientUpdatedAt: incomingUpdatedAt,
          updatedAt: new Date(),
          isDeleted: false,
          deletedAt: null
        };

        return {
          updateOne: {
            filter: { businessId, id: productId },
            update: { $set: updateSet },
            upsert: true
          }
        };
      }).filter(Boolean);

      if (productOps.length > 0) {
        await Product.bulkWrite(productOps);
        if (shopPresenceOps.length > 0) {
          await ProductShopStock.bulkWrite(shopPresenceOps);
        }
      }

      if (productNotifications.length > 0) {
        await Notification.insertMany(productNotifications.slice(0, 50));
      }
    }

    if (transactions.length > 0) {
      const incomingIds = transactions
        .map((t) => String(t?.transactionId || t?.id || '').trim())
        .filter(Boolean);

      const existingTxs = incomingIds.length > 0
        ? await Transaction.find({ businessId, id: { $in: incomingIds } }).lean()
        : [];

      const deletedTxNotifications = incomingIds.length > 0
        ? await Notification.find({
            businessId,
            type: 'deletion',
            'payload.transactionId': { $in: incomingIds }
          }).select('payload timestamp').lean()
        : [];

      const deletedTxMap = new Map(
        deletedTxNotifications
          .map((n) => [String(n?.payload?.transactionId || '').trim(), n?.timestamp ? new Date(n.timestamp) : null])
          .filter(([id, ts]) => id && ts && !Number.isNaN(ts.getTime()))
      );

      const existingByIdMap = new Map(existingTxs.map((tx) => [tx.id, tx]));

      for (const t of transactions) {
        const txId = String(t?.transactionId || t?.id || '').trim();
        if (!txId) {
          skippedTransactions += 1;
          continue;
        }

        const incomingUpdatedAt = t.updatedAt ? new Date(t.updatedAt) : new Date();
        if (Number.isNaN(incomingUpdatedAt.getTime())) {
          skippedTransactions += 1;
          continue;
        }

        const deletedAt = deletedTxMap.get(txId);
        if (deletedAt && incomingUpdatedAt <= deletedAt) {
          continue;
        }

        const safeTransactionDate = parseDateOrFallback(t.transactionDate, new Date());
        const idempotencyKey = String(t.idempotencyKey || txId).trim();
        const existingById = existingByIdMap.get(txId) || null;
        const existingByKey = idempotencyKey
          ? await Transaction.findOne({ businessId, idempotencyKey }).lean()
          : null;
        const existing = existingById || existingByKey;

        if (existing) {
          const existingUpdatedAt = existing.clientUpdatedAt ? new Date(existing.clientUpdatedAt) : new Date(0);
          if (!Number.isNaN(existingUpdatedAt.getTime()) && incomingUpdatedAt <= existingUpdatedAt) {
            continue;
          }
        }

        const normalizedItems = (t.items || []).map((item) => ({
          productId: item.productId,
          productName: item.productName || item.productId || 'Unknown Item',
          quantity: Number(item.quantity || 0),
          unit: item.selectedUnit ? item.selectedUnit.name : item.unit,
          multiplier: item.selectedUnit ? item.selectedUnit.multiplier : (item.multiplier || 1),
          unitPrice: toDecimal(item.unitPrice),
          discount: toDecimal(item.discount),
          total: toDecimal(item.total)
        }));

        const nextShopId = req.assignedShopId || t.shopId || existing?.shopId || defaultShopId;
        const inventoryEffect = t.inventoryEffect === 'restock' ? 'restock' : 'sale';

        try {
          await withAtomic(async (session) => {
            if (existing) {
              const existingEffect = existing.inventoryEffect === 'restock' ? 'restock' : 'sale';
              for (const item of existing.items || []) {
                const qty = Number(item.quantity || 0) * Number(item.multiplier || 1);
                if (!item.productId || qty <= 0) continue;
                if (existingEffect === 'sale') {
                  await restoreStock({ businessId, shopId: existing.shopId || defaultShopId, productId: item.productId, qty, session });
                } else {
                  await decrementStock({ businessId, shopId: existing.shopId || defaultShopId, productId: item.productId, qty, session });
                }
              }
            }

            for (const item of normalizedItems) {
              const qty = Number(item.quantity || 0) * Number(item.multiplier || 1);
              if (!item.productId || qty <= 0) continue;
              if (inventoryEffect === 'sale') {
                await decrementStock({ businessId, shopId: nextShopId, productId: item.productId, qty, session });
              } else {
                await restoreStock({ businessId, shopId: nextShopId, productId: item.productId, qty, session });
              }
            }

            await Transaction.updateOne(
              { businessId, id: existing?.id || txId },
              {
                $set: {
                  businessId,
                  shopId: nextShopId,
                  id: txId,
                  idempotencyKey,
                  inventoryEffect,
                  transactionDate: safeTransactionDate,
                  customerName: normalizeCustomerName(t.customerName),
                  customerPhone: t.customerPhone || '',
                  isPreviousDebt: Boolean(t.isPreviousDebt),
                  items: normalizedItems,
                  subtotal: toDecimal(t.subtotal),
                  globalDiscount: toDecimal(t.globalDiscount),
                  totalAmount: toDecimal(t.totalAmount),
                  paymentMethod: t.paymentMethod || 'cash',
                  amountPaid: toDecimal(t.amountPaid),
                  balance: toDecimal(t.balance),
                  paymentStatus: t.paymentStatus === 'credit' ? 'credit' : 'paid',
                  signature: t.signature,
                  isSignatureLocked: Boolean(t.isSignatureLocked),
                  staffId: t.staffId || (t.createdByRole === 'staff' ? 'Store Staff' : 'owner'),
                  createdByRole: t.createdByRole === 'staff' ? 'staff' : 'owner',
                  createdByUserId: t.createdByUserId ? String(t.createdByUserId) : '',
                  clientUpdatedAt: incomingUpdatedAt,
                  updatedAt: new Date()
                },
                $setOnInsert: {
                  createdAt: safeTransactionDate || new Date()
                }
              },
              { upsert: true, ...(session ? { session } : {}) }
            );
          });

          const finalDoc = await Transaction.findOne({ businessId, id: txId }).lean();
          if (finalDoc) existingByIdMap.set(txId, finalDoc);
        } catch (err) {
          skippedTransactions += 1;
        }
      }
    }

    if (expenditures.length > 0) {

      const expOps = expenditures.map((e) => {
        const expId = String(e?.id || '').trim();
        if (!expId) {
          skippedExpenditures += 1;
          return null;
        }
        const val = parseDecimal(e.amount);
        return {
          updateOne: {
            filter: { business: businessId, id: expId },
            update: {
              $set: {
                business: businessId,
                shopId: req.assignedShopId || e.shopId || defaultShopId,
                id: expId,
                date: parseDateOrFallback(e.date, new Date()),
                amount: toDecimal(e.amount),
                category: e.category,
                title: e.title,
                description: e.description,
                paymentMethod: e.paymentMethod,
                expenseType: e.expenseType || 'business',
                updatedAt: new Date(),
                flowType: val >= 0 ? 'in' : 'out'
              }
            },
            upsert: true
          }
        };
      }).filter(Boolean);
      if (expOps.length > 0) {
        await Expenditure.bulkWrite(expOps);
      }
    }

    return res.json({
      success: true,
      syncedAt: new Date(),
      skipped: {
        products: skippedProducts,
        transactions: skippedTransactions,
        expenditures: skippedExpenditures
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sync failed' });
  }
});


// 3. DELETE Routes (Missing in original sync)
router.delete('/products/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = String(req.businessId).trim();
    const shopId = await resolveShopId({ businessId, requestedShopId: req.query.shopId });

    // Hard Delete?
    if (req.query.hard === 'true') {
        const result = await Product.deleteOne({ businessId: { $in: [businessId, new ObjectId(businessId)] }, id });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Product not found for hard delete' });
        await ProductShopStock.deleteMany({ businessId, productId: id });
        return res.json({ success: true, id, hard: true });
    }

    // Shop-scoped remove (default behavior): hide item only from active shop.
    const baseProduct = await Product.findOne({ businessId: { $in: [businessId, new ObjectId(businessId)] }, id }).select('id').lean();
    if (!baseProduct) return res.status(404).json({ message: 'Product not found' });

    await ProductShopStock.updateOne(
      { businessId, shopId, productId: id },
      { $set: { businessId, shopId, productId: id, isListed: false, onHand: 0 } },
      { upsert: true }
    );

    await Notification.create({
      businessId,
      title: 'Product Deleted',
      message: `Product deleted: ${id}`,
      body: 'Owner deleted an item from inventory.',
      amount: 0,
      performedBy: req.userRole === 'owner' ? 'Owner' : 'Staff',
      type: 'deletion',
      shopId,
      payload: { productId: id, shopId }
    });

    res.json({ success: true, id, shopId, scope: 'shop' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

router.delete('/transactions/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = new mongoose.Types.ObjectId(req.businessId); // Transactions use ObjectId
    const defaultShopId = await resolveShopId({ businessId: req.businessId, requestedShopId: req.query.shopId });

    // 1. Find transaction first (needed for both restock and notification)
    const transaction = await Transaction.findOne({ businessId, id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // 2. Restock if requested
    if (req.query.restock === 'true' && transaction.items) {
        const transactionShopId = transaction.shopId || defaultShopId;
        // Restore stock
        for (const item of transaction.items) {
             const multiplier = item.multiplier || 1;
             await restoreStock({ businessId: req.businessId, shopId: transactionShopId, productId: item.productId, qty: item.quantity * multiplier });
        }
    }

    // 3. Create Ghost Note (Notification)
    const performerName = req.userRole === 'owner' ? 'Owner' : 'Staff';
    await Notification.create({
        businessId: req.businessId,
        message: `Sale to ${transaction.customerName || 'Customer'} deleted`,
        amount: transaction.totalAmount || 0,
        performedBy: performerName,
        type: 'deletion',
        shopId: transaction.shopId || defaultShopId,
        payload: { transactionId: transaction.id, shopId: transaction.shopId || defaultShopId }
    });

    // 4. Hard Delete
    await Transaction.deleteOne({ businessId, id });
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

router.delete('/expenditures/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;
    await Expenditure.deleteOne({ business: businessId, id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;
