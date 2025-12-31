require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const expendituresRouter = require('./routes/expenditures');
const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const paymentRoutes = require('./routes/payments');
const analyticsRoutes = require('./routes/analytics');
const entitlementsRoutes = require('./routes/entitlements');
const { archiveInactiveBusinesses } = require('./services/archiver');

const app = express();

// Set security HTTP headers
app.use(helmet());

app.use(compression());

app.use(cors({
  // In production, default to false (block) if variable is missing, otherwise allow all (*) for dev
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : (process.env.NODE_ENV === 'production' ? false : '*'),
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
app.use('/api/entitlements', entitlementsRoutes);
app.use('/api/expenditures', expendituresRouter);

const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || '';

if (require.main === module) {
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

      // Schedule daily archival task
      setInterval(archiveInactiveBusinesses, 24 * 60 * 60 * 1000);
      archiveInactiveBusinesses(); // Run once on startup
    })
    .catch(err => {
      console.error('Mongo connection failed', err);
      process.exit(1);
    });
}

module.exports = app;
