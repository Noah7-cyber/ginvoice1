const Business = require('../models/Business');

const requireActiveSubscription = async (req, res, next) => {
  try {
    const business = await Business.findById(req.businessId).lean();
    if (!business) return res.status(404).json({ message: 'Business not found' });

    const now = new Date();
    const trialEndsAt = business.trialEndsAt ? new Date(business.trialEndsAt) : null;
    const subscriptionEndsAt = business.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt) : null;

    // Add a 3-day grace period
    const gracePeriodEnd = subscriptionEndsAt
      ? new Date(subscriptionEndsAt.getTime() + (0 * 24 * 60 * 60 * 1000)) // TEST MODE: 0 days grace period
      : null;

    const hasAccess = (gracePeriodEnd && gracePeriodEnd >= now) || (trialEndsAt && trialEndsAt >= now);

    if (!hasAccess && req.method !== 'GET') {
      return res.status(402).json({ message: 'Subscription required', trialEndsAt: business.trialEndsAt, isSubscribed: business.isSubscribed, subscriptionExpiresAt: business.subscriptionExpiresAt });
    }

    req.plan = hasAccess ? 'premium' : 'free';
    req.business = business;
    return next();
  } catch (err) {
    return res.status(500).json({ message: 'Subscription check failed' });
  }
};

module.exports = requireActiveSubscription;
