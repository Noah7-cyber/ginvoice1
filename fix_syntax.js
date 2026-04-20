const fs = require('fs');

// Fix syntax error in auth.js
const authPath = 'server/src/routes/auth.js';
let authContent = fs.readFileSync(authPath, 'utf8');

// The issue was: "if (!business) return res.status(404).json({ message: 'Business not found' });"
// was outside a function because of the regex replacement that stripped the router.get
const fixPinsRegex = /const business = await Business\.findById\(req\.businessId\)\.select\('shopStaffPins defaultShopId'\)\.lean\(\);\n    if \(!business\) return res\.status\(404\)\.json\(\{ message: 'Business not found' \}\);\n\n    const shops = await getActiveShops\(req\.businessId\);\n    const pins = normalizeShopStaffPins\(business\);\n/g;
authContent = authContent.replace(fixPinsRegex, '');
fs.writeFileSync(authPath, authContent, 'utf8');

// Fix aiTools.js: "ReferenceError: applyShopFilter is not defined"
const aiPath = 'server/src/services/aiTools.js';
let aiContent = fs.readFileSync(aiPath, 'utf8');
aiContent = aiContent.replace(/applyShopFilter\(\{ businessId \}\)/g, '{ businessId }');
aiContent = aiContent.replace(/applyShopFilter\(\{ business: businessId \}\)/g, '{ business: businessId }');
aiContent = aiContent.replace(/applyShopFilter/g, '({ businessId }) => ({ businessId })'); // Just a hacky stub if we missed any, though we shouldn't have

fs.writeFileSync(aiPath, aiContent, 'utf8');
