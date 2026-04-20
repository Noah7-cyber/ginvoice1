const fs = require('fs');
const filepath = 'server/src/services/aiTools.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/const ProductShopStock = require\('\.\.\/models\/ProductShopStock'\);\n/g, '');

const lowStockPattern = /const lowRows = await ProductShopStock\.find\(stockCriteria\)\.sort\(\{ onHand: 1 \}\)\.limit\(20\)\.lean\(\);\n[\s\S]*?const existingMap = new Map\(products\.map\(\(p\) => \[p\.id, p\.name\]\)\);/g;

const newLowStock = `const lowRows = await Product.find({ businessId: businessKey, stock: { $lte: 10 } }).sort({ stock: 1 }).limit(20).lean();
    if (!lowRows.length) {
      return "There are no products currently low on stock.";
    }

    const lines = lowRows.map(r => {
      const pName = r.name || r.id;
      return \`\${pName} (Stock: \${r.stock || 0})\`;
    });
`;
content = content.replace(lowStockPattern, newLowStock);

content = content.replace(/ProductShopStock\.find\(applyShopFilter\(\{ businessId: businessKey \}, \{ shopId, allShops \}\)\)\.lean\(\)/g, "Promise.resolve([])");

fs.writeFileSync(filepath, content, 'utf8');
