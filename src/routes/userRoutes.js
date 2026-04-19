import express from 'express';
import {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  verifyOTPController,
  forgotPasswordController,
  resetPasswordController
} from '../controllers/userController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', registerUser);
router.post("/otp-verification", verifyOTPController);
router.post('/auth', authUser);
router.post('/login', authUser);
router.post("/password/forgot", forgotPasswordController);
router.post("/password/reset/:token", resetPasswordController);

router.post('/logout', logoutUser);
router.get('/profile', protect, getUserProfile);

export default router;