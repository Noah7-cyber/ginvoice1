const Business = require('../models/Business');

const requireActiveSubscription = async (req, res, next) => {
  try {
    const business = await Business.findById(req.businessId).lean();
    if (!business) return res.status(404).json({ message: 'Business not found' });

    const now = new Date();
    const accessEndsAt = business.trialEndsAt ? new Date(business.trialEndsAt) : null;
    const hasAccess = (business.isSubscribed && accessEndsAt && accessEndsAt >= now) || (!business.isSubscribed && accessEndsAt && accessEndsAt >= now);

    if (!hasAccess) {
      return res.status(402).json({ message: 'Subscription required', trialEndsAt: business.trialEndsAt, isSubscribed: business.isSubscribed });
    }

    req.business = business;
    return next();
  } catch (err) {
    return res.status(500).json({ message: 'Subscription check failed' });
  }
};

module.exports = requireActiveSubscription;
