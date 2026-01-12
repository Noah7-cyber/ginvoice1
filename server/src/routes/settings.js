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

    const { settings, staffPermissions } = req.body;
    const update = {};
    if (settings) update.settings = settings;
    if (staffPermissions) update.staffPermissions = staffPermissions;

    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $set: update },
      { new: true, runValidators: true }
    ).select('settings staffPermissions');

    res.json({ settings: business.settings, staffPermissions: business.staffPermissions });
  } catch (err) {
    res.status(500).json({ message: 'Update settings failed' });
  }
});

module.exports = router;
