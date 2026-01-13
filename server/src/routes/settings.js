const express = require('express');
const Business = require('../models/Business');
const auth = require('../middleware/auth');

const router = express.Router();

// GET current settings
router.get('/', auth, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId).select('settings staffPermissions');
    if (!business) return res.status(404).json({ message: 'Business not found' });
    res.json({ settings: business.settings, staffPermissions: business.staffPermissions });
  } catch (err) {
    res.status(500).json({ message: 'Fetch settings failed' });
  }
});

// UPDATE settings
router.put('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can update settings' });
    }

    const { settings, staffPermissions, name, phone, address, email, logo, theme } = req.body;
    const update = {};
    if (settings) update.settings = settings;
    if (staffPermissions) update.staffPermissions = staffPermissions;
    if (name) update.name = name;
    if (phone) update.phone = phone;
    if (address) update.address = address;
    if (email) update.email = email;
    if (logo) update.logo = logo;
    if (theme) update.theme = theme;

    const business = await Business.findByIdAndUpdate(
      req.businessId,
      {
        $set: update,
        $inc: { credentialsVersion: 1 } // Invalidate existing staff tokens
      },
      { new: true, runValidators: true }
    ).select('settings staffPermissions name phone address email logo theme');

    // Trigger immediate version bump for sync
    await Business.findByIdAndUpdate(req.businessId, { $inc: { dataVersion: 1 } });

    res.json({
      settings: business.settings,
      staffPermissions: business.staffPermissions,
      name: business.name,
      phone: business.phone,
      address: business.address,
      email: business.email,
      logo: business.logo,
      theme: business.theme
    });
  } catch (err) {
    res.status(500).json({ message: 'Update settings failed' });
  }
});

module.exports = router;
