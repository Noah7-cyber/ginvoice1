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

    // --- LEGACY CLIENT FALLBACK (No Version sent) ---
    if (!req.query.version) {
      // 1. Fetch raw data
      const businessData = await Business.findById(businessId).lean();
      const rawProducts = await Product.find({ businessId }).lean();
      const rawTransactions = await Transaction.find({ businessId }).lean();
      const rawExpenditures = await Expenditure.find({ business: businessId }).lean();
      const rawCategories = await Category.find({ businessId }).sort({ createdAt: 1 }).lean();

      // 2. Map backend data to frontend-friendly formats (Numbers instead of Decimals)
      const categories = rawCategories.map(c => ({
        id: c._id.toString(),
        name: c.name,
        businessId: c.businessId,
        defaultSellingPrice: c.defaultSellingPrice ? parseDecimal(c.defaultSellingPrice) : 0,
        defaultCostPrice: c.defaultCostPrice ? parseDecimal(c.defaultCostPrice) : 0
      }));

      const products = rawProducts.map(p => ({
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
    }

    // --- NEW HYBRID DELTA LOGIC (Version sent) ---
    const clientVersion = parseInt(req.query.version || '0');
    const lastSyncDate = req.query.lastSync ? new Date(req.query.lastSync) : new Date(0);

    // 1. Fetch Business Version
    const businessData = await Business.findById(businessId).lean();
    if (!businessData) return res.status(404).json({ message: 'Business not found' });

    const serverVersion = businessData.dataVersion || 0;

    // Traffic Light: If versions match, no content needed
    if (clientVersion === serverVersion) {
      return res.status(204).send();
    }

    // 2. Fetch Deltas (Changed Items)
    // Products
    const rawProducts = await Product.find({
      businessId,
      updatedAt: { $gt: lastSyncDate }
    }).lean();

    // Transactions (use createdAt or updatedAt if available, schema has timestamps now)
    const rawTransactions = await Transaction.find({
      businessId,
      updatedAt: { $gt: lastSyncDate }
    }).lean();

    // Categories
    const rawCategories = await Category.find({
      businessId,
      updatedAt: { $gt: lastSyncDate }
    }).lean();

    // Expenditures
    const rawExpenditures = await Expenditure.find({
      business: businessId,
      updatedAt: { $gt: lastSyncDate }
    }).lean();

    // 3. Fetch IDs for Hard Deletes
    const productIds = (await Product.find({ businessId }).select('id').lean()).map(p => p.id);
    const transactionIds = (await Transaction.find({ businessId }).select('id').lean()).map(t => t.id);
    // Category uses _id mapped to id
    const categoryIds = (await Category.find({ businessId }).select('_id').lean()).map(c => c._id.toString());
    const expenditureIds = (await Expenditure.find({ business: businessId }).select('id').lean()).map(e => e.id);

    // 4. Map to Frontend format (Decimals -> Numbers)
    const products = rawProducts.map(p => ({
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

    const categories = rawCategories.map(c => ({
      id: c._id.toString(),
      name: c.name,
      businessId: c.businessId,
      defaultSellingPrice: c.defaultSellingPrice ? parseDecimal(c.defaultSellingPrice) : 0,
      defaultCostPrice: c.defaultCostPrice ? parseDecimal(c.defaultCostPrice) : 0
    }));

    const expenditures = rawExpenditures.map(e => ({
      ...e,
      amount: parseDecimal(e.amount)
    }));

    return res.json({
      version: serverVersion,
      serverTime: new Date(),
      changes: {
        products,
        transactions,
        categories,
        expenditures
      },
      ids: {
        products: productIds,
        transactions: transactionIds,
        categories: categoryIds,
        expenditures: expenditureIds
      },
      business: {
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
      }
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
         },
         $inc: { dataVersion: 1 }
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
      // Trigger version increment if categories changed
      await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });
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

             if (qtyToDeduct > 0) {
                deductionOps.push(
                  Product.updateOne(
                    { businessId, id: item.productId },
                    { $inc: { stock: -qtyToDeduct } }
                  )
                );
             }
          }
        }
      }

      if (deductionOps.length > 0) {
        await Promise.all(deductionOps);
      }
    }

    // --- PHASE 2: Product Synchronization (Smart Updates) ---
    // Apply product updates. Only overwrite 'stock' if it's a manual update.
    if (Array.isArray(products) && products.length > 0) {
      const productOps = products.map((p) => {
        // Base update fields (Always update details like name, price, etc.)
        const setFields = {
          businessId,
          id: p.id,
          name: p.name,
          category: p.category,
          baseUnit: p.baseUnit || 'Piece',
          sellingPrice: toDecimal(p.sellingPrice),
          costPrice: toDecimal(p.costPrice),
          units: Array.isArray(p.units) ? p.units.map(u => ({
            name: u.name,
            multiplier: u.multiplier,
            sellingPrice: toDecimal(u.sellingPrice),
            costPrice: toDecimal(u.costPrice)
          })) : [],
          updatedAt: new Date()
        };

        const setOnInsertFields = {};

        // CONDITIONAL STOCK UPDATE (Manual Override Fix):
        // If 'isManualUpdate' is true, we force the 'stock' field to update.
        // Otherwise, we only set 'stock' on insert (new product) to avoid overwriting
        // the server-side calculated stock (which may have been decremented by transactions).
        if (p.isManualUpdate) {
          // Manual override: Force update stock
          setFields.stock = p.currentStock !== undefined ? p.currentStock : p.stock;
        } else {
          // Not manual: Only set stock if we are INSERTING a new document
          setOnInsertFields.stock = p.currentStock !== undefined ? p.currentStock : 0;
        }

        const updateOp = {
          $set: setFields
        };

        if (Object.keys(setOnInsertFields).length > 0) {
          updateOp.$setOnInsert = setOnInsertFields;
        }

        return {
          updateOne: {
            filter: { businessId, id: p.id },
            update: updateOp,
            upsert: true
          }
        };
      });

      await Product.bulkWrite(productOps, { ordered: false });
      // Trigger version increment if products changed
      await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });
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
              createdAt: t.transactionDate ? new Date(t.transactionDate) : new Date()
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
      // Trigger version increment if transactions changed
      await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });
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
              createdBy: e.createdBy
            }
          },
          upsert: true
        }
      }));
      await Expenditure.bulkWrite(expOps, { ordered: false });
      // Trigger version increment if expenditures changed
      await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });
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
    await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });
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
    await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });
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
    await Business.findByIdAndUpdate(businessId, { $inc: { dataVersion: 1 } });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Delete expenditure failed' });
  }
});

module.exports = router;
