const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleAccess');

const router = express.Router();
const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;

const mimeExtensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function uploadDir() {
  return path.join(__dirname, '..', 'uploads', 'products');
}

router.use(authMiddleware);

router.post('/product-image', requireRoles(), express.raw({ type: 'image/*', limit: '2mb' }), async (req, res, next) => {
  try {
    let type = req.get('content-type') || '';
    let buffer = Buffer.isBuffer(req.body) ? req.body : null;

    if (!buffer) {
      const { dataUrl, mimeType } = req.body || {};
      const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Imagen invalida' });
      }
      type = mimeType || match[1];
      buffer = Buffer.from(match[2], 'base64');
    }

    const extension = mimeExtensions[type];
    if (!extension) {
      return res.status(400).json({ error: 'Formato de imagen no permitido' });
    }

    if (!buffer.length || buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
      return res.status(400).json({ error: 'La imagen debe pesar menos de 2 MB' });
    }

    fs.mkdirSync(uploadDir(), { recursive: true });
    const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const filepath = path.join(uploadDir(), filename);
    fs.writeFileSync(filepath, buffer);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.status(201).json({ url: `${baseUrl}/api/uploads/products/${filename}` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
