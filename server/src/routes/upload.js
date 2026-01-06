
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const requireAuth = require('../middleware/auth');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Optimize with Sharp
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true }) // Max width 800px
      .jpeg({ quality: 80 }) // 80% quality
      .toBuffer();

    // Upload to Cloudinary using upload_stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'ginvoice_uploads',
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({ error: 'Upload failed' });
        }
        res.json({ url: result.secure_url });
      }
    );

    uploadStream.end(optimizedBuffer);

  } catch (err) {
    console.error('Upload processing error:', err);
    res.status(500).json({ error: 'Server error during upload' });
  }
});

module.exports = router;
