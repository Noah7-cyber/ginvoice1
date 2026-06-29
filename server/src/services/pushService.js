const webpush = require('web-push');
const Business = require('../models/Business');

webpush.setVapidDetails(
  'mailto:support@ginvoice.com.ng',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send a native Web Push Notification to all subscribed devices of a business.
 * @param {string} businessId - The ID of the business/user.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @param {object} data - Custom data payload (e.g. url to redirect on click).
 */
const sendNativePush = async (businessId, title, body, data = {}) => {
  try {
    const business = await Business.findById(businessId);
    if (!business || !business.pushSubscriptions || business.pushSubscriptions.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      title,
      body,
      data
    });

    const activeSubscriptions = [];
    const removals = [];

    // Send push to all devices
    for (const subscription of business.pushSubscriptions) {
      try {
        await webpush.sendNotification(subscription, payload);
        activeSubscriptions.push(subscription);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[WebPush] Subscription expired or not found. Removing. endpoint: ${subscription.endpoint}`);
          removals.push(subscription); // Subscription is no longer valid
        } else {
          activeSubscriptions.push(subscription); // Keep it if error was transient
          console.error('[WebPush] Error sending push to a subscription:', {
            statusCode: err.statusCode,
            body: err.body,
            endpoint: subscription.endpoint,
            message: err.message
          });
        }
      }
    }

    // Clean up expired subscriptions
    if (removals.length > 0) {
      business.pushSubscriptions = activeSubscriptions;
      await business.save();
    }
  } catch (error) {
    console.error('[WebPush] Failed to process push notification:', error);
  }
};

module.exports = {
  sendNativePush
};
