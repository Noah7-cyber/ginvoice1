const fs = require('fs');

// Fix syntax error in auth.js
const authPath = 'server/src/routes/auth.js';
let authContent = fs.readFileSync(authPath, 'utf8');

// The issue was: "return res.json({\nshops: ..."
// was outside a function because of the regex replacement that stripped the router.get.
// Actually, looking at the code, it seems the previous removal didn't remove the rest of the function body.
const getPinsPattern = /const shops = await getActiveShops\(req\.businessId\);[\s\S]*?\}\);\n/g;
authContent = authContent.replace(getPinsPattern, '');

fs.writeFileSync(authPath, authContent, 'utf8');
