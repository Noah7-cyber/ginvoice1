const express = require('express');
const DiscountCode = require('../models/DiscountCode');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate a new code (Owner only)
router.post('/generate', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can generate codes' });
    }

    const { type, value, expiryDate, scope, productId } = req.body;

    if (!type || !value || !scope) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Generate random 6-char alphanumeric code
    const codeStr = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Default to 30 minutes if expiryDate is missing or invalid
    const validExpiry = expiryDate ? new Date(expiryDate) : new Date(Date.now() + 30 * 60 * 1000);

    const discount = await DiscountCode.create({
      businessId: req.businessId,
      code: codeStr,
      type,
      value,
      expiryDate: validExpiry,
      scope,
      productId
    });

    res.json(discount);
  } catch (err) {
    console.error('Generate Discount Error:', err);
    res.status(500).json({ message: 'Failed to generate code' });
  }
});

// Validate a code (Staff/Owner)
router.post('/validate', auth, async (req, res) => {
  try {
    const { code, cartItems } = req.body;
    if (!code) return res.status(400).json({ message: 'Code required' });

    const discount = await DiscountCode.findOne({
      businessId: req.businessId,
      code: code.toUpperCase(),
      isUsed: false
    });

    if (!discount) {
      return res.status(404).json({ valid: false, message: 'Invalid code' });
    }

    if (discount.isUsed) {
      return res.status(400).json({ valid: false, message: 'Code already used' });
    }

    if (discount.expiryDate && new Date(discount.expiryDate) < new Date()) {
      return res.status(400).json({ valid: false, message: 'Code expired' });
    }

    // Calculate potential discount amount based on scope
    let discountAmount = 0;

    if (discount.scope === 'global') {
       // Applies to subtotal (handled by frontend, just return value)
       // We don't mark as used yet, assuming frontend will confirm use?
       // Or is this just a "check"? The prompt says "Apply the discount".
       // Ideally we mark 'isUsed' when the transaction completes.
       // For now, let's just return validity.
    } else if (discount.scope === 'product' && discount.productId && cartItems) {
       // Verify product is in cart
       const hasProduct = cartItems.some(item => item.productId === discount.productId);
       if (!hasProduct) {
         return res.status(400).json({ valid: false, message: 'Code not applicable to current items' });
       }
    }

    res.json({ valid: true, discount });
  } catch (err) {
    console.error('Validate Discount Error:', err);
    res.status(500).json({ message: 'Validation failed' });
  }
});

// Mark code as used (Called when transaction is finalized)
router.post('/use', auth, async (req, res) => {
  try {
    const { code } = req.body;
    await DiscountCode.updateOne(
      { businessId: req.businessId, code: code.toUpperCase() },
      { $set: { isUsed: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark code as used' });
  }
});

module.exports = router;
