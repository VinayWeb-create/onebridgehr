import { Router } from 'express';
import {
  getLedgers,
  createLedger,
  initializeChartOfAccounts,
  getVouchers,
  createVoucher,
  getCaAccountingSummary,
  exportTallyReport,
} from '../controllers/caFinanceController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

// Strict Super Admin Access Only
router.use(protect);
router.use(restrictTo('SUPER_ADMIN'));

router.get('/ledgers', getLedgers);
router.post('/ledgers', createLedger);
router.post('/ledgers/init', initializeChartOfAccounts);

router.get('/vouchers', getVouchers);
router.post('/vouchers', createVoucher);

router.get('/summary', getCaAccountingSummary);
router.get('/export-tally', exportTallyReport);

export default router;
