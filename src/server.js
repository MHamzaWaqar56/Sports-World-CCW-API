import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Product from './models/Product.js';
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';
import contactRoutes from './routes/contactRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminInventoryRoutes from './routes/adminInventoryRoutes.js';
import adminReportRoutes from './routes/adminReportRoutes.js';
import wishListRoutes from './routes/wishListRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import batRepairRoutes from './routes/batRepairRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import removeUnverifiedAccounts from './automation/RemoveUnverifiedUser.js';
import expireNewArrivals from './automation/ExpireNewArrivals.js';


dotenv.config();

const app = express();
const isVercel = Boolean(process.env.VERCEL);
let dbConnectionPromise = null;

const ensureDatabaseConnection = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      dbConnectionPromise ??= connectDB();
      await dbConnectionPromise;
    }

    next();
  } catch (error) {
    dbConnectionPromise = null;
    next(error);
  }
};

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]
  .flatMap((value) => (value ? value.split(',') : []))
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)  ||
  origin.includes("vercel.app")) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/products/featured', ensureDatabaseConnection, async (req, res, next) => {
  try {
    const products = await Product.find({ isFeatured: true }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/top-reviews', ensureDatabaseConnection, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 5;
    const products = await Product.find(
      { 'reviews.rating': 5 },
      { name: 1, reviews: 1, images: 1, image: 1 }
    );

    const allFiveStarReviews = [];

    for (const product of products) {
      for (const review of product.reviews) {
        if (review.rating === 5) {
          allFiveStarReviews.push({
            _id: review._id,
            name: review.name,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
            productName: product.name,
            productImage: product.images?.[0] || product.image || null,
          });
        }
      }
    }

    allFiveStarReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(allFiveStarReviews.slice(0, limit));
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:id/reviews', ensureDatabaseConnection, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    res.json({ reviews: product.reviews || [] });
  } catch (error) {
    next(error);
  }
});

app.use('/api/users', ensureDatabaseConnection, userRoutes);
app.use('/api/products', ensureDatabaseConnection, productRoutes);
app.use('/api/orders', ensureDatabaseConnection, orderRoutes);
app.use('/api/admin-inventory', ensureDatabaseConnection, adminInventoryRoutes);
app.use('/api/admin', ensureDatabaseConnection, adminInventoryRoutes);
app.use('/api/admin-reports', ensureDatabaseConnection, adminReportRoutes);
app.use('/api/admin', ensureDatabaseConnection, adminReportRoutes);
app.use('/api/wishlist', ensureDatabaseConnection, wishListRoutes);
app.use('/api/cart', ensureDatabaseConnection, cartRoutes);
app.use('/api/contact', ensureDatabaseConnection, contactRoutes);
app.use('/api/bat-repairs', ensureDatabaseConnection, batRepairRoutes);
app.use('/api/expenses', ensureDatabaseConnection, expenseRoutes);


const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use(notFound);
app.use(errorHandler);

if (!isVercel) {
  removeUnverifiedAccounts();
  expireNewArrivals();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
