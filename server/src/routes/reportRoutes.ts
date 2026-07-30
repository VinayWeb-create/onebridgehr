import { Router } from 'express';
import {
  getHRDashboardStats,
  getEmployeeDashboardStats,
  globalSearch,
} from '../controllers/reportController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/hr', restrictTo('HR', 'SUPER_ADMIN'), getHRDashboardStats);
router.get('/employee', getEmployeeDashboardStats);
router.get('/search', globalSearch);

export default router;
