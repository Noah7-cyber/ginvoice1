const fs = require('fs');
const file = 'client/components/SettingsScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// Network Settings Wrapper
content = content.replace(
    /<!-- Strict Online Mode Toggle -->\n                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">/g,
    '<!-- Strict Online Mode Toggle -->\n                  <GuideWrapper id="network-settings" className="w-full" isGuideMode={isGuideMode} activeHotspotId={activeHotspotId} onHotspotClick={onHotspotClick}>\n                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">'
);

content = content.replace(
    /className={`transition-colors \$\{formData\.settings\?\.onlineOnlyMode \? 'text-primary' : 'text-gray-300'\}`\}\n                          >\n                              \{formData\.settings\?\.onlineOnlyMode \? <ToggleRight size=\{32\} \/> : <ToggleLeft size=\{32\} \/>\}\n                          <\/button>\n                      <\/div>\n                  <\/div>\n/g,
    'className={`transition-colors ${formData.settings?.onlineOnlyMode ? \'text-primary\' : \'text-gray-300\'}`}\n                          >\n                              {formData.settings?.onlineOnlyMode ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}\n                          </button>\n                      </div>\n                  </div>\n                  </GuideWrapper>\n'
);

// Discount Codes Wrapper
content = content.replace(
    /<\!-- Discount Codes -->\n                    <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-4">/g,
    '<!-- Discount Codes -->\n                    <GuideWrapper id="discount-codes" className="w-full" isGuideMode={isGuideMode} activeHotspotId={activeHotspotId} onHotspotClick={onHotspotClick}>\n                    <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-4">'
);

content = content.replace(
    /<\/button>\n                        <\/div>\n                        <p className="text-sm text-gray-500">Manage promo codes for your customers\.<\/p>\n                    <\/div>/g,
    '</button>\n                        </div>\n                        <p className="text-sm text-gray-500">Manage promo codes for your customers.</p>\n                    </div>\n                    </GuideWrapper>'
);


fs.writeFileSync(file, content);
console.log('Successfully updated SettingsScreen.tsx');
