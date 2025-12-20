const express = require('express');
const crypto = require('crypto');

const Business = require('../models/Business');
const auth = require('../middleware/auth');
const { sendMail } = require('../services/mail');

const router = express.Router();

const getPaystackConfig = () => ({
  secretKey: process.env.PAYSTACK_SECRET_KEY,
  webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
  planCode: process.env.PAYSTACK_PLAN_CODE
});

const extendSubscription = async (business, days) => {
  const now = new Date();
  const currentEnd = business.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt) : null;
  const base = currentEnd && currentEnd > now ? currentEnd : now;
  business.subscriptionExpiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  business.isSubscribed = true;
  await business.save();
};

const updatePaystackCodes = async (business, data) => {
  if (data?.customer?.customer_code && business.paystackCustomerCode !== data.customer.customer_code) {
    business.paystackCustomerCode = data.customer.customer_code;
  }
  if (data?.subscription_code && business.paystackSubscriptionCode !== data.subscription_code) {
    business.paystackSubscriptionCode = data.subscription_code;
  }
  const planCode = data?.plan?.plan_code || data?.plan_code;
  if (planCode && business.paystackPlanCode !== planCode) {
    business.paystackPlanCode = planCode;
  }
};

router.post('/initialize', auth, async (req, res) => {
  try {
    const { secretKey, planCode } = getPaystackConfig();
    if (!secretKey) return res.status(501).json({ message: 'Paystack not configured' });

    const business = await Business.findById(req.businessId);
    if (!business) return res.status(404).json({ message: 'Business not found' });

    const amountNaira = Number(req.body?.amount || 0);
    if (!amountNaira || amountNaira <= 0) return res.status(400).json({ message: 'Amount required' });

    const email = req.body?.email || business.email;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const payload = {
      email,
      amount: Math.round(amountNaira * 100),
      currency: 'NGN',
      metadata: { businessId: business._id.toString() }
    };

    if (planCode) payload.plan = planCode;

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ message: 'Paystack init failed', data });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: 'Payment init failed' });
  }
});

router.post('/verify', auth, async (req, res) => {
  try {
    const { secretKey } = getPaystackConfig();
    if (!secretKey) return res.status(501).json({ message: 'Paystack not configured' });
    const reference = req.body?.reference;
    if (!reference) return res.status(400).json({ message: 'Reference required' });

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ message: 'Paystack verify failed', data });

    const details = data?.data;
    const businessId = details?.metadata?.businessId;
    const email = details?.customer?.email;
    const business = businessId
      ? await Business.findById(businessId)
      : await Business.findOne({ email });

    if (business) {
      await updatePaystackCodes(business, details);
      await extendSubscription(business, 30);
    }

    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ message: 'Payment verify failed' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const { webhookSecret } = getPaystackConfig();
    if (!webhookSecret) return res.status(200).json({ received: true });

    const signature = req.headers['x-paystack-signature'];
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const hash = crypto.createHmac('sha512', webhookSecret).update(raw).digest('hex');

    if (signature !== hash) return res.status(401).json({ message: 'Invalid signature' });

    const event = req.body;
    if (event?.event === 'charge.success') {
      const businessId = event?.data?.metadata?.businessId;
      const amountKobo = Number(event?.data?.amount || 0);
      if (amountKobo < 200000) {
        return res.json({ received: true });
      }
      const email = event?.data?.customer?.email;
      const business = businessId
        ? await Business.findById(businessId)
        : await Business.findOne({ email });
      if (business) {
        await updatePaystackCodes(business, event.data);
        await extendSubscription(business, 30);

        if (business.email) {
          // Subscription activation email
          sendMail({
            to: business.email,
            subject: 'Ginvoice Subscription Active',
            text: `Your subscription is active until ${business.subscriptionExpiresAt.toDateString()}.`,
            html: `<p>Your subscription is active until <strong>${business.subscriptionExpiresAt.toDateString()}</strong>.</p>`
          });
        }
      }
    }

    if (event?.event === 'subscription.create') {
      const email = event?.data?.customer?.email;
      const business = await Business.findOne({ email });
      if (business) {
        await updatePaystackCodes(business, event.data);
        await extendSubscription(business, 30);
      }
    }

    if (event?.event === 'invoice.payment_succeeded') {
      const email = event?.data?.customer?.email;
      const business = await Business.findOne({ email });
      if (business) {
        await updatePaystackCodes(business, event.data?.subscription || event.data);
        await extendSubscription(business, 30);
      }
    }

    return res.json({ received: true });
  } catch (err) {
    return res.status(500).json({ message: 'Webhook failed' });
  }
});

module.exports = router;
