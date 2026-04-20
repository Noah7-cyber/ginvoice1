const fs = require('fs');
const filepath = 'server/src/routes/transactions.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/restoreStock\(\{ businessId: req\.businessId, productId: item\.productId, qty, session \}\)/g, 'restoreStock({ businessId: req.businessId, productId: item.productId, qty, session })');
content = content.replace(/decrementStock\(\{ businessId: req\.businessId, productId: item\.productId, qty, session \}\)/g, 'decrementStock({ businessId: req.businessId, productId: item.productId, qty, session })');

content = content.replace(/restoreStock\(\{ businessId: req\.businessId, productId: item\.productId, qty: item\.quantity \* multiplier \}\)/g, 'restoreStock({ businessId: req.businessId, productId: item.productId, qty: item.quantity * multiplier })');

content = content.replace(/shopId: transaction\.shopId,/g, '');

content = content.replace(/payload: \{ transactionId: transaction\.id,  \}/g, 'payload: { transactionId: transaction.id }');
content = content.replace(/payload: \{ transactionId: transaction\.id \}/g, 'payload: { transactionId: transaction.id }');

fs.writeFileSync(filepath, content, 'utf8');
