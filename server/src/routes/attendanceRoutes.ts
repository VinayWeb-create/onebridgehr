import { Router } from 'express';
import {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getTodayStatus,
  getHistory,
  getOrganizationAttendance,
  generateDailyAttendanceCode,
  getTodayAttendanceCode,
  checkInWithCode,
  checkInWithQR,
  checkInWithGPS,
  getAttendanceDashboard,
  getAttendanceReport,
  exportAttendanceReportCSV,
} from '../controllers/attendanceController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/code/generate', restrictTo('SUPER_ADMIN'), generateDailyAttendanceCode);
router.get('/code/today', restrictTo('SUPER_ADMIN', 'HR'), getTodayAttendanceCode);

router.post('/checkin/code', checkInWithCode);
router.post('/checkin/qr', checkInWithQR);
router.post('/checkin/gps', checkInWithGPS);

router.get('/dashboard', getAttendanceDashboard);
router.get('/report', getAttendanceReport);
router.get('/report/export', exportAttendanceReportCSV);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.post('/break/start', startBreak);
router.post('/break/end', endBreak);
router.get('/today', getTodayStatus);
router.get('/history', getHistory);
router.get('/history/:employeeId', restrictTo('HR', 'SUPER_ADMIN', 'TEAM_LEAD'), getHistory);
router.get('/organization', restrictTo('HR', 'SUPER_ADMIN'), getOrganizationAttendance);

export default router;
