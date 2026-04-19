import express from 'express';
import {
  exportSalesReport,
  getBusinessSummary,
  getSalesReport,
} from '../controllers/adminReportController.js';
import { protect, seller } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/business-summary', protect, seller, getBusinessSummary);
router.get('/sales-report', protect, seller, getSalesReport);
router.get('/export-sales', protect, seller, exportSalesReport);

export default router;
