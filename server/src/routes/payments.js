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

router.post('/initialize', auth, async (req, res) => {
  try {
    const { secretKey, planCode } = getPaystackConfig();
    if (!secretKey) return res.status(501).json({ message: 'Paystack not configured' });

    const business = await Business.findById(req.businessId).lean();
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
      if (businessId) {
        const business = await Business.findById(businessId);
        if (business) {
          const now = new Date();
          const currentEnd = business.trialEndsAt ? new Date(business.trialEndsAt) : now;
          const base = currentEnd > now ? currentEnd : now;
          const extended = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
          business.trialEndsAt = extended;
          business.isSubscribed = true;
          await business.save();

          if (business.email) {
            // Subscription activation email
            sendMail({
              to: business.email,
              subject: 'Ginvoice Subscription Active',
              text: `Your subscription is active until ${extended.toDateString()}.`,
              html: `<p>Your subscription is active until <strong>${extended.toDateString()}</strong>.</p>`
            });
          }
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    return res.status(500).json({ message: 'Webhook failed' });
  }
});

module.exports = router;
