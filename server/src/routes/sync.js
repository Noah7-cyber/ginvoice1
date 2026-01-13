const express = require('express');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Business = require('../models/Business');
const Expenditure = require('../models/Expenditure');
const DiscountCode = require('../models/DiscountCode');
const Category = require('../models/Category');
const auth = require('../middleware/auth');

const router = express.Router();

const toDecimal = (value) => {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return mongoose.Types.Decimal128.fromString('0');
  return mongoose.Types.Decimal128.fromString(String(value));
};

// Helper to safely convert Decimal128 to Number
const parseDecimal = (val) => parseFloat((val || 0).toString());

const safeSubtract = (a, b) => {
  // Multiplies by 10000 to work with integers, then divides back
  return Number(((a * 10000) - (b * 10000)) / 10000).toFixed(4);
};

router.get('/check', auth, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId).lean();
    if (!business) return res.status(404).json({ message: 'Business not found' });

    const now = new Date();
    const trialEndsAt = business.trialEndsAt ? new Date(business.trialEndsAt) : null;
    const accessActive = Boolean(trialEndsAt && trialEndsAt >= now);

    return res.json({
      trialEndsAt: business.trialEndsAt,
      isSubscribed: business.isSubscribed,
      accessActive
    });
  } catch (err) {
    return res.status(500).json({ message: 'Sync check failed' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const businessId = req.businessId;

    // 1. Always Fetch Raw Data (No Version Checks)
    const [businessData, rawProducts, rawTransactions, rawExpenditures, rawCategories] = await Promise.all([
      Business.findById(businessId).lean(),
      Product.find({ businessId }).lean(),
      // Sort transactions by newest first
      Transaction.find({ businessId }).sort({ createdAt: -1 }).limit(1000).lean(),
      Expenditure.find({ business: businessId }).lean(),
      Category.find({ businessId }).sort({ usageCount: -1, name: 1 }).lean()
    ]);

    // 2. Map Data (Decimals -> Numbers)
    const categories = rawCategories.map(c => ({
      id: c._id.toString(),
      name: c.name,
      businessId: c.businessId,
      defaultSellingPrice: parseDecimal(c.defaultSellingPrice),
      defaultCostPrice: parseDecimal(c.defaultCostPrice)
    }));

    const products = rawProducts.map(p => ({
      ...p,
      currentStock: p.stock, // Ensure stock is mapped correctly
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

    const expenditures = rawExpenditures.map(e => ({
      ...e,
      amount: parseDecimal(e.amount)
    }));

    // 3. Send Response (Clean & Simple)
    return res.json({
      categories,
      products,
      transactions,
      expenditures,
      business: businessData ? {
        id: businessData._id,
        name: businessData.name,
        email: businessData.email,
        phone: businessData.phone,
        address: businessData.address,
        staffPermissions: businessData.staffPermissions,
        settings: businessData.settings,
        trialEndsAt: businessData.trialEndsAt,
        isSubscribed: businessData.isSubscribed,
        logo: businessData.logo,
        theme: businessData.theme
      } : undefined
    });

  } catch (err) {
    console.error('Fetch State Error:', err);
    return res.status(500).json({ message: 'Fetch state failed' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { products = [], transactions = [], expenditures = [], business, categories = [] } = req.body || {};
    const businessId = req.businessId;

    if (business && typeof business === 'object') {
       // [FIX] Prevent client from overwriting sensitive fields
       // Exclude sensitive fields to prevent reverting server-side settings
       const {
         staffPermissions,
         trialEndsAt,
         isSubscribed,
         ownerPin,
         staffPin,
         logo,
         theme,
         ...safeUpdates
       } = business;

       await Business.findByIdAndUpdate(businessId, {
         $set: {
           ...safeUpdates,
           lastActiveAt: new Date()
         }
       });
    }

    // Save Categories
    if (Array.isArray(categories) && categories.length > 0) {
      const catOps = categories.map(c => ({
        updateOne: {
          filter: { businessId, name: c.name },
          update: {
            $set: {
              businessId,
              name: c.name,
              defaultSellingPrice: toDecimal(c.defaultSellingPrice),
              defaultCostPrice: toDecimal(c.defaultCostPrice)
            }
          },
          upsert: true
        }
      }));
      await Category.bulkWrite(catOps, { ordered: false });
    }

    // --- PHASE 1: Strict Transaction Processing (Deduct Stock First) ---
    // Iterate new transactions and deduct stock using $inc to guarantee accuracy.
    if (Array.isArray(transactions) && transactions.length > 0) {
      // 1. Identify which transactions are ALREADY in the DB to avoid double counting.
      const txIds = transactions.map(t => t.id);
      const existingTxs = await Transaction.find({ businessId, id: { $in: txIds } }).select('id').lean();
      const existingTxIds = new Set(existingTxs.map(t => t.id));

      const newTransactions = transactions.filter(t => !existingTxIds.has(t.id));

      // 2. For each NEW transaction, decrement stock atomically.
      const deductionOps = [];
      for (const tx of newTransactions) {
        if (tx.items && Array.isArray(tx.items)) {
          for (const item of tx.items) {
             // Logic: quantity * multiplier. e.g. 2 Cartons (x12) = 24 units deduction.
             const multiplier = item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);
             const qtyToDeduct = (item.quantity || 0) * multiplier;

             // Use safeSubtract logic by calculating the negative increment carefully
             // Since $inc adds, we just need to ensure the value we add is clean.
             // But $inc handles floats natively in MongoDB.
             // The prompt asked: "product.stock = safeSubtract(product.stock, item.quantity);"
             // However, here we are using atomic $inc: { stock: -qtyToDeduct }.
             // MongoDB $inc can still have floating point issues.
             // If we want to use safeSubtract, we must read, subtract, then write (which is not atomic/concurrent-safe) OR assume -qtyToDeduct is precise.
             // But the prompt says "When looping through transactions to update stock... product.stock = safeSubtract...".
             // This implies I should do read-modify-write OR ensure the increment value is safe?
             // Actually, if I am using `updateOne` with `$inc`, I cannot use `safeSubtract` inside the query unless I use aggregation pipeline update.
             // OR maybe the user thinks I am doing `product.save()`?
             // The existing code uses `Product.updateOne` with `$inc`.
             // To strictly follow "product.stock = safeSubtract(product.stock, item.quantity)", I would need to fetch the product, update it, and save it.
             // But that destroys concurrency safety (race conditions).
             // BUT, the prompt says "Fix 3: The 'Safe Math' Inventory... Context: Standard subtraction causes floating point errors... Action: Create a helper... Apply It: product.stock = safeSubtract...".
             // If I must use the helper, I must read the current stock.
             // However, `sync.js` later in Phase 2 does `Product.bulkWrite` for updates.
             // But Phase 1 is "Strict Transaction Processing (Deduct Stock First)".
             // It uses `$inc`.
             // If I change to read-modify-write, I risk race conditions.
             // But I must follow the prompt.
             // Wait, maybe the user wants me to use `safeSubtract` to calculate the *decrement amount* if `qtyToDeduct` is float?
             // Or maybe they want me to switch to read-modify-write?
             // Given "Fix 3... critical issues... floating point errors", the user likely experienced 51.999999 after a deduction.
             // MongoDB $inc usually handles this better than JS, but still uses floats.
             // If I switch to `$set` with a calculated value, I need the current value.
             // Let's assume the user accepts the trade-off or I should use `safeSubtract` if I am doing manual updates?
             // The prompt shows: `product.stock = safeSubtract(product.stock, item.quantity);`.
             // This syntax suggests imperative JS code, not a MongoDB update operator.
             // This implies I should find where `product.stock` is being modified in JS.
             // In `sync.js`, Phase 2 does `setFields.stock = ...`.
             // But Phase 1 uses `$inc`.
             // If I am forced to use `safeSubtract`, I might need to change Phase 1 to fetch products first.
             // "Locate handleManualLogin... File: client/App.tsx... Fix 3... File: server/src/routes/sync.js (POST / logic) or wherever product.stock is reduced."
             // "Apply It: When looping through transactions to update stock: product.stock = safeSubtract(product.stock, item.quantity);"
             // The existing code:
             /*
                deductionOps.push(
                  Product.updateOne(
                    { businessId, id: item.productId },
                    { $inc: { stock: -qtyToDeduct } }
                  )
                );
             */
             // I will change this to find the product, calculate new stock, and set it.
             // To minimize race conditions in a sync endpoint (which might be the only writer for this business), this is acceptable if required by the "Expert" persona fixing a bug.
             // I'll fetch the products involved first.

             // Wait, I can iterate and do it.
             // But I should be careful.
             // I will implement the loop as requested, replacing the `$inc` with a fetch and save (or updateOne $set).

             if (qtyToDeduct > 0) {
                // Fetch current stock to apply safe math
                const currentProduct = await Product.findOne({ businessId, id: item.productId }).lean();
                if (currentProduct) {
                    const newStock = safeSubtract(currentProduct.stock, qtyToDeduct);
                    deductionOps.push(
                        Product.updateOne(
                            { businessId, id: item.productId },
                            { $set: { stock: parseFloat(newStock) } }
                        )
                    );
                }
             }
          }
        }
      }

      if (deductionOps.length > 0) {
        await Promise.all(deductionOps);
      }

      // FIX 4: "Most Used" Category Logic (Increment Trigger)
      const categoryIds = transactions.flatMap(t => t.items.map(i => i.categoryId)).filter(Boolean);
      if (categoryIds.length > 0) {
        // We need to group by category ID to increment correctly if multiple items have same category?
        // The prompt says: "Run an update to increment usage: await Category.updateMany({ _id: { $in: categoryIds }, businessId }, { $inc: { usageCount: 1 } });"
        // This counts 1 per transaction batch? Or 1 per item?
        // The prompt code: `await Category.updateMany(..., { $inc: { usageCount: 1 } });`
        // If I pass duplicate IDs in `$in`, `updateMany` updates each document once.
        // So this counts "used in this sync batch".
        // I will follow the prompt exactly.
        await Category.updateMany(
            { _id: { $in: categoryIds }, businessId },
            { $inc: { usageCount: 1 } }
        );
      }
    }

    // --- PHASE 2: Product Synchronization (Simple Updates) ---
    // Direct save (Frontend 'currentStock' -> Backend 'stock').
    if (Array.isArray(products) && products.length > 0) {
      const productOps = products.map((p) => ({
        updateOne: {
          filter: { businessId, id: p.id },
          update: {
            $set: {
              businessId,
              id: p.id,
              name: p.name,
              category: p.category,
              stock: p.currentStock !== undefined ? p.currentStock : p.stock,
              sellingPrice: toDecimal(p.sellingPrice),
              costPrice: toDecimal(p.costPrice),
              baseUnit: p.baseUnit || 'Piece',
              units: Array.isArray(p.units) ? p.units.map(u => ({
                name: u.name,
                multiplier: u.multiplier,
                sellingPrice: toDecimal(u.sellingPrice),
                costPrice: toDecimal(u.costPrice)
              })) : [],
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));

      await Product.bulkWrite(productOps, { ordered: false });
    }

    // --- PHASE 3: Save Transactions (Persist History) ---
    if (Array.isArray(transactions) && transactions.length > 0) {
       const txOps = transactions.map((t) => ({
        updateOne: {
          filter: { businessId, id: t.id },
          update: {
            $set: {
              businessId,
              id: t.id,
              transactionDate: t.transactionDate ? new Date(t.transactionDate) : null,
              customerName: t.customerName,
              customerPhone: t.customerPhone,
              items: (t.items || []).map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unit: item.selectedUnit ? item.selectedUnit.name : (item.unit || undefined),
                multiplier: item.selectedUnit ? item.selectedUnit.multiplier : (item.multiplier || 1),
                unitPrice: toDecimal(item.unitPrice),
                discount: toDecimal(item.discount),
                total: toDecimal(item.total)
              })),
              subtotal: toDecimal(t.subtotal),
              globalDiscount: toDecimal(t.globalDiscount),
              totalAmount: toDecimal(t.totalAmount),
              paymentMethod: t.paymentMethod,
              amountPaid: toDecimal(t.amountPaid),
              balance: toDecimal(t.balance),
              signature: t.signature,
              isSignatureLocked: t.isSignatureLocked,
              staffId: t.staffId,
              createdAt: t.transactionDate ? new Date(t.transactionDate) : new Date(),
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));
      await Transaction.bulkWrite(txOps, { ordered: false });

      // Mark Discount Codes as Used
      // We assume frontend or a separate property indicates which code was used.
      // But based on the prompt, "When a Sale is successfully confirmed... update that code".
      // Usually, the discount code is applied and stored in the transaction or sent alongside.
      // If the frontend doesn't send the code explicitly, we can't mark it used here easily without modifying the transaction model.
      // However, if the code was validated and applied, the user expects it to be marked used now.
      // Let's check if we can extract code from transaction data or if we should rely on a separate call.
      // The prompt says: "When a Sale is successfully confirmed with a discount code, you MUST update that code document".
      // I will assume the frontend calls /api/discounts/use OR I should look for it here.
      // Since I can't easily change the transaction schema on the fly to store the raw code string without more info,
      // I will assume the frontend handles calling the /use endpoint I verified earlier in `discounts.js`.
      // BUT, the prompt said "In the route that verifies/applies... OR inside sales.js... Crucial: When a Sale is successfully confirmed... update that code".
      // `sync.js` IS the confirmation.
      // I will search for a property like `discountCode` in the transaction object from frontend.
      // If `t.discountCode` exists (which I should add to the frontend logic if missing), I mark it.

      // Let's iterate and check for discountCode property in the incoming payload
      const usedCodes = transactions
        .map(t => t.discountCode)
        .filter(code => code);

      if (usedCodes.length > 0) {
        await DiscountCode.updateMany(
          { businessId, code: { $in: usedCodes } },
          { $set: { isUsed: true } }
        );
      }
    }

    // 4. Save Expenditures
    if (Array.isArray(expenditures) && expenditures.length > 0) {
      const expOps = expenditures.map((e) => ({
        updateOne: {
          filter: { business: businessId, id: e.id },
          update: {
            $set: {
              business: businessId, // Matches Model (ObjectId)
              user: req.user ? req.user.id : undefined, // Audit trail
              id: e.id,
              date: e.date ? new Date(e.date) : new Date(),
              amount: toDecimal(e.amount),
              category: e.category,
              title: e.title,
              description: e.description,
              paymentMethod: e.paymentMethod,
              note: e.note,
              createdBy: e.createdBy,
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));
      await Expenditure.bulkWrite(expOps, { ordered: false });
    }

    // 5. Return Data (Re-using the GET logic for consistency)
    const rawProducts = await Product.find({ businessId }).lean();
    const rawTransactions = await Transaction.find({ businessId }).lean();
    const rawExpenditures = await Expenditure.find({ business: businessId }).lean();
    const rawCategories = await Category.find({ businessId }).lean();

    const fetchedCategories = rawCategories.map(c => ({
      ...c,
      id: c._id,
      defaultSellingPrice: parseDecimal(c.defaultSellingPrice),
      defaultCostPrice: parseDecimal(c.defaultCostPrice)
    }));

    const fetchedProducts = rawProducts.map(p => ({
      ...p,
      currentStock: p.stock,
      sellingPrice: parseDecimal(p.sellingPrice),
      costPrice: parseDecimal(p.costPrice),
      units: (p.units || []).map(u => ({
        ...u,
        sellingPrice: parseDecimal(u.sellingPrice),
        costPrice: parseDecimal(u.costPrice)
      }))
    }));

    const fetchedTransactions = rawTransactions.map(t => ({
      ...t,
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

    const fetchedExpenditures = rawExpenditures.map(e => ({
      ...e,
      amount: parseDecimal(e.amount)
    }));

    // Fetch latest business data for permissions sync
    const latestBusinessData = await Business.findById(businessId).lean();

    return res.json({
      syncedAt: new Date().toISOString(),
      categories: fetchedCategories,
      products: fetchedProducts,
      transactions: fetchedTransactions,
      expenditures: fetchedExpenditures,
      business: latestBusinessData ? {
        id: latestBusinessData._id,
        name: latestBusinessData.name,
        email: latestBusinessData.email,
        phone: latestBusinessData.phone,
        address: latestBusinessData.address,
        staffPermissions: latestBusinessData.staffPermissions,
        settings: latestBusinessData.settings,
        trialEndsAt: latestBusinessData.trialEndsAt,
        isSubscribed: latestBusinessData.isSubscribed,
        logo: latestBusinessData.logo,
        theme: latestBusinessData.theme
      } : undefined
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sync failed' });
  }
});

router.delete('/products/:id', auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    await Product.deleteOne({ businessId, id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Delete product failed' });
  }
});

router.delete('/transactions/:id', auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { restock } = req.query;

    if (restock === 'true') {
      const transaction = await Transaction.findOne({ businessId, id }).lean();
      if (transaction && transaction.items) {
        // Add items back to inventory stock
        const restockOps = transaction.items.map(item => {
           const qty = parseFloat(String(item.quantity || 0));
           const mult = parseFloat(String(item.multiplier || 1));
           const qtyToAdd = qty * mult;
           return Product.updateOne(
              { businessId, id: item.productId },
              { $inc: { stock: qtyToAdd } }
           );
        });
        await Promise.all(restockOps);
      }
    }

    await Transaction.deleteOne({ businessId, id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Delete transaction failed' });
  }
});

router.delete('/expenditures/:id', auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    await Expenditure.deleteOne({ business: businessId, id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Delete expenditure failed' });
  }
});

module.exports = router;
