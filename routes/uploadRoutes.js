const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleAccess');

const router = express.Router();
const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VOUCHER_IMAGE_BYTES = 5 * 1024 * 1024;

const mimeExtensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function safeFolderName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function companyUploadFolder(user = {}) {
  return safeFolderName(user.companySlug)
    || safeFolderName(user.companyDatabase)
    || (user.companyId ? `company-${user.companyId}` : 'master');
}

function uploadDir(user) {
  return path.join(__dirname, '..', 'uploads', companyUploadFolder(user), 'products');
}

function voucherUploadDir(user) {
  return path.join(__dirname, '..', 'uploads', companyUploadFolder(user), 'pos-vouchers');
}

function imageBufferFromRequest(req) {
  let type = req.get('content-type') || '';
  let buffer = Buffer.isBuffer(req.body) ? req.body : null;

  if (!buffer) {
    const { dataUrl, mimeType } = req.body || {};
    const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      const error = new Error('Imagen invalida');
      error.status = 400;
      throw error;
    }
    type = mimeType || match[1];
    buffer = Buffer.from(match[2], 'base64');
  }

  return { type, buffer };
}

router.use(authMiddleware);

router.post('/product-image', requireRoles('administrativo', 'operativo'), express.raw({ type: 'image/*', limit: '2mb' }), async (req, res, next) => {
  try {
    const { type, buffer } = imageBufferFromRequest(req);

    const extension = mimeExtensions[type];
    if (!extension) {
      return res.status(400).json({ error: 'Formato de imagen no permitido' });
    }

    if (!buffer.length || buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
      return res.status(400).json({ error: 'La imagen debe pesar menos de 2 MB' });
    }

    const companyFolder = companyUploadFolder(req.user);
    const targetDir = uploadDir(req.user);
    fs.mkdirSync(targetDir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const filepath = path.join(targetDir, filename);
    fs.writeFileSync(filepath, buffer);

    res.status(201).json({ url: `/api/uploads/${companyFolder}/products/${filename}` });
  } catch (err) {
    next(err);
  }
});

router.post('/pos-voucher', requireRoles('admin_tienda', 'administrativo', 'vendedor_tienda'), express.raw({ type: 'image/*', limit: '5mb' }), async (req, res, next) => {
  try {
    const { type, buffer } = imageBufferFromRequest(req);
    const extension = mimeExtensions[type];
    if (!extension) {
      return res.status(400).json({ error: 'Formato de imagen no permitido' });
    }

    if (!buffer.length || buffer.length > MAX_VOUCHER_IMAGE_BYTES) {
      return res.status(400).json({ error: 'La imagen debe pesar menos de 5 MB' });
    }

    const companyFolder = companyUploadFolder(req.user);
    const targetDir = voucherUploadDir(req.user);
    fs.mkdirSync(targetDir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const filepath = path.join(targetDir, filename);
    fs.writeFileSync(filepath, buffer);

    res.status(201).json({ url: `/api/uploads/${companyFolder}/pos-vouchers/${filename}` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
