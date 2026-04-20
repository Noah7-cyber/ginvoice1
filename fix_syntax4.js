const fs = require('fs');

const authPath = 'server/src/routes/auth.js';
let authContent = fs.readFileSync(authPath, 'utf8');

const badChunk = /        const pinMap = new Map\(pins\.map\(\(row\) => \[String\(row\.shopId\), row\]\)\);\n\n    return res\.json\(\{\n      shops: shops\.map\(\(shop\) => \{\n        const row = pinMap\.get\(String\(shop\.id\)\);\n        return \{\n          shopId: shop\.id,\n          shopName: shop\.name,\n          isMain: shop\.isMain,\n          hasStaffPin: Boolean\(row\?\.staffPin\),\n          staffName: row\?\.staffName \|\| ''\n        \};\n      \}\),\n      defaultShopId: business\.defaultShopId \|\| shops\[0\]\?\.id \|\| null\n    \}\);\n  \} catch \(err\) \{\n    return res\.status\(500\)\.json\(\{ message: 'Failed to load shop PIN configurations' \}\);\n  \}\n\}\);\n/g;

// Instead of regex, I'll just substring out the remainder of what I replaced in the first place manually.
const lineStart = authContent.indexOf('const pinMap = new Map');
if (lineStart !== -1) {
    const nextRoute = authContent.indexOf('router.put(\'/staff-shop-pins', lineStart);
    if (nextRoute !== -1) {
        authContent = authContent.substring(0, lineStart) + authContent.substring(nextRoute);
        fs.writeFileSync(authPath, authContent, 'utf8');
    }
}
