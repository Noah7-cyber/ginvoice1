const express = require('express');
const router = express.Router();
const Business = require('../models/Business');

// GET /api/stats/business-count
// Public endpoint to get total registered businesses
router.get('/business-count', async (req, res) => {
  try {
    const count = await Business.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error('Error fetching business count:', err);
    // Return a safe fallback or error
    res.status(500).json({ count: 0 });
  }
});

module.exports = router;
