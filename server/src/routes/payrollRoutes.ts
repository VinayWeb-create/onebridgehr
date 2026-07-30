import { Router } from 'express';
import {
  generatePayroll,
  getPayrollHistory,
  getAllPayrolls,
  emailPayslip,
} from '../controllers/payrollController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/', restrictTo('HR', 'SUPER_ADMIN'), generatePayroll);
router.get('/my-history', getPayrollHistory);
router.get('/history/:employeeId', restrictTo('HR', 'SUPER_ADMIN'), getPayrollHistory);
router.get('/all', restrictTo('HR', 'SUPER_ADMIN'), getAllPayrolls);
router.post('/:payrollId/email', restrictTo('HR', 'SUPER_ADMIN'), emailPayslip);

export default router;
