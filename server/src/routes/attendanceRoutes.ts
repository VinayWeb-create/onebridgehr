import { Router } from 'express';
import {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getTodayStatus,
  getHistory,
  getOrganizationAttendance,
} from '../controllers/attendanceController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.post('/break/start', startBreak);
router.post('/break/end', endBreak);
router.get('/today', getTodayStatus);
router.get('/history', getHistory);
router.get('/history/:employeeId', restrictTo('HR', 'SUPER_ADMIN', 'TEAM_LEAD'), getHistory);
router.get('/organization', restrictTo('HR', 'SUPER_ADMIN'), getOrganizationAttendance);

export default router;
