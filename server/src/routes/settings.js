const express = require('express');
const Business = require('../models/Business');
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');

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
router.put('/', auth, requireActiveSubscription, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can update settings' });
    }

    const { settings, staffPermissions, taxSettings, name, phone, address, email, logo, theme } = req.body;
    const update = {};
    if (settings) update.settings = settings;
    if (staffPermissions) update.staffPermissions = staffPermissions;
    if (taxSettings) update.taxSettings = taxSettings;
    if (name) update.name = name;
    if (phone) update.phone = phone;
    if (address) update.address = address;
    if (email) update.email = email;

    // Explicit null check for logo deletion
    if (logo === null) {
        update.logo = null; // Unset/Nullify in DB
        // Or if you want to use $unset:
        // But normally Mongoose handles null if schema allows string|null
        // BusinessSchema definition for logo needs to allow null or not have 'required'
        // Assuming it is not required.
    } else if (logo !== undefined) {
        update.logo = logo;
    }

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
      taxSettings: business.taxSettings,
      name: business.name,
      phone: business.phone,
      address: business.address,
      email: business.email,
      logo: business.logo,
      theme: business.theme
    });
  } catch (err) {
    console.error("Settings Update Failed:", err);
    res.status(500).json({ message: 'Update settings failed' });
  }
});

module.exports = router;
