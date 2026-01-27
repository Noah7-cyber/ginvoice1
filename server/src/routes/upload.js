
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const requireAuth = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/subscription');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/', requireAuth, requireActiveSubscription, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // 1. Optimize image buffer with sharp
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    // 2. Wrap Cloudinary upload in a Promise to prevent 500 errors/hangs
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'ginvoice_uploads' },
          (error, result) => {
            if (result) resolve(result.secure_url);
            else reject(error);
          }
        );
        stream.end(optimizedBuffer);
      });
    };

    const url = await uploadToCloudinary();
    res.json({ url });

  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: 'Cloudinary configuration or stream error' });
  }
});

module.exports = router;
