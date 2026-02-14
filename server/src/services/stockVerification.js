const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const Business = require('../models/Business');

const DEFAULTS = {
  enabled: true,
  maxQueuePerDay: 5,
  minDaysBetweenPrompts: 1,
  verifyCooldownHours: 24,
  ageHalfLifeDays: 14,
  velocityWindowDays: 7,
  riskDecayOnVerify: 0.6,
  highVarianceBoost: 15,
  riskThreshold: 35,
  snoozeUntil: null,
  lastNotificationAt: null
};

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
const clampRisk = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const parsePrice = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (v.toString) return Number(v.toString()) || 0;
  return Number(v) || 0;
};

const computeRiskScore = (product, stats = {}, now = new Date(), settings = DEFAULTS) => {
  const cfg = { ...DEFAULTS, ...(settings || {}) };
  const lastVerifiedAt = product.lastVerifiedAt ? new Date(product.lastVerifiedAt) : null;
  const ageDays = lastVerifiedAt ? (now.getTime() - lastVerifiedAt.getTime()) / (1000 * 60 * 60 * 24) : cfg.ageHalfLifeDays;

  const ageFactor = clamp01(ageDays / cfg.ageHalfLifeDays);
  const velocityFactor = clamp01((stats.unitsSold7d || 0) / 10);
  const valueFactor = clamp01(stats.normalizedValue || 0);
  const manualEditsFactor = clamp01((stats.manualEdits30d || 0) / 3);
  const priorVarianceFactor = clamp01((product.lastAbsVar || 0) / 3);

  const weighted = (ageFactor * 0.32) + (velocityFactor * 0.24) + (valueFactor * 0.18) + (manualEditsFactor * 0.14) + (priorVarianceFactor * 0.12);
  let risk = weighted * 100;

  if ((product.lastAbsVar || 0) >= 3 || (product.varianceCount || 0) > 0) {
    risk += cfg.highVarianceBoost;
  }

  return clampRisk(risk);
};

const queueSizeFromCatalog = (count) => {
  if (count < 1000) return 5;
  if (count <= 10000) return 8;
  if (count <= 40000) return 12;
  return 15;
};

const getStockVerificationSettings = (business) => ({
  ...DEFAULTS,
  ...(business?.settings?.stockVerification || {})
});

const generateVerificationQueue = async (businessId, options = {}) => {
  const now = options.now ? new Date(options.now) : new Date();
  const business = await Business.findById(businessId).select('settings').lean();
  const settings = getStockVerificationSettings(business);

  if (!settings.enabled) return { queue: [], settings, reason: 'disabled' };
  if (settings.snoozeUntil && new Date(settings.snoozeUntil) > now) return { queue: [], settings, reason: 'snoozed' };
  if (settings.lastNotificationAt && (now.getTime() - new Date(settings.lastNotificationAt).getTime()) < (1000 * 60 * 60 * 24)) {
    return { queue: [], settings, reason: 'notified_recently' };
  }

  const [products, recentNotification] = await Promise.all([
    Product.find({ businessId }).select('id name stock sellingPrice lastVerifiedAt varianceCount lastAbsVar updatedAt isManualUpdate').lean(),
    Notification.findOne({ businessId, type: 'stock_verification' }).sort({ timestamp: -1 }).lean()
  ]);

  if (recentNotification && (now.getTime() - new Date(recentNotification.timestamp).getTime()) < (1000 * 60 * 60 * 24)) {
    return { queue: [], settings, reason: 'notification_recent' };
  }

  const skuCount = products.length;
  if (skuCount === 0) return { queue: [], settings, reason: 'no_products' };

  const salesSince = new Date(now.getTime() - settings.velocityWindowDays * 24 * 60 * 60 * 1000);
  const txBusinessId = businessId;
  const salesAgg = await Transaction.aggregate([
    { $match: { businessId: new (require('mongoose')).Types.ObjectId(txBusinessId), transactionDate: { $gte: salesSince } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', unitsSold7d: { $sum: '$items.quantity' } } }
  ]).catch(() => []);

  const soldMap = new Map(salesAgg.map(r => [String(r._id), Number(r.unitsSold7d || 0)]));
  const values = products.map(p => Math.max(0, (p.stock || 0) * parsePrice(p.sellingPrice))).sort((a, b) => a - b);
  const p90 = values[Math.floor(values.length * 0.9)] || 1;

  const scored = products.map((p) => {
    const manualEdits30d = p.isManualUpdate && p.updatedAt && (now.getTime() - new Date(p.updatedAt).getTime()) <= (30 * 24 * 60 * 60 * 1000) ? 1 : 0;
    const score = computeRiskScore(p, {
      unitsSold7d: soldMap.get(String(p.id)) || 0,
      manualEdits30d,
      normalizedValue: clamp01(((p.stock || 0) * parsePrice(p.sellingPrice)) / p90)
    }, now, settings);

    return {
      productId: p.id,
      name: p.name,
      expectedQty: Number(p.stock || 0),
      riskScore: score,
      whyThisPicked: `Age/velocity/value risk ${score}/100`,
      lastVerifiedAt: p.lastVerifiedAt
    };
  });

  const cooldownMs = (settings.verifyCooldownHours || 24) * 60 * 60 * 1000;
  const eligible = scored
    .filter(item => !item.lastVerifiedAt || (now.getTime() - new Date(item.lastVerifiedAt).getTime()) >= cooldownMs * 2)
    .filter(item => item.riskScore >= settings.riskThreshold)
    .sort((a, b) => b.riskScore - a.riskScore);

  const dynamicN = queueSizeFromCatalog(skuCount);
  const queueLimit = Math.min(settings.maxQueuePerDay || 5, dynamicN);
  return {
    queue: eligible.slice(0, queueLimit),
    settings,
    reason: eligible.length ? 'ok' : 'below_threshold'
  };
};

const maybeCreateStockVerificationNotification = async (businessId) => {
  const { queue, settings } = await generateVerificationQueue(businessId);
  if (!queue.length) return null;

  const now = new Date();
  const payload = {
    kind: 'STOCK_VERIFY',
    productIds: queue.map(q => q.productId),
    scores: Object.fromEntries(queue.map(q => [q.productId, q.riskScore])),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  };

  const notification = await Notification.create({
    businessId,
    title: 'Stock verification recommended',
    message: `Verify ${queue.length} item${queue.length > 1 ? 's' : ''} today to keep stock accurate.`,
    body: `Verify ${queue.length} items today to keep stock accurate.`,
    type: 'stock_verification',
    amount: 0,
    performedBy: 'System',
    payload,
    timestamp: now
  });

  await Business.findByIdAndUpdate(businessId, {
    $set: {
      'settings.stockVerification.lastNotificationAt': now,
      'settings.stockVerification.maxQueuePerDay': settings.maxQueuePerDay
    }
  });

  return { notification, queue };
};

module.exports = {
  DEFAULTS,
  computeRiskScore,
  generateVerificationQueue,
  maybeCreateStockVerificationNotification,
  getStockVerificationSettings
};
