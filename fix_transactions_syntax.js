const fs = require('fs');
const path = 'server/src/routes/transactions.js';
let content = fs.readFileSync(path, 'utf8');

const badChunk = /    const = await ensureWritableShopContext\(\{[\s\S]*?\}\);\n/g;
content = content.replace(badChunk, '');

fs.writeFileSync(path, content, 'utf8');
