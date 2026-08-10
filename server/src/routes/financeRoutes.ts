import { Router } from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getFinanceDashboard,
  exportFinanceReport,
} from '../controllers/financeController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/', restrictTo('SUPER_ADMIN', 'HR'), createTransaction);
router.get('/', getTransactions);
router.get('/dashboard', getFinanceDashboard);
router.get('/export', exportFinanceReport);
router.get('/:id', getTransactionById);
router.put('/:id', restrictTo('SUPER_ADMIN', 'HR'), updateTransaction);
router.delete('/:id', restrictTo('SUPER_ADMIN', 'HR'), deleteTransaction);

export default router;
