const express = require('express');
const router = express.Router();
const Business = require('../models/Business');
const auth = require('../middleware/auth');

router.post('/save-subscription', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    const businessId = req.businessId;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (!business.pushSubscriptions) {
      business.pushSubscriptions = [];
    }

    // Check if subscription already exists
    const exists = business.pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
    
    if (!exists) {
      business.pushSubscriptions.push(subscription);
      await business.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[PushRoute] Error saving subscription:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
