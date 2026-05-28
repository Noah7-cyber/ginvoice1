const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Business = require('../models/Business');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Notification = require('../models/Notification');
const adminAuth = require('../middleware/adminAuth');
const multer = require('multer');
const { sendSystemEmail } = require('../services/mail');
const { buildCustomAdminEmail } = require('../services/emailTemplates');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// POST /login (Admin Only)
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Strict Env Check
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        // Sign token strictly for admin role
        const token = jwt.sign(
            { role: 'superadmin' },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );
        return res.json({ token });
    }

    return res.status(401).json({ message: 'Invalid admin credentials' });
});

// Apply adminAuth to ALL subsequent routes
router.use(adminAuth);

// GET /stats
router.get('/stats', async (req, res) => {
  try {
    const totalBusinesses = await Business.countDocuments();
    const activeSubscriptions = await Business.countDocuments({ isSubscribed: true });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyActiveUsers = await Business.countDocuments({ lastActiveAt: { $gte: oneDayAgo } });

    res.json({
      totalBusinesses,
      activeSubscriptions,
      dailyActiveUsers
    });
  } catch (err) {
    console.error('Admin Stats Error:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// GET /users (Paginated & Searchable)
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const businesses = await Business.find(query)
      .select('name email phone isSubscribed subscriptionExpiresAt lastActiveAt subscriptionStatus')
      .sort({ lastActiveAt: -1 }) // Most recently active first
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Business.countDocuments(query);

    res.json({
      users: businesses,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Admin Users Error:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// GET /users/:id (Full Details)
router.get('/users/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).lean();
    if (!business) return res.status(404).json({ message: 'User not found' });

    const productCount = await Product.countDocuments({ businessId: req.params.id });
    const transactionCount = await Transaction.countDocuments({ businessId: req.params.id });

    res.json({
      ...business,
      productCount,
      transactionCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user details' });
  }
});

// PUT /users/:id (Update Details)
router.put('/users/:id', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const update = {};
    if (name) update.name = name;
    if (phone) update.phone = phone;
    if (email) update.email = email;

    const business = await Business.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).lean();

    if (!business) return res.status(404).json({ message: 'User not found' });
    res.json(business);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// POST /users/:id/grant-subscription
router.post('/users/:id/grant-subscription', async (req, res) => {
  try {
    const { days = 30 } = req.body;
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: 'User not found' });

    const currentExpiry = business.subscriptionExpiresAt && new Date(business.subscriptionExpiresAt) > new Date()
        ? new Date(business.subscriptionExpiresAt)
        : new Date();

    const newExpiry = new Date(currentExpiry.getTime() + (days * 24 * 60 * 60 * 1000));

    business.isSubscribed = true;
    business.subscriptionStatus = 'active';
    business.autoRenew = false; // Manual grants usually don't auto-renew via payment provider
    business.subscriptionExpiresAt = newExpiry;

    await business.save();
    res.json({ message: 'Subscription granted', subscriptionExpiresAt: newExpiry });
  } catch (err) {
    res.status(500).json({ message: 'Failed to grant subscription' });
  }
});

// POST /users/:id/send-email
router.post('/users/:id/send-email', upload.array('attachments', 5), async (req, res) => {
  try {
    const { subject, message } = req.body;
    const business = await Business.findById(req.params.id);

    if (!business || !business.email) {
      return res.status(404).json({ message: 'User or email not found' });
    }

    const attachments = (req.files || []).map(file => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    }));

    const html = buildCustomAdminEmail({ subject, message });

    const result = await sendSystemEmail({
      to: business.email,
      subject,
      html,
      attachments
    });

    if (result.sent) {
      res.json({ message: 'Email sent successfully' });
    } else {
      res.status(500).json({ message: 'Failed to send email' });
    }
  } catch (err) {
    console.error('Send Email Error:', err);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

// DELETE /users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const businessId = req.params.id;
    const business = await Business.findById(businessId).lean();
    if (!business) return res.status(404).json({ message: 'User not found' });

    // Strict confirmation or check? User dashboard usually has red button.
    // We proceed with deletion.

    await Promise.all([
        Product.deleteMany({ businessId }),
        Transaction.deleteMany({ businessId }),
        Expenditure.deleteMany({ business: businessId }),
        Business.findByIdAndDelete(businessId)
    ]);

    res.json({ message: 'User and all data permanently deleted' });
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// DELETE /purge-deleted-products
router.delete('/purge-deleted-products', async (req, res) => {
  try {
    const result = await Product.deleteMany({ isDeleted: true });
    res.json({ message: 'Purge successful', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Purge Error:', err);
    res.status(500).json({ message: 'Failed to purge products' });
  }
});

// DELETE /purge-inactive-shops
router.delete('/purge-inactive-shops', async (req, res) => {
  try {
    const inactiveShops = await Shop.find({ status: 'inactive' }).select('_id businessId').lean();

    if (inactiveShopIds.length === 0) {
      return res.json({ message: 'No inactive shops to purge', deletedCount: 0 });
    }

    const businessIds = [...new Set(inactiveShops.map((s) => String(s.businessId)).filter(Boolean))];

    const [shopResult, stockResult, txResult, expResult, noteResult] = await Promise.all([
      Shop.deleteMany({ _id: { $in: inactiveShopIds } }),
                            ]);

    if (businessIds.length > 0) {
      await Business.updateMany(
        { _id: { $in: businessIds } },
              );
    }

    res.json({
      message: 'Inactive shops purged successfully',
      deletedCount: shopResult.deletedCount || 0,
      details: {
        shops: shopResult.deletedCount || 0,
        stockRows: stockResult.deletedCount || 0,
        transactions: txResult.deletedCount || 0,
        expenditures: expResult.deletedCount || 0,
        notifications: noteResult.deletedCount || 0
      }
    });
  } catch (err) {
    console.error('Purge Inactive Shops Error:', err);
    res.status(500).json({ message: 'Failed to purge inactive shops' });
  }
});

module.exports = router;
