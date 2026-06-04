const Business = require('../models/Business');
const { sendSystemEmail } = require('./mail');

const GRACE_PERIOD_DAYS = 3;

const processExpiredSubscriptions = async () => {
  try {
    const now = new Date();

    // Find all businesses that are currently marked as subscribed
    // but their subscription date has technically passed (expired).
    // We ignore those that are already cancelled or no longer subscribed.
    const expiredBusinesses = await Business.find({
      isSubscribed: true,
      subscriptionStatus: { $ne: 'cancelled' },
      subscriptionExpiresAt: { $lt: now }
    });

    for (const business of expiredBusinesses) {
      if (!business.subscriptionExpiresAt) continue;

      const gracePeriodEnd = new Date(business.subscriptionExpiresAt.getTime() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));

      const isInsideGracePeriod = now <= gracePeriodEnd;

      try {
        if (isInsideGracePeriod) {
          // Send a reminder email once during the grace period
          if (!business.gracePeriodNotified && business.email) {
            const daysLeft = Math.max(1, Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

            const sent = await sendSystemEmail({
              to: business.email,
              subject: 'Action Required: Your Ginvoice Subscription Expired',
              text: `Your subscription to Ginvoice expired on ${business.subscriptionExpiresAt.toDateString()}. We are providing a ${GRACE_PERIOD_DAYS}-day grace period to update your payment method. You have ${daysLeft} day(s) left before your access is restricted.`,
              html: `
                <h2>Payment Failed / Subscription Expired</h2>
                <p>Your subscription to Ginvoice expired on <strong>${business.subscriptionExpiresAt.toDateString()}</strong>.</p>
                <p>To ensure you don't lose access, we have provided a <strong>${GRACE_PERIOD_DAYS}-day grace period</strong> to allow you time to update your payment method.</p>
                <p>You have <strong>${daysLeft} day(s)</strong> remaining in your grace period.</p>
                <p>Please log in and update your subscription to continue using Ginvoice without interruption.</p>
              `
            });

            if (sent && sent.sent) {
              business.gracePeriodNotified = true;
              await business.save();
            }
          }
        } else {
          // Grace period is over. Mark them as officially unsubscribed/failed.
          business.isSubscribed = false;
          business.subscriptionStatus = 'failed';
          business.autoRenew = false;
          await business.save();

          // Optional: Send a final "access restricted" email
          if (business.email) {
              await sendSystemEmail({
                  to: business.email,
                  subject: 'Ginvoice Access Restricted',
                  text: 'Your Ginvoice subscription grace period has ended. Your access has been restricted. Please renew to restore your access.',
                  html: '<p>Your Ginvoice subscription grace period has ended. Your access has been restricted. Please renew to restore your full access.</p>'
              });
          }
        }
      } catch (innerErr) {
        console.error(`[Cron] Error processing subscription for business ${business._id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error('[Cron] Failed to process expired subscriptions:', err);
  }
};

module.exports = {
  processExpiredSubscriptions
};
