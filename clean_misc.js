const fs = require('fs');

function removeMatches(filepath, regexps) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    for (const re of regexps) {
        content = content.replace(re, '');
    }
    fs.writeFileSync(filepath, content, 'utf8');
}

// Transaction
removeMatches('server/src/models/Transaction.js', [/shopId: \{ type: String, default: null, index: true \},\n/g]);

// Business
removeMatches('server/src/models/Business.js', [/shopId: \{ type: String, required: true \},\n/g]);

// StockVerificationEvent
removeMatches('server/src/models/StockVerificationEvent.js', [/shopId: \{ type: String, default: null, index: true \},\n/g]);

// Notification
removeMatches('server/src/models/Notification.js', [/shopId: \{ type: String, default: null, index: true \},\n/g]);

// Expenditure
removeMatches('server/src/models/Expenditure.js', [/shopId: \{ type: String, default: null, index: true \},\n/g]);

// Admin
removeMatches('server/src/routes/admin.js', [
  /Transaction\.deleteMany\(\{ shopId: \{ \$in: inactiveShopIds \} \}\),\n/g,
  /Expenditure\.deleteMany\(\{ shopId: \{ \$in: inactiveShopIds \} \}\),\n/g,
  /Notification\.deleteMany\(\{ shopId: \{ \$in: inactiveShopIds \} \}\)\n/g,
  /\{ \$pull: \{ shopStaffPins: \{ shopId: \{ \$in: inactiveShopIds \} \} \} \}\n/g
]);

// Auth remaining garbage
removeMatches('server/src/routes/auth.js', [
  /const shopId = String\(req\.params\.shopId || ''\)\.trim\(\);\n/g,
  /if \(!shopId\) return res\.status\(400\)\.json\(\{ message: 'Shop ID required' \}\);\n/g,
  /const shop = await Shop\.findOne\(\{ _id: shopId, businessId: String\(req\.businessId\), status: 'active' \}\)\.lean\(\);\n/g,
  /const idx = rows\.findIndex\(\(row\) => String\(row\.shopId\) === String\(shopId\)\);\n/g,
  /shopId,\n/g
]);

// Transaction routes remaining bugs from previous regex
removeMatches('server/src/routes/transactions.js', [
  /if \(!originalTx\.shopId\) originalTx\.= shopId;\n/g,
  /originalTx\.= shopId;\n/g,
  /shopId\n/g
]);

// AITools
let aiToolsContent = fs.readFileSync('server/src/services/aiTools.js', 'utf8');
aiToolsContent = aiToolsContent.replace(/const applyShopFilter = \(criteria, context = \{\}, field = 'shopId'\) => \{[\s\S]*?return criteria;\n\};\n/g, '');
aiToolsContent = aiToolsContent.replace(/applyShopFilter\(\{ businessId: businessKey \}, \{ shopId, allShops \}\)/g, '{ businessId: businessKey }');
aiToolsContent = aiToolsContent.replace(/applyShopFilter\(\{ businessId \}, \{ shopId, allShops \}\)/g, '{ businessId }');
aiToolsContent = aiToolsContent.replace(/const requestedShopId = context\?\.shopId \? String\(context\.shopId\) : '';/g, '');
fs.writeFileSync('server/src/services/aiTools.js', aiToolsContent, 'utf8');
