const fs = require('fs');
const filepath = 'server/src/routes/expenditures.js';
let content = fs.readFileSync(filepath, 'utf8');

// Remove Context imports
content = content.replace(/const \{ ensureWritableShopContext, resolveShopId, isAllShopsMode \} = require\('\.\.\/services\/shopContext'\);\n/g, '');

// GET route filtering
content = content.replace(/const defaultShopId = await resolveShopId\(\{ businessId: req\.businessId, requestedShopId: req\.query\.shopId \}\);\n/g, '');
content = content.replace(/const requestedShopId = req\.assignedShopId \|\| \(req\.query\.shopId \? String\(req\.query\.shopId\) : defaultShopId\);\n/g, '');
content = content.replace(/const allShopsMode = req\.assignedShopId \? false : isAllShopsMode\(req\.query\.allShops\);\n/g, '');
content = content.replace(/\.\.\.\(allShopsMode \? \{\} : \{ shopId: requestedShopId \}\)/g, '');

// POST route creation
content = content.replace(/const \{ title, amount, category, date, description, paymentMethod, id, expenseType, flowType, shopId: requestedShopId, allShops \} = req\.body;/g, 'const { title, amount, category, date, description, paymentMethod, id, expenseType, flowType } = req.body;');
content = content.replace(/const shopId = await ensureWritableShopContext\(\{ businessId, requestedShopId, allShops, enforcedShopId: req\.assignedShopId \}\);\n/g, '');
content = content.replace(/shopId,\n/g, '');

// PUT route
content = content.replace(/const \{ title, amount, category, date, description, paymentMethod, expenseType, flowType, shopId: requestedShopId, allShops \} = req\.body;/g, 'const { title, amount, category, date, description, paymentMethod, expenseType, flowType } = req.body;');
content = content.replace(/const shopId = await ensureWritableShopContext\(\{ businessId, requestedShopId: requestedShopId \|\| expenditure\.shopId, allShops, enforcedShopId: req\.assignedShopId \}\);\n/g, '');
content = content.replace(/expenditure\.shopId = shopId;\n/g, '');


fs.writeFileSync(filepath, content, 'utf8');
