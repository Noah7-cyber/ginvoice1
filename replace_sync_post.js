const fs = require('fs');

const filepath = 'server/src/routes/sync.js';
let content = fs.readFileSync(filepath, 'utf8');

const postStartIdx = content.indexOf('// 2. POST Updates (Direct-Push Mode)');

if (postStartIdx !== -1) {
  // We want to replace the whole POST router logic until the DELETE Routes.
  const deleteStartIdx = content.indexOf('// 3. DELETE Routes (Missing in original sync)', postStartIdx);

  if (deleteStartIdx !== -1) {
    const newPostRoute = `// 2. POST Updates (Direct-Push Mode)
router.post('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { products = [], transactions = [], expenditures = [], business, categories = [] } = req.body || {};
    const businessId = String(req.businessId).trim();

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
      const incomingProductIds = products.map((p) => String(p?.id || '').trim()).filter(Boolean);
      const existingProducts = incomingProductIds.length > 0
        ? await Product.find({ businessId, id: { $in: incomingProductIds } }).lean()
        : [];
      const existingProductMap = new Map(existingProducts.map((p) => [p.id, p]));

      const productOps = products.map((p) => {
        const productId = String(p?.id || '').trim();
        if (!productId) {
          skippedProducts += 1;
          return null;
        }

        const existing = existingProductMap.get(productId);
        const incomingUpdatedAt = p.updatedAt ? new Date(p.updatedAt) : new Date();

        if (existing) {
          const existingUpdatedAt = existing.clientUpdatedAt ? new Date(existing.clientUpdatedAt) : new Date(0);
          if (!Number.isNaN(existingUpdatedAt.getTime()) && incomingUpdatedAt <= existingUpdatedAt) {
             skippedProducts += 1;
             return null;
          }
        }

        const stockUpdate = {};
        if (p.expectedAbsoluteStock !== undefined && p.expectedAbsoluteStock !== null) {
           stockUpdate.$set = { stock: Number(p.expectedAbsoluteStock) };
        } else if (!existing) {
           stockUpdate.$set = { stock: Number(p.currentStock || p.stock || 0) };
        }

        return {
          updateOne: {
            filter: { businessId, id: productId },
            update: {
              ...stockUpdate,
              $set: {
                ...(stockUpdate.$set || {}),
                name: p.name || (existing ? existing.name : 'Unknown Product'),
                sku: p.sku || '',
                category: p.category || 'Uncategorized',
                sellingPrice: toDecimal(p.sellingPrice),
                costPrice: toDecimal(p.costPrice),
                baseUnit: p.baseUnit || 'Piece',
                units: Array.isArray(p.units) ? p.units.map(u => ({
                  name: u.name,
                  multiplier: Number(u.multiplier || 1),
                  sellingPrice: toDecimal(u.sellingPrice),
                  costPrice: toDecimal(u.costPrice)
                })) : [],
                clientUpdatedAt: incomingUpdatedAt,
                updatedAt: new Date()
              }
            },
            upsert: true
          }
        };
      }).filter(Boolean);

      if (productOps.length > 0) {
        await Product.bulkWrite(productOps);
      }
    }

    if (transactions.length > 0) {
      const existingByIdMap = new Map();

      for (const t of transactions) {
        const txId = String(t?.id || '').trim();
        if (!txId) {
          skippedTransactions += 1;
          continue;
        }

        const safeTransactionDate = parseDateOrFallback(t.transactionDate, new Date());
        const incomingUpdatedAt = t.updatedAt ? new Date(t.updatedAt) : safeTransactionDate;

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

        const inventoryEffect = t.inventoryEffect === 'restock' ? 'restock' : 'sale';

        try {
          await withAtomic(async (session) => {
            if (existing) {
              const existingEffect = existing.inventoryEffect === 'restock' ? 'restock' : 'sale';
              for (const item of existing.items || []) {
                const qty = Number(item.quantity || 0) * Number(item.multiplier || 1);
                if (!item.productId || qty <= 0) continue;
                if (existingEffect === 'sale') {
                  await restoreStock({ businessId, productId: item.productId, qty, session });
                } else {
                  await decrementStock({ businessId, productId: item.productId, qty, session });
                }
              }
            }

            for (const item of normalizedItems) {
              const qty = Number(item.quantity || 0) * Number(item.multiplier || 1);
              if (!item.productId || qty <= 0) continue;
              if (inventoryEffect === 'sale') {
                await decrementStock({ businessId, productId: item.productId, qty, session });
              } else {
                await restoreStock({ businessId, productId: item.productId, qty, session });
              }
            }

            await Transaction.updateOne(
              { businessId, id: existing?.id || txId },
              {
                $set: {
                  businessId,
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
});\n\n`;

    content = content.substring(0, postStartIdx) + newPostRoute + content.substring(deleteStartIdx);
    fs.writeFileSync(filepath, content, 'utf8');
  }
}
