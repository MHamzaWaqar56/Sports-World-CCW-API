import express from 'express';
import {
  getProducts,
  getFeaturedProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  generateProductDetails,
  createProductReview,
  deleteProductReview,
  updateProductReview,
  getTopReviews,
  
} from '../controllers/productController.js';
import { protect, seller } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

const productImageUpload = upload.fields([
  { name: 'images', maxCount: 8 },
  { name: 'variantImages', maxCount: 50 },
]);

router.get('/top-reviews', getTopReviews);
router.get('/featured', getFeaturedProducts);
router.route('/').get(getProducts).post(protect, seller, productImageUpload, createProduct);
router.route('/generate-details').post(protect, seller, generateProductDetails);
router
  .route('/:id')
  .get(getProductById)
  .put(protect, seller, productImageUpload, updateProduct)
  .delete(protect, seller, deleteProduct);


  // review routes
router.post('/:id/reviews', protect, createProductReview);
router.delete('/:id/reviews/:reviewId', protect, deleteProductReview);
router.put('/:id/reviews/:reviewId', protect, updateProductReview);


export default router;
