import express from 'express';
import {
  createExpense,
  deleteExpense,
  getExpenses,
  updateExpense,
} from '../controllers/expenseController.js';
import { protect, seller } from '../middlewares/authMiddleware.js';

const router = express.Router();

router
  .route('/')
  .get(protect, seller, getExpenses)
  .post(protect, seller, createExpense);

router
  .route('/:id')
  .put(protect, seller, updateExpense)
  .delete(protect, seller, deleteExpense);

export default router;