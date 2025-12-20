const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Business = require('../models/Business');
const { sendMail } = require('../services/mail');

const router = express.Router();

const buildToken = (businessId, role) => {
  return jwt.sign({ businessId, role }, process.env.JWT_SECRET || '', { expiresIn: '30d' });
};

const sanitizeBusiness = (business) => ({
  id: business._id,
  name: business.name,
  email: business.email,
  phone: business.phone,
  address: business.address,
  logo: business.logo,
  theme: business.theme,
  trialEndsAt: business.trialEndsAt,
  isSubscribed: business.isSubscribed,
  createdAt: business.createdAt
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, address, ownerPassword, staffPassword, logo, theme } = req.body || {};
    if (!name || !phone || !ownerPassword || !staffPassword) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (email) {
      const existing = await Business.findOne({ email }).lean();
      if (existing) return res.status(409).json({ message: 'Email already registered' });
    }

    const ownerPin = await bcrypt.hash(ownerPassword, 10);
    const staffPin = await bcrypt.hash(staffPassword, 10);
    const trialEndsAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);

    const business = await Business.create({
      name,
      email,
      phone,
      address,
      ownerPin,
      staffPin,
      logo,
      theme,
      trialEndsAt,
      isSubscribed: false
    });

    const token = buildToken(business._id.toString(), 'owner');

    if (email) {
      // Registration confirmation email
      sendMail({
        to: email,
        subject: 'Welcome to Ginvoice',
        text: `Hello ${name}, your store has been registered successfully.`,
        html: `<p>Hello ${name},</p><p>Your store has been registered successfully.</p>`
      });
    }

    return res.json({
      token,
      role: 'owner',
      business: sanitizeBusiness(business)
    });
  } catch (err) {
    return res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, pin } = req.body || {};
    if (!email || !pin) return res.status(400).json({ message: 'Email and pin required' });

    const business = await Business.findOne({ email });
    if (!business) return res.status(404).json({ message: 'Business not found' });

    const isOwner = await bcrypt.compare(pin, business.ownerPin);
    const isStaff = isOwner ? false : await bcrypt.compare(pin, business.staffPin);

    if (!isOwner && !isStaff) return res.status(401).json({ message: 'Invalid credentials' });

    const role = isOwner ? 'owner' : 'staff';
    const token = buildToken(business._id.toString(), role);

    return res.json({
      token,
      role,
      business: sanitizeBusiness(business)
    });
  } catch (err) {
    return res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Email required' });

    const business = await Business.findOne({ email }).lean();
    if (!business) return res.status(200).json({ sent: false });

    // Password recovery email aligned with frontend intent
    const result = await sendMail({
      to: email,
      subject: 'Ginvoice Password Recovery Request',
      text: `We received a password recovery request for ${business.name}. If this was you, please contact your market supervisor or system administrator to reset access.`,
      html: `<p>We received a password recovery request for <strong>${business.name}</strong>.</p><p>If this was you, please contact your market supervisor or system administrator to reset access.</p>`
    });

    return res.json({ sent: result.sent });
  } catch (err) {
    return res.status(500).json({ message: 'Recovery request failed' });
  }
});

module.exports = router;
