const fs = require('fs');
const file = 'client/components/ExpenditureScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// Categories Wrapper
content = content.replace(
    /<button\s+onClick=\{\(\) => setShowCategories\(true\)\}\s+className="guide-hotspot flex-1 md:flex-none/g,
    '<GuideWrapper id="categories" className="flex-1 md:flex-none" isGuideMode={isGuideMode} activeHotspotId={activeHotspotId} onHotspotClick={onHotspotClick}>\n                <button\n                    onClick={() => setShowCategories(true)}\n                    className="guide-hotspot w-full flex'
);

content = content.replace(
    /<span className="hidden md:inline">Categories<\/span>\n                <\/button>\n                <GuideWrapper id="add-expense"/g,
    '<span className="hidden md:inline">Categories</span>\n                </button>\n                </GuideWrapper>\n                <GuideWrapper id="add-expense"'
);

// Search & Filter Wrapper
content = content.replace(
    /<div className="flex flex-col md:flex-row gap-2">/g,
    '<GuideWrapper id="search-filter" className="w-full" isGuideMode={isGuideMode} activeHotspotId={activeHotspotId} onHotspotClick={onHotspotClick} dotPosition="top-1/2 right-0 -translate-y-1/2 -mr-2">\n          <div className="flex flex-col md:flex-row gap-2">'
);

content = content.replace(
    /onChange=\{\(e\) => setSearchTerm\(e\.target\.value\)\}\n                \/>\n              <\/div>\n            <\/div>\n          <\/div>/g,
    'onChange={(e) => setSearchTerm(e.target.value)}\n                />\n              </div>\n            </div>\n          </div>\n          </GuideWrapper>'
);


fs.writeFileSync(file, content);
console.log('Successfully updated ExpenditureScreen.tsx');
