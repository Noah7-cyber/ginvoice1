const fs = require('fs');
const path = 'server/src/routes/auth.js';
let content = fs.readFileSync(path, 'utf8');

// Instead of regex, manually splice the string
const idx1 = content.indexOf('    || \'\').trim();');
if (idx1 !== -1) {
    const idx2 = content.indexOf('router.delete(\'/delete-account\'');
    if (idx2 !== -1) {
        content = content.substring(0, idx1) + content.substring(idx2);
        fs.writeFileSync(path, content, 'utf8');
    }
}
