const fs = require('fs');
const filepath = 'server/src/routes/audit.js';
let content = fs.readFileSync(filepath, 'utf8');

// Remove Context imports
content = content.replace(/const \{ resolveShopId \} = require\('\.\.\/services\/shopContext'\);\n/g, '');

content = content.replace(/, shopId: requestedShopId /g, ' ');
content = content.replace(/const shopId = await resolveShopId\(\{ businessId: req\.businessId, requestedShopId \}\);\n/g, '');

// Update getOnHand and setCountedQuantity to only take businessId and productId
content = content.replace(/getOnHand\(\{ businessId: req\.businessId, shopId, productId \}\)/g, 'getOnHand({ businessId: req.businessId, productId })');
content = content.replace(/setCountedQuantity\(\{ businessId: req\.businessId, shopId, productId, countedQty: numericCounted \}\)/g, 'setCountedQuantity({ businessId: req.businessId, productId, countedQty: numericCounted })');

// Remove shopId from event payload
content = content.replace(/shopId,\n/g, '');

fs.writeFileSync(filepath, content, 'utf8');
