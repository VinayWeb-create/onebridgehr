import { Router } from 'express';
import {
  applyLeave,
  reviewLeave,
  getLeaveHistory,
  getPendingRequests,
  getLeaveCalendar,
} from '../controllers/leaveController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/', applyLeave);
router.get('/history', getLeaveHistory);
router.get('/history/:employeeId', restrictTo('HR', 'SUPER_ADMIN', 'TEAM_LEAD'), getLeaveHistory);
router.get('/pending', restrictTo('TEAM_LEAD', 'HR', 'SUPER_ADMIN'), getPendingRequests);
router.get('/calendar', getLeaveCalendar);
router.patch('/:leaveId/review', restrictTo('TEAM_LEAD', 'HR', 'SUPER_ADMIN'), reviewLeave);

export default router;
