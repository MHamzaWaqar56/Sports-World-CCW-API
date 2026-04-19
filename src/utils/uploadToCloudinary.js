import path from 'path';
import { cloudinary, hasCloudinaryConfig } from '../config/cloudinary.js';

const sanitizeFileName = (fileName = 'product-image') =>
  path
    .basename(fileName, path.extname(fileName))
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'product-image';

export const uploadBufferToCloudinary = (file, folder = 'sports-world/products') =>
  new Promise((resolve, reject) => {
    if (!hasCloudinaryConfig()) {
      reject(new Error('Cloudinary is not configured'));
      return;
    }

    const publicId = `${sanitizeFileName(file.originalname)}-${Date.now()}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result.secure_url);
      }
    );

    uploadStream.end(file.buffer);
  });
