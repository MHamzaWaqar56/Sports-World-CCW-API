import express from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  toggleWishlist,
} from '../controllers/wishListController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Get user's wishlist
router.route('/').get(protect, getWishlist);

// Add item to wishlist
router.post('/add', protect, addToWishlist);

// Remove item from wishlist
router.post('/remove', protect, removeFromWishlist);

// Clear entire wishlist
router.delete('/clear', protect, clearWishlist);

// 🔹 Toggle wishlist (add/remove with one button)
router.post('/toggle', protect, toggleWishlist);

export default router;