const fs = require('fs');
const filepath = 'server/src/routes/transactions.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/const \{ ensureWritableShopContext \} = require\('\.\.\/services\/shopContext'\);\n/g, '');

content = content.replace(/const shopId = await ensureWritableShopContext\(\{.*\}\);\n/g, '');
content = content.replace(/shopId: requestedShopId, /g, '');
content = content.replace(/, shopId: requestedShopId/g, '');
content = content.replace(/allShops, /g, '');
content = content.replace(/, allShops/g, '');
content = content.replace(/shopId,\n/g, '');
content = content.replace(/shopId:.*,\n/g, '');
content = content.replace(/shopId /g, '');
content = content.replace(/shopId,/g, '');

content = content.replace(/if \(!originalTx\.shopId\) originalTx\.shopId = shopId;\n/g, '');
content = content.replace(/originalTx\.shopId = shopId;\n/g, '');

content = content.replace(/shopId: transaction\.shopId || defaultShopId/g, '');

fs.writeFileSync(filepath, content, 'utf8');
