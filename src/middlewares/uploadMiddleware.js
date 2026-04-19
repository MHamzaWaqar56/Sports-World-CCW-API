import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { hasCloudinaryConfig } from '../config/cloudinary.js';

const uploadDir = path.resolve('uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const safeName = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    cb(null, `${safeName || 'product-image'}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const storage = hasCloudinaryConfig() ? multer.memoryStorage() : diskStorage;

function checkFileType(file, cb) {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/avif',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  } else {
    cb(new Error('Images only. Allowed formats: jpg, jpeg, png, webp, avif'));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

export default upload;
