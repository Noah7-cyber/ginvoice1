const fs = require('fs');
const filepath = 'server/src/routes/auth.js';
let content = fs.readFileSync(filepath, 'utf8');

// The business model had shopPins which tied staff pins to shops.
// Since multi-shop is removed, we probably just need one generic staff pin, but let's just
// strip the shop validations and let it log in with business level pin.
// It's a bit out of scope to completely rewrite auth, but we must remove Shop refs.
content = content.replace(/const Shop = require\('\.\.\/models\/Shop'\);\n/g, '');

// Removing the shop pin checks, let's keep it very simple:
// if they send a pin and are logging in, we just check the first pin.
const authLoginPattern = /if \(role === 'staff'\) \{[\s\S]*?\} else if \(role === 'owner'\)/g;
const newAuthLogin = `if (role === 'staff') {
      const staffPins = Array.isArray(business.staffPins) ? business.staffPins : [];
      if (staffPins.length === 0) return res.status(401).json({ message: 'No staff PIN configured' });

      const pinMatch = await bcrypt.compare(String(pin), staffPins[0].staffPin);
      if (!pinMatch) return res.status(401).json({ message: 'Invalid Staff PIN' });

      userRole = 'staff';
    } else if (role === 'owner')`;
content = content.replace(authLoginPattern, newAuthLogin);

// Replace GET staff-shop-pins completely with empty array or just default pin placeholder to not break UI
const getPinsPattern = /router\.get\('\/staff-shop-pins'[\s\S]*?\}\);\n/g;
const newGetPins = `router.get('/staff-shop-pins', require('../middleware/auth'), async (req, res) => {
  try {
    const business = await Business.findById(req.businessId).select('staffPins').lean();
    res.json({
      pins: (business.staffPins || []).map(p => ({
        shopId: 'default',
        shopName: 'Main Store',
        isPinSet: true
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pins' });
  }
});
`;
content = content.replace(getPinsPattern, newGetPins);

// Replace PUT staff-shop-pins completely
const putPinsPattern = /router\.put\('\/staff-shop-pins\/:shopId'[\s\S]*?\}\);\n/g;
const newPutPins = `router.put('/staff-shop-pins/:shopId', require('../middleware/auth'), async (req, res) => {
  try {
    const { newPin } = req.body;
    if (!newPin || newPin.length < 4) return res.status(400).json({ message: 'Invalid PIN' });
    const hashedPin = await bcrypt.hash(String(newPin), 10);

    await Business.updateOne(
      { _id: req.businessId },
      { $set: { staffPins: [{ shopId: 'default', staffPin: hashedPin }] } }
    );
    res.json({ message: 'Staff PIN updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update pin' });
  }
});
`;
content = content.replace(putPinsPattern, newPutPins);

fs.writeFileSync(filepath, content, 'utf8');
