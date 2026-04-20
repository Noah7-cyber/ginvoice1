const fs = require('fs');

// We have tests referencing ProductShopStock and shopId. We should mock or rewrite them to just use Product and stock.
// Since we are asked to completely remove multi-shop logic, we should probably just remove the old test files if they are heavily shop-dependent,
// but let's try to update the transactions and sync tests to use Product stock instead.

function replaceInFile(filepath, replacements) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    for (const [pattern, replacement] of replacements) {
        content = content.replace(new RegExp(pattern, 'g'), replacement);
    }
    fs.writeFileSync(filepath, content, 'utf8');
}

replaceInFile('server/src/services/aiTools.js', [
    [/const lowRows = await ProductShopStock\.find\(stockCriteria\)\.sort\(\{ onHand: 1 \}\)\.limit\(20\)\.lean\(\);/, 'const lowRows = await Product.find({ businessId: businessKey, stock: { $lte: 10 } }).sort({ stock: 1 }).limit(20).lean();']
]);

// Let's remove the test files that are heavily testing old logic since requirements are to simplify.
