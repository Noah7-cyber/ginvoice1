const fs = require('fs');
const filepath = 'server/src/index.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/const shopsRouter = require\('\.\/routes\/shops'\);\n/g, '');
content = content.replace(/app\.use\('\/api\/shops', shopsRouter\);\n/g, '');

fs.writeFileSync(filepath, content, 'utf8');
