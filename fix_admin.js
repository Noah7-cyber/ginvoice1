const fs = require('fs');
const filepath = 'server/src/routes/admin.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/const ProductShopStock = require\('\.\.\/models\/ProductShopStock'\);\n/g, '');
content = content.replace(/ProductShopStock\.deleteMany\(\{ shopId: \{ \$in: inactiveShopIds \} \}\),\n/g, '');

fs.writeFileSync(filepath, content, 'utf8');
