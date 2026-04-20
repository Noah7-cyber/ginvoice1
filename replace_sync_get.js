const fs = require('fs');

const filepath = 'server/src/routes/sync.js';
let content = fs.readFileSync(filepath, 'utf8');

// Remove redundant imports
content = content.replace(/const Shop = require\('\.\.\/models\/Shop'\);\n/, '');
content = content.replace(/const ProductShopStock = require\('\.\.\/models\/ProductShopStock'\);\n/, '');
content = content.replace(/const { resolveShopId, isAllShopsMode } = require\('\.\.\/services\/shopContext'\);\n/, '');

const startIdx = content.indexOf('// 1. GET Full State (Online-Only Mode) - EMERGENCY VERSION');
const endIdx = content.indexOf('// 2. POST Updates (Direct-Push Mode)');

if (startIdx !== -1 && endIdx !== -1) {
  const newGetRoute = `// 1. GET Full State (Online-Only Mode) - EMERGENCY VERSION
router.get('/', auth, async (req, res) => {
  try {
    const businessId = String(req.businessId).trim();
    console.log(\`[SYNC] 🚀 STARTING FETCH for Business ID: "\${businessId}"\`);

    const requestedDomains = parseDomainsParam(req.query.domains);
    const shouldInclude = (domain) => !requestedDomains || requestedDomains.has(domain);

    const productsPromise = shouldInclude('products')
      ? Product.find({ businessId: { $in: [businessId, new mongoose.Types.ObjectId(businessId)] } }).lean()
      : Promise.resolve([]);
    const transactionsPromise = shouldInclude('transactions')
      ? Transaction.find({ businessId: { $in: [businessId, new mongoose.Types.ObjectId(businessId)] } }).sort({ createdAt: -1 }).lean()
      : Promise.resolve([]);
    const expendituresPromise = shouldInclude('expenditures')
      ? Expenditure.find({ business: { $in: [businessId, new mongoose.Types.ObjectId(businessId)] } }).lean()
      : Promise.resolve([]);
    const categoriesPromise = shouldInclude('categories')
      ? Category.find({ businessId }).sort({ usageCount: -1, name: 1 }).lean()
      : Promise.resolve([]);
    const notificationsPromise = shouldInclude('notifications')
      ? Notification.find({ businessId, dismissedAt: null }).sort({ timestamp: -1 }).limit(50).lean()
      : Promise.resolve([]);

    const [rawProducts, rawTransactions, rawExpenditures, rawCategories, rawNotifications] = await Promise.all([
      productsPromise,
      transactionsPromise,
      expendituresPromise,
      categoriesPromise,
      notificationsPromise
    ]);

    // Map Decimals to Numbers
    const categories = rawCategories.map(c => ({
      id: c._id.toString(),
      name: c.name,
      businessId: c.businessId,
      defaultSellingPrice: parseDecimal(c.defaultSellingPrice),
      defaultCostPrice: parseDecimal(c.defaultCostPrice),
      defaultUnit: c.defaultUnit || ''
    }));

    const products = rawProducts.map(p => ({
      ...p,
      id: (p.id && p.id !== 'undefined' && p.id !== 'null') ? p.id : p._id.toString(),
      currentStock: p.stock !== undefined ? p.stock : 0, // Using stock field directly
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
      subtotal: parseDecimal(t.subtotal),
      globalDiscount: parseDecimal(t.globalDiscount),
      totalAmount: parseDecimal(t.totalAmount),
      amountPaid: parseDecimal(t.amountPaid),
      balance: parseDecimal(t.balance),
      items: (t.items || []).map(i => ({
        ...i,
        unitPrice: parseDecimal(i.unitPrice),
        discount: parseDecimal(i.discount),
        total: parseDecimal(i.total)
      }))
    }));

    const expenditures = rawExpenditures.map(e => ({
      ...e,
      amount: parseDecimal(e.amount)
    }));

    const notifications = rawNotifications;

    res.json({
      products,
      transactions,
      expenditures,
      categories,
      notifications,
      shops: [] // Removed multi-shop, returning empty for client compatibility
    });
  } catch (err) {
    console.error('Fetch failed:', err);
    res.status(500).json({ message: 'Sync failed' });
  }
});\n\n`;
  content = content.substring(0, startIdx) + newGetRoute + content.substring(endIdx);
  fs.writeFileSync(filepath, content, 'utf8');
} else {
  console.log("Could not find start or end index.");
}
