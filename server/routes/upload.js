const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { bucket } = require('../firebase-admin');
const { verifyToken } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Тільки зображення'), false);
    }
    cb(null, true);
  },
});

// POST /api/upload — завантажити фото у Firebase Storage
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не знайдено' });

    const ext = req.file.originalname.split('.').pop();
    const filename = `products/${uuidv4()}.${ext}`;
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
    });

    await file.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
