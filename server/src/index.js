require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');

const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const paymentRoutes = require('./routes/payments');
const analyticsRoutes = require('./routes/analytics');
const entitlementsRoutes = require('./routes/entitlements');

const app = express();

app.use(compression());

app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
  credentials: true
}));

app.use(express.json({
  limit: '20mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/entitlements', entitlementsRoutes);

const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || '';

mongoose.connect(mongoUri, { autoIndex: true })
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on ${port}`);
    });

    if (paymentRoutes.reconcilePending) {
      paymentRoutes.reconcilePending();
      setInterval(() => {
        paymentRoutes.reconcilePending();
      }, 10 * 60 * 1000);
    }
  })
  .catch(err => {
    console.error('Mongo connection failed', err);
    process.exit(1);
  });
