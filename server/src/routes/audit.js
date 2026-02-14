const express = require('express');
const auth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const Business = require('../models/Business');
const StockVerificationEvent = require('../models/StockVerificationEvent');
const { computeRiskScore, generateVerificationQueue, getStockVerificationSettings } = require('../services/stockVerification');

const router = express.Router();

router.get('/queue', auth, async (req, res) => {
  const result = await generateVerificationQueue(req.businessId);
  return res.json({ queue: result.queue, reason: result.reason, settings: result.settings });
});

router.post('/snooze', auth, async (req, res) => {
  const snoozeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await Business.findByIdAndUpdate(req.businessId, { $set: { 'settings.stockVerification.snoozeUntil': snoozeUntil } });
  res.json({ success: true, snoozeUntil });
});

router.post('/dismiss/:notificationId', auth, async (req, res) => {
  await Notification.updateOne({ _id: req.params.notificationId, businessId: req.businessId }, { $set: { dismissedAt: new Date() } });
  res.json({ success: true });
});

router.post('/verify', auth, requireActiveSubscription, async (req, res) => {
  const { productId, countedQty, expectedQtyAtOpen, reasonCode = 'CYCLE_COUNT', notes = '', confirmChangedExpected = false } = req.body || {};
  const numericCounted = Number(countedQty);

  if (!productId || Number.isNaN(numericCounted)) {
    return res.status(400).json({ message: 'Invalid verification payload.' });
  }

  const product = await Product.findOne({ businessId: req.businessId, id: productId });
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const expectedQty = Number(product.stock || 0);
  if (!confirmChangedExpected && expectedQtyAtOpen !== undefined && Number(expectedQtyAtOpen) !== expectedQty) {
    return res.status(409).json({
      message: 'On-hand quantity changed since you opened this count.',
      expectedQtyNow: expectedQty
    });
  }

  const business = await Business.findById(req.businessId).select('settings.stockVerification').lean();
  const settings = getStockVerificationSettings(business);
  const riskBefore = computeRiskScore(product, {}, new Date(), settings);

  const variance = numericCounted - expectedQty;
  if (variance !== 0) product.stock = numericCounted;

  product.lastVerifiedAt = new Date();
  product.lastVerifiedQty = numericCounted;
  product.lastAbsVar = Math.abs(variance);
  if (variance !== 0) product.varianceCount = Number(product.varianceCount || 0) + 1;
  await product.save();

  const riskAfter = Math.max(0, Math.round(riskBefore * (1 - (settings.riskDecayOnVerify ?? 0.6))));

  await StockVerificationEvent.create({
    businessId: req.businessId,
    productId,
    expectedQty,
    countedQty: numericCounted,
    variance,
    reasonCode,
    verifiedBy: req.user?.id || '',
    verifiedAt: new Date(),
    riskBefore,
    riskAfter,
    notes
  });

  if (variance !== 0) {
    const lastVariance = await Notification.findOne({ businessId: req.businessId, type: 'stock_variance' }).sort({ timestamp: -1 }).lean();
    if (!lastVariance || (Date.now() - new Date(lastVariance.timestamp).getTime()) > (24 * 60 * 60 * 1000)) {
      await Notification.create({
        businessId: req.businessId,
        title: 'Stock variance recorded',
        message: `${product.name}: stock mismatch was reconciled during verification.`,
        body: `Expected ${expectedQty}, counted ${numericCounted}.`,
        type: 'stock_variance',
        amount: 0,
        performedBy: 'System',
        payload: { kind: 'STOCK_VARIANCE', productId, variance }
      });
    }
  }

  await Business.findByIdAndUpdate(req.businessId, {
    $set: {
      'settings.stockVerification.snoozeUntil': null
    }
  });

  return res.json({
    success: true,
    productId,
    expectedQty,
    countedQty: numericCounted,
    variance,
    riskBefore,
    riskAfter
  });
});

module.exports = router;
