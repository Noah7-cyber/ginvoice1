const express = require('express');
const crypto = require('crypto');

const Business = require('../models/Business');
const PaymentEvent = require('../models/PaymentEvent');
const PaymentAttempt = require('../models/PaymentAttempt');
const auth = require('../middleware/auth');
const { sendMail } = require('../services/mail');

const router = express.Router();

const getPaystackConfig = () => ({
  secretKey: process.env.PAYSTACK_SECRET_KEY,
  webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
  planCode: process.env.PAYSTACK_PLAN_CODE
});

const MIN_AMOUNT_KOBO = 200000;

const isReferenceProcessed = async (reference) => {
  if (!reference) return false;
  const existing = await PaymentEvent.findOne({ reference }).lean();
  return Boolean(existing);
};

const markReferenceProcessed = async (reference, eventType, businessId) => {
  if (!reference) return;
  try {
    await PaymentEvent.create({ reference, eventType, businessId });
  } catch (err) {
    if (err?.code !== 11000) {
      console.error('Payment event store failed', err);
    }
  }
};

const markAttemptStatus = async (reference, status) => {
  if (!reference) return;
  await PaymentAttempt.findOneAndUpdate(
    { reference },
    { $set: { status, lastCheckedAt: new Date() } },
    { new: true }
  );
};

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

const verifyReference = async (reference, secretKey) => {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Paystack verify failed');
  return data?.data;
};

const reconcilePending = async () => {
  const { secretKey } = getPaystackConfig();
  if (!secretKey) return;
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const pending = await PaymentAttempt.find({
    status: 'pending',
    $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lte: cutoff } }]
  }).limit(25);

  for (const attempt of pending) {
    try {
      await markAttemptStatus(attempt.reference, 'pending');
      const details = await verifyReference(attempt.reference, secretKey);
      if (details?.status !== 'success') continue;
      if (Number(details?.amount || 0) < MIN_AMOUNT_KOBO) {
        await markAttemptStatus(attempt.reference, 'failed');
        continue;
      }
      const businessId = details?.metadata?.businessId;
      if (!businessId || businessId !== attempt.businessId.toString()) {
        await markAttemptStatus(attempt.reference, 'failed');
        continue;
      }
      if (await isReferenceProcessed(attempt.reference)) {
        await markAttemptStatus(attempt.reference, 'processed');
        continue;
      }
      const business = await Business.findById(businessId);
      if (!business) {
        await markAttemptStatus(attempt.reference, 'failed');
        continue;
      }
      await updatePaystackCodes(business, details);
      await extendSubscription(business, 30);
      await markReferenceProcessed(attempt.reference, 'reconcile', business._id);
      await markAttemptStatus(attempt.reference, 'processed');
    } catch (err) {
      console.error('Payment reconcile failed', err);
    }
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

    const reference = data?.data?.reference;
    if (reference) {
      await PaymentAttempt.findOneAndUpdate(
        { reference },
        { $set: { businessId: business._id, amountKobo: payload.amount, status: 'pending', lastCheckedAt: null } },
        { upsert: true, new: true }
      );
    }

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
    if (details?.status !== 'success') {
      return res.status(400).json({ message: 'Payment not successful' });
    }
    if (Number(details?.amount || 0) < MIN_AMOUNT_KOBO) {
      return res.status(400).json({ message: 'Payment amount invalid' });
    }

    const referenceKey = details?.reference || reference;
    if (await isReferenceProcessed(referenceKey)) {
      return res.json({ ok: true, data });
    }

    const businessId = details?.metadata?.businessId;
    if (!businessId) return res.status(400).json({ message: 'Missing business metadata' });
    if (businessId !== req.businessId) return res.status(403).json({ message: 'Business mismatch' });
    const business = await Business.findById(businessId);

    if (business) {
      await updatePaystackCodes(business, details);
      await extendSubscription(business, 30);
      await markReferenceProcessed(referenceKey, 'verify', business._id);
      await markAttemptStatus(referenceKey, 'processed');
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
      if (amountKobo < MIN_AMOUNT_KOBO) {
        return res.json({ received: true });
      }
      if (!businessId) {
        return res.json({ received: true });
      }
      const referenceKey = event?.data?.reference;
      if (await isReferenceProcessed(referenceKey)) {
        return res.json({ received: true });
      }
      const business = await Business.findById(businessId);
      if (business) {
        await updatePaystackCodes(business, event.data);
        await extendSubscription(business, 30);
        await markReferenceProcessed(referenceKey, event.event, business._id);
        await markAttemptStatus(referenceKey, 'processed');

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
      const businessId = event?.data?.metadata?.businessId;
      const referenceKey = event?.data?.subscription_code || event?.data?.id;
      if (await isReferenceProcessed(referenceKey)) {
        return res.json({ received: true });
      }
      if (!businessId) {
        return res.json({ received: true });
      }
      const business = await Business.findById(businessId);
      if (business) {
        await updatePaystackCodes(business, event.data);
        await extendSubscription(business, 30);
        await markReferenceProcessed(referenceKey, event.event, business._id);
        await markAttemptStatus(referenceKey, 'processed');
      }
    }

    if (event?.event === 'invoice.payment_succeeded') {
      const businessId = event?.data?.metadata?.businessId;
      const referenceKey = event?.data?.invoice?.id || event?.data?.id;
      if (await isReferenceProcessed(referenceKey)) {
        return res.json({ received: true });
      }
      if (!businessId) {
        return res.json({ received: true });
      }
      const business = await Business.findById(businessId);
      if (business) {
        await updatePaystackCodes(business, event.data?.subscription || event.data);
        await extendSubscription(business, 30);
        await markReferenceProcessed(referenceKey, event.event, business._id);
        await markAttemptStatus(referenceKey, 'processed');
      }
    }

    return res.json({ received: true });
  } catch (err) {
    return res.status(500).json({ message: 'Webhook failed' });
  }
});

router.reconcilePending = reconcilePending;
module.exports = router;
