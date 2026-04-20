const fs = require('fs');

const authPath = 'server/src/routes/auth.js';
let authContent = fs.readFileSync(authPath, 'utf8');

const badChunk = /        const pinMap = new Map\(pins\.map\(\(row\) => \[String\(row\.shopId\), row\]\)\);\n\n    return res\.json\(\{\n      shops: shops\.map\(\(shop\) => \{\n        const row = pinMap\.get\(String\(shop\.id\)\);\n        return \{\n          shopId: shop\.id,\n          shopName: shop\.name,\n          isMain: shop\.isMain,\n          hasStaffPin: Boolean\(row\?\.staffPin\),\n          staffName: row\?\.staffName \|\| ''\n        \};\n      \}\),\n      defaultShopId: business\.defaultShopId \|\| shops\[0\]\?\.id \|\| null\n    \}\);\n  \} catch \(err\) \{\n    return res\.status\(500\)\.json\(\{ message: 'Failed to load shop PIN configurations' \}\);\n  \}\n\}\);\n/g;
authContent = authContent.replace(badChunk, '');

const badChunk2 = /    \};\n\n    if \(idx >= 0\) rows\[idx\] = payload;\n    else rows\.push\(payload\);\n\n    business\.shopStaffPins = rows;\n    \/\/ Force re-auth for staff users after pin changes\.\n    business\.credentialsVersion = \(business\.credentialsVersion \|\| 1\) \+ 1;\n    await business\.save\(\);\n\n    return res\.json\(\{\n      success: true,\n            shopName: shop\.name,\n      staffName: payload\.staffName\n    \}\);\n  \} catch \(err\) \{\n    return res\.status\(500\)\.json\(\{ message: 'Failed to update shop staff PIN' \}\);\n  \}\n\}\);\n/g;
authContent = authContent.replace(badChunk2, '');

fs.writeFileSync(authPath, authContent, 'utf8');
