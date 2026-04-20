import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import connectDB from './config/db.js';
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

// Connect to MongoDB
connectDB();
removeUnverifiedAccounts();
expireNewArrivals();

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
      if (!origin || allowedOrigins.includes(origin)) {
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

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin-inventory', adminInventoryRoutes);
app.use('/api/admin', adminInventoryRoutes);
app.use('/api/admin-reports', adminReportRoutes);
app.use('/api/admin', adminReportRoutes);
app.use('/api/wishlist', wishListRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/bat-repairs', batRepairRoutes);
app.use('/api/expenses', expenseRoutes);


const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
