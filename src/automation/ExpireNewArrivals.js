import cron from 'node-cron';
import Product from '../models/Product.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const expireNewArrivals = () => {
  const runExpiryCheck = async () => {
    const expiryCutoff = new Date(Date.now() - SEVEN_DAYS_MS);

    await Product.updateMany(
      {
        isNewArrival: true,
        createdAt: { $lt: expiryCutoff },
      },
      {
        $set: { isNewArrival: false },
      }
    );
  };

  runExpiryCheck().catch((error) => {
    console.error('Failed to run new arrival expiry check on startup', error);
  });

  cron.schedule('0 * * * *', async () => {
    try {
      await runExpiryCheck();
    } catch (error) {
      console.error('Failed to expire new arrival products', error);
    }
  });
};

export default expireNewArrivals;
