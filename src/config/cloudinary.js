import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();
const getTrimmedEnvValue = (key) => String(process.env[key] || '').trim();

const hasCloudinaryConfig = () =>
  Boolean(
    getTrimmedEnvValue('CLOUDINARY_CLOUD_NAME') &&
      getTrimmedEnvValue('CLOUDINARY_API_KEY') &&
      getTrimmedEnvValue('CLOUDINARY_API_SECRET')
  );

if (hasCloudinaryConfig()) {
  cloudinary.config({
    cloud_name: getTrimmedEnvValue('CLOUDINARY_CLOUD_NAME'),
    api_key: getTrimmedEnvValue('CLOUDINARY_API_KEY'),
    api_secret: getTrimmedEnvValue('CLOUDINARY_API_SECRET'),
  });
}

export { cloudinary, hasCloudinaryConfig };
