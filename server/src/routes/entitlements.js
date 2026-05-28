const express = require('express');

const auth = require('../middleware/auth');
const Business = require('../models/Business');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId).lean();
    if (!business) return res.status(404).json({ message: 'Business not found' });

    const now = new Date();
    const trialEndsAt = business.trialEndsAt ? new Date(business.trialEndsAt) : null;
    const subscriptionEndsAt = business.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt) : null;

    const trialActive = trialEndsAt && trialEndsAt >= now;
    const subscriptionActive = subscriptionEndsAt && subscriptionEndsAt >= now;

    const plan = trialActive || subscriptionActive ? 'PRO' : 'FREE';
    const expiresAt = subscriptionActive ? subscriptionEndsAt : trialActive ? trialEndsAt : null;

    return res.json({
      plan,
      expiresAt,
      trialEndsAt: business.trialEndsAt,
      subscriptionExpiresAt: business.subscriptionExpiresAt
    });
  } catch (err) {
    return res.status(500).json({ message: 'Entitlements fetch failed' });
  }
});

module.exports = router;
