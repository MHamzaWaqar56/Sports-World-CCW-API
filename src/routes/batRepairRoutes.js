import express from 'express';
import {
  createBatRepair,
  deleteBatRepair,
  getBatRepairs,
} from '../controllers/batRepairController.js';
import { protect, seller } from '../middlewares/authMiddleware.js';

const router = express.Router();

router
  .route('/')
  .get(protect, seller, getBatRepairs)
  .post(protect, seller, createBatRepair);

router.route('/:id').delete(protect, seller, deleteBatRepair);

export default router;