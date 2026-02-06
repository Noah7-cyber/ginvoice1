const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Business = require('../models/Business');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const adminAuth = require('../middleware/adminAuth');

// POST /login (Admin Only)
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Strict Env Check
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        // Sign token strictly for admin role
        const token = jwt.sign(
            { role: 'superadmin' },
            process.env.JWT_SECRET || '',
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
      .limit(parseInt(limit));

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
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: 'User not found' });

    const productCount = await Product.countDocuments({ businessId: req.params.id });
    const transactionCount = await Transaction.countDocuments({ businessId: req.params.id });

    res.json({
      ...business.toObject(),
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
    );

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

// DELETE /users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const businessId = req.params.id;
    const business = await Business.findById(businessId);
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

module.exports = router;
