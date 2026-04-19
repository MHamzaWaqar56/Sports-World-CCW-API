// import express from 'express';
// import {
//   addOrderItems,
//   getOrderById,
//   updateOrderToPaid,
//   updateOrderToDelivered,
//   deleteOrder,
//   getMyOrders,
//   getOrders,
//   cancelOrder,
// } from '../controllers/orderController.js';
// import { protect, seller } from '../middlewares/authMiddleware.js';
// import { createPromo, validatePromo, getAllPromos, togglePromo, getPromoStats, deletePromo, deleteExpiredPromos, } from '../controllers/promoController.js';

// const router = express.Router();

// router.route('/').post(protect, addOrderItems).get(protect, seller, getOrders);
// router.route('/myorders').get(protect, getMyOrders);
// router.route('/:id').get(protect, getOrderById);
// router.route('/:id').delete(protect, seller, deleteOrder);
// router.route('/:id/pay').put(protect, updateOrderToPaid);
// router.route('/:id/deliver').put(protect, seller, updateOrderToDelivered);
// router.put('/:id/cancel', protect, cancelOrder);
// router.post('/promo/validate', validatePromo);
// router.post('/create-promo', protect, seller, createPromo);
// router.get('/promos',  getAllPromos);
// router.delete('/promos/expired', protect, seller, deleteExpiredPromos);
// router.patch('/promo/:id/toggle', protect, seller, togglePromo);
// router.get('/promo/:id/stats', protect, seller, getPromoStats);
// router.delete('/promo/:id', protect, seller, deletePromo);

// export default router;




import express from 'express';
import {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDispatched,
  updateOrderToDelivered,
  deleteOrder,
  getMyOrders,
  getOrders,
  cancelOrder,
  updateCancelledOrderReason,
} from '../controllers/orderController.js';
import { protect, seller } from '../middlewares/authMiddleware.js';
import {
  createPromo,
  validatePromo,
  getAllPromos,
  togglePromo,
  getPromoStats,
  deletePromo,
  deleteExpiredPromos,
} from '../controllers/promoController.js';

const router = express.Router();

// ✅ SPECIFIC routes — sab se pehle (koi bhi hardcoded string)
router.get('/myorders',               protect, getMyOrders);
router.post('/promo/validate',        validatePromo);
router.post('/create-promo',          protect, seller, createPromo);
router.get('/promos',                 protect, seller, getAllPromos);
router.delete('/promos/expired',      protect, seller, deleteExpiredPromos);

// ✅ :id wali routes — baad mein
router.get('/promo/:id/stats',        protect, seller, getPromoStats);
router.patch('/promo/:id/toggle',     protect, seller, togglePromo);
router.delete('/promo/:id',           protect, seller, deletePromo);

// ✅ Generic /:id routes — sab se last mein
router.route('/').post(protect, addOrderItems).get(protect, seller, getOrders);
router.get('/:id',                    protect, getOrderById);
router.delete('/:id',                 protect, seller, deleteOrder);
router.put('/:id/pay',                protect, updateOrderToPaid);
router.put('/:id/dispatch',           protect, seller, updateOrderToDispatched);
router.put('/:id/deliver',            protect, seller, updateOrderToDelivered);
router.put('/:id/cancel',             protect, cancelOrder);
router.put('/:id/cancel-reason',      protect, seller, updateCancelledOrderReason);

export default router;