const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');
const path = require('path');
const Business = require('./server/src/models/Business');
const Product = require('./server/src/models/Product');

(async () => {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  console.log(`Mongo Memory Server started at ${uri}`);

  // Seed Data
  await mongoose.connect(uri);
  const hashedPassword = await bcrypt.hash('1234', 10);
  const business = await Business.create({
      name: 'Test Shop',
      email: 'test@shop.com',
      phone: '0000000000',
      ownerPin: hashedPassword,
      staffPin: hashedPassword,
      trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      emailVerified: true,
      settings: {},
      staffPermissions: {}
  });

  await Product.create({
      businessId: business._id,
      id: 'prod-1',
      name: 'Test Product',
      stock: 100,
      sellingPrice: 5000,
      costPrice: 4000,
      baseUnit: 'Piece',
      units: []
  });

  console.log('Seeded verified business: test@shop.com / 1234');
  await mongoose.disconnect();

  // Start Backend
  const backend = spawn('node', ['src/index.js'], {
    cwd: path.resolve(__dirname, 'server'),
    env: { ...process.env, MONGODB_URI: uri, PORT: '4000', JWT_SECRET: 'secret' },
    stdio: 'inherit'
  });

  backend.on('error', (err) => console.error('Backend failed:', err));

  // Start Frontend
  const frontend = spawn('npm', ['run', 'dev', '--', '--port', '5173', '--strictPort'], {
    cwd: path.resolve(__dirname, 'client'),
    env: { ...process.env, VITE_API_URL: 'http://localhost:4000' },
    stdio: 'inherit'
  });

  frontend.on('error', (err) => console.error('Frontend failed:', err));

  // Keep alive
  await new Promise(() => {});
})();
