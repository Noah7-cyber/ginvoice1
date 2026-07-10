require('dotenv').config();
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const Business = require('../src/models/Business');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

async function disableSubscription(code, token) {
  const res = await fetch(`https://api.paystack.co/subscription/disable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code, token })
  });
  return res.json();
}

async function runCleanup() {
  if (!PAYSTACK_SECRET) {
    console.error('Missing PAYSTACK_SECRET_KEY');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Find businesses that are marked as cancelled or not auto-renewing
    const cancelledBusinesses = await Business.find({
      $or: [
        { subscriptionStatus: 'cancelled' },
        { subscriptionStatus: 'non-renewing' },
        { autoRenew: false }
      ],
      paystackCustomerCode: { $exists: true, $ne: null }
    });

    console.log(`Found ${cancelledBusinesses.length} cancelled/non-renewing businesses to check...`);

    let disabledCount = 0;

    for (const business of cancelledBusinesses) {
      try {
        const custRes = await fetch(`https://api.paystack.co/customer/${business.paystackCustomerCode}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
        });
        
        const custData = await custRes.json();
        if (!custData.status || !custData.data?.subscriptions) continue;

        const activeSubs = custData.data.subscriptions.filter(s => s.status === 'active');
        
        if (activeSubs.length > 0) {
          console.log(`Found ${activeSubs.length} rogue active subscriptions for ${business.email}`);
          
          for (const sub of activeSubs) {
            const result = await disableSubscription(sub.subscription_code, sub.email_token);
            if (result.status) {
              console.log(`  -> Successfully disabled rogue subscription: ${sub.subscription_code}`);
              disabledCount++;
            } else if (result.message && result.message.toLowerCase().includes('already inactive')) {
               console.log(`  -> Subscription ${sub.subscription_code} already inactive`);
            } else {
              console.error(`  -> Failed to disable ${sub.subscription_code}: ${result.message}`);
            }
          }
        }
      } catch (err) {
         console.error(`Error processing business ${business.email}:`, err.message);
      }
      
      // Sleep a little to avoid hitting Paystack rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\nCleanup complete! Disabled ${disabledCount} rogue subscriptions.`);
    process.exit(0);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

runCleanup();
