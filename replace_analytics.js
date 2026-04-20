const fs = require('fs');

const filepath = 'server/src/routes/analytics.js';
let content = fs.readFileSync(filepath, 'utf8');

// Remove Shop and ProductShopStock imports
content = content.replace(/const Shop = require\('\.\.\/models\/Shop'\);\n/, '');
content = content.replace(/const ProductShopStock = require\('\.\.\/models\/ProductShopStock'\);\n/, '');

// Replace shop filtering logic with simple businessId
const routerGetPattern = /router\.get\('\/', auth, async \(req, res\) => \{\n  try \{\n    const businessId = new mongoose\.Types\.ObjectId\(req\.businessId\);\n    const range = req\.query\.range \|\| '7d'; \/\/ '7d', '30d', '1y'\n    const requestedShopId = req\.assignedShopId \|\| \(req\.query\.shopId \? String\(req\.query\.shopId\) : ''\);\n    const allShopsMode = req\.assignedShopId \? false : \(req\.query\.allShops === 'true'\);\n    const activeShops = allShopsMode\n      \? await Shop\.find\(\{ businessId: String\(req\.businessId\), status: 'active' \}\)\.select\('_id'\)\.lean\(\)\n      : \[\];\n    const activeShopIds = activeShops\.map\(\(s\) => String\(s\._id\)\);\n    const txShopFilter = allShopsMode\n      \? \{ \$or: \[\{ shopId: \{ \$in: activeShopIds \} \}, \{ shopId: \{ \$exists: false \} \}, \{ shopId: null \}\] \}\n      : \(requestedShopId \? \{ \$or: \[\{ shopId: requestedShopId \}, \{ shopId: \{ \$exists: false \} \}, \{ shopId: null \}\] \} : \{\}\);\n/g;

const newRouterGet = `router.get('/', auth, async (req, res) => {
  try {
    const businessId = new mongoose.Types.ObjectId(req.businessId);
    const range = req.query.range || '7d'; // '7d', '30d', '1y'
`;
content = content.replace(routerGetPattern, newRouterGet);

// Remove txShopFilter usage from all aggregates
content = content.replace(/\.\.\.txShopFilter, /g, '');
content = content.replace(/\.\.\.txShopFilter/g, '');

// Fix Inventory Valuation Aggregate
const valuationPattern = /\/\/ 6\. Inventory Valuation \+ Low Stock \(Multi-Shop\)[\s\S]*?\/\/ 7\. Daily Stats/g;
const newValuation = `// 6. Inventory Valuation
      Product.aggregate([
        { $match: { businessId: String(req.businessId) } },
        {
          $group: {
            _id: null,
            shopCost: {
              $sum: {
                $multiply: ['$stock', { $toDouble: '$costPrice' }]
              }
            },
            shopWorth: {
              $sum: {
                $multiply: ['$stock', { $toDouble: '$sellingPrice' }]
              }
            }
          }
        }
      ]),

      // 7. Daily Stats`;
content = content.replace(valuationPattern, newValuation);

fs.writeFileSync(filepath, content, 'utf8');
