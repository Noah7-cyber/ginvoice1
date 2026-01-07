const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Business = require('../models/Business');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const { sendMail } = require('../services/mail');

const router = express.Router();

const buildToken = (businessId, role) => {
  return jwt.sign({ businessId, role }, process.env.JWT_SECRET || '', { expiresIn: '7d' });
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
  subscriptionExpiresAt: business.subscriptionExpiresAt,
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
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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
    const { email, pin, role } = req.body || {};
    if (!email || !pin) return res.status(400).json({ message: 'Email and pin required' });

    const business = await Business.findOne({ email });
    if (!business) return res.status(404).json({ message: 'Business not found' });

    let isOwner = false;
    let isStaff = false;

    if (role) {
      // If role is specified, check strictly against that role
      if (role === 'owner') {
        isOwner = await bcrypt.compare(pin, business.ownerPin);
      } else if (role === 'staff') {
        isStaff = await bcrypt.compare(pin, business.staffPin);
      }
    } else {
      // Legacy behavior: check owner first, then staff
      isOwner = await bcrypt.compare(pin, business.ownerPin);
      if (!isOwner) {
        isStaff = await bcrypt.compare(pin, business.staffPin);
      }
    }

    if (!isOwner && !isStaff) return res.status(401).json({ message: 'Invalid credentials' });

    const finalRole = isOwner ? 'owner' : 'staff';
    const token = buildToken(business._id.toString(), finalRole);

    return res.json({
      token,
      role: finalRole,
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

    const business = await Business.findOne({ email });
    if (!business) return res.status(200).json({ sent: false });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    business.recoveryCode = code;
    business.recoveryCodeExpires = expires;
    await business.save();

    // Password recovery email aligned with frontend intent
    const result = await sendMail({
      to: email,
      subject: 'Reset Your Ginvoice PIN',
      text: `Your recovery code is: ${code}\n\nThis code expires in 15 minutes.`,
      html: `<p>Your recovery code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`
    });

    return res.json({ sent: result.sent });
  } catch (err) {
    return res.status(500).json({ message: 'Recovery request failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newOwnerPin } = req.body;

    const business = await Business.findOne({
      email,
      recoveryCode: code,
      recoveryCodeExpires: { $gt: Date.now() }
    });

    if (!business) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const hashedOwnerPin = await bcrypt.hash(newOwnerPin, 10);

    business.ownerPin = hashedOwnerPin;
    business.recoveryCode = undefined;
    business.recoveryCodeExpires = undefined;
    await business.save();

    res.json({ message: 'PIN reset successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/change-pins', require('../middleware/auth'), async (req, res) => {
  try {
    const { currentOwnerPin, newStaffPin, newOwnerPin } = req.body;
    if (!currentOwnerPin) return res.status(400).json({ message: 'Current owner PIN required' });
    if (!newStaffPin && !newOwnerPin) return res.status(400).json({ message: 'No new PINs provided' });

    const business = await Business.findById(req.businessId);
    if (!business) return res.status(404).json({ message: 'Business not found' });

    // Verify current owner PIN
    const isOwner = await bcrypt.compare(currentOwnerPin, business.ownerPin);
    if (!isOwner) return res.status(401).json({ message: 'Invalid current PIN' });

    if (newStaffPin) {
      if (newStaffPin.length < 4) return res.status(400).json({ message: 'PIN too short' });
      business.staffPin = await bcrypt.hash(newStaffPin, 10);
    }

    if (newOwnerPin) {
      if (newOwnerPin.length < 4) return res.status(400).json({ message: 'PIN too short' });
      business.ownerPin = await bcrypt.hash(newOwnerPin, 10);
    }

    await business.save();
    return res.json({ message: 'PINs updated successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update PINs' });
  }
});

router.delete('/delete-account', require('../middleware/auth'), async (req, res) => {
  try {
    const { businessName } = req.body;

    // Only owner can delete
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only the owner can delete the business account' });
    }

    const business = await Business.findById(req.businessId);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    // Verify name match
    if (business.name !== businessName) {
      return res.status(400).json({ message: 'Business name does not match' });
    }

    // Delete all data
    await Product.deleteMany({ businessId: req.businessId });
    await Transaction.deleteMany({ businessId: req.businessId });
    await Expenditure.deleteMany({ business: req.businessId });
    await Business.findByIdAndDelete(req.businessId);

    return res.json({ message: 'Account and all data deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ message: 'Failed to delete account' });
  }
});

module.exports = router;
