const fs = require('fs');

const filepath = 'server/src/routes/analytics.js';
let content = fs.readFileSync(filepath, 'utf8');

// The first regex replacement failed to match because I used the wrong comment title.
const valuationPattern = /\/\/ 6\. Inventory Valuation \(Shop Cost & Shop Worth\)[\s\S]*?\/\/ 7\. Daily Stats/g;
const newValuation = `// 6. Inventory Valuation
      Product.aggregate([
        { $match: { businessId: String(req.businessId), isDeleted: { $ne: true } } },
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
