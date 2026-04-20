const fs = require('fs');
const path = 'server/src/routes/admin.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/const Shop = require\('\.\.\/models\/Shop'\);\n/g, '');
content = content.replace(/const inactiveShops = await Shop\.find\(\{ businessId: \{ \$in: inactiveBusinessIds \} \}\)\.select\('_id'\)\.lean\(\);\n/g, '');
content = content.replace(/const inactiveShopIds = inactiveShops\.map\(\(s\) => String\(s\._id\)\);\n/g, '');
content = content.replace(/Shop\.deleteMany\(\{ businessId: \{ \$in: inactiveBusinessIds \} \}\),\n/g, '');

fs.writeFileSync(path, content, 'utf8');
