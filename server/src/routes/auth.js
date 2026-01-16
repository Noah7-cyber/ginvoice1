const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const Business = require('../models/Business');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const { sendSystemEmail } = require('../services/mail');
const { buildWelcomeEmail, buildRecoveryEmail, buildVerificationEmail } = require('../services/emailTemplates');

const router = express.Router();

const buildToken = (businessId, role, credentialsVersion) => {
  return jwt.sign({ businessId, role, credentialsVersion }, process.env.JWT_SECRET || '', { expiresIn: '7d' });
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
  createdAt: business.createdAt,
  emailVerified: business.emailVerified // Added field
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

    // Email Verification Logic
    let emailVerificationToken = undefined;
    let emailVerificationExpires = undefined;
    let rawToken = undefined;

    if (email) {
      rawToken = crypto.randomBytes(32).toString('hex');
      emailVerificationToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

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
      isSubscribed: false,
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires
    });

    const token = buildToken(business._id.toString(), 'owner', 1);

    if (email && rawToken) {
      try {
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
        const verificationUrl = `${baseUrl}/api/auth/verify-link?token=${rawToken}`;
        const emailHtml = buildVerificationEmail({ verificationUrl, businessName: name });

        // Enforce 10-second timeout for email to prevent hanging
        const emailPromise = sendSystemEmail({
          to: email,
          subject: 'Verify Your Email - Ginvoice',
          text: `Please verify your email by visiting: ${verificationUrl}`,
          html: emailHtml
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Email service timed out')), 10000)
        );

        const result = await Promise.race([emailPromise, timeoutPromise]);

        // Check if the service returned { sent: false } even if it didn't throw
        if (result && result.sent === false) {
           throw new Error('Email service returned failure status');
        }

      } catch (emailError) {
        // Atomic Registration: Rollback if email fails
        await Business.findByIdAndDelete(business._id);
        console.error('Registration email failed:', emailError);
        return res.status(500).json({
          message: 'Registration failed: Could not send verification email. Please try again.'
        });
      }
    }

    return res.json({
      token,
      role: 'owner',
      business: sanitizeBusiness(business)
    });
  } catch (err) {
    console.error('Registration Error:', err);
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

    // New Check: Block login ONLY if explicitly false (Strict Check)
    if (business.emailVerified === false) {
        return res.status(403).json({
            message: 'Please verify your email address to continue.',
            requiresVerification: true
        });
    }

    const finalRole = isOwner ? 'owner' : 'staff';
    const token = buildToken(business._id.toString(), finalRole, business.credentialsVersion || 1);

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

    // Cooldown check: if code expires > 14 mins from now, it was sent < 1 min ago
    if (business.recoveryCodeExpires && business.recoveryCodeExpires > new Date(Date.now() + 14 * 60 * 1000)) {
      return res.status(429).json({ message: 'Please wait a minute before requesting again.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    business.recoveryCode = code;
    business.recoveryCodeExpires = expires;
    await business.save();

    // Password recovery email aligned with frontend intent
    const emailHtml = buildRecoveryEmail({ code });
    const result = await sendSystemEmail({
      to: email,
      subject: 'Reset Your PIN - Ginvoice',
      text: `Your recovery code is: ${code}. This code expires in 15 minutes.`,
      html: emailHtml
    });

    return res.json({ sent: result.sent });
  } catch (err) {
    return res.status(500).json({ message: 'Recovery request failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newOwnerPin } = req.body;

    // 1. PIN Validation
    if (!newOwnerPin || !/^\d{4,8}$/.test(newOwnerPin)) {
      return res.status(400).json({ error: 'PIN must be 4-8 numeric digits' });
    }

    const business = await Business.findOne({
      email,
      recoveryCode: code,
      recoveryCodeExpires: { $gt: Date.now() }
    });

    if (!business) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const hashedOwnerPin = await bcrypt.hash(newOwnerPin, 10);

    // 2. Session Invalidation
    business.credentialsVersion = (business.credentialsVersion || 1) + 1;

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

// NEW: Verify Email Endpoint (Backend Redirect)
router.get('/verify-link', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${frontendUrl}?error=invalid_token`);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const business = await Business.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!business) {
      return res.redirect(`${frontendUrl}?error=invalid_token`);
    }

    business.emailVerified = true;
    business.emailVerificationToken = undefined;
    business.emailVerificationExpires = undefined;
    await business.save();

    // Send Welcome Email now that they are verified
    if (business.email) {
      const emailHtml = buildWelcomeEmail({ businessName: business.name });
      await sendSystemEmail({
        to: business.email,
        subject: 'Welcome to Ginvoice! 🚀',
        text: `Welcome to Ginvoice, ${business.name}! Your account is verified.`,
        html: emailHtml
      });
    }

    return res.redirect(`${frontendUrl}?verified=true`);
  } catch (err) {
    console.error('Email verification error:', err);
    return res.redirect(`${frontendUrl}?error=server_error`);
  }
});

// NEW: Resend Verification Email
router.post('/resend-verification', async (req, res) => {
  try {
    // Robust resend logic
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const business = await Business.findOne({ email });
    if (!business) {
        // Return success to avoid user enumeration, but log it
        return res.json({ message: 'Verification email sent if account exists.' });
    }

    if (business.emailVerified === true) {
        return res.status(400).json({ message: 'Email already verified.' });
    }

    // Generate new token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    business.emailVerificationToken = emailVerificationToken;
    business.emailVerificationExpires = emailVerificationExpires;
    await business.save();

    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
    const verificationUrl = `${baseUrl}/api/auth/verify-link?token=${rawToken}`;
    const emailHtml = buildVerificationEmail({ verificationUrl, businessName: business.name });

    await sendSystemEmail({
        to: email,
        subject: 'Verify Your Email - Ginvoice',
        text: `Please verify your email by visiting: ${verificationUrl}`,
        html: emailHtml
    });

    return res.json({ message: 'Verification email sent successfully.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({ message: 'Failed to resend verification email.' });
  }
});

// NEW: Check Verification Status
router.post('/verification-status', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const business = await Business.findOne({ email });
    if (!business) return res.status(404).json({ message: 'Business not found' });

    return res.json({
        verified: business.emailVerified === true
    });
  } catch (err) {
    console.error('Verification status check error:', err);
    return res.status(500).json({ message: 'Failed to check status' });
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

// TEMPORARY: Cleanup unverified users (Protected)
router.post('/cleanup-unverified', require('../middleware/auth'), async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await Business.deleteMany({
      emailVerified: false,
      createdAt: { $lt: twentyFourHoursAgo }
    });
    return res.json({ message: `Cleaned up ${result.deletedCount} unverified accounts.` });
  } catch (err) {
    console.error('Cleanup failed:', err);
    return res.status(500).json({ message: 'Cleanup failed' });
  }
});

module.exports = router;
