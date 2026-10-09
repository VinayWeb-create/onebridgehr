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
import {
  getOffices,
  createOffice,
  updateOffice,
  deleteOffice,
  getAttendancePolicies,
  saveAttendancePolicy,
  getEnrollmentStatus,
  completeEnrollment,
  resetEmployeeEnrollment,
  clearTodayAttendance,
  clearAllTodayAttendance,
  smartVerifyAndMark,
  getSmartAttendanceDashboard,
  getVerificationLogs,
} from '../controllers/smartAttendanceController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

// -------------------------------------------------------------
// SMART BIOMETRIC ATTENDANCE EXTENSION
// -------------------------------------------------------------

// 1. Office Location Management (Admin / HR)
router.get('/offices', getOffices);
router.post('/offices', restrictTo('SUPER_ADMIN', 'HR'), createOffice);
router.put('/offices/:id', restrictTo('SUPER_ADMIN', 'HR'), updateOffice);
router.delete('/offices/:id', restrictTo('SUPER_ADMIN', 'HR'), deleteOffice);

// 2. Attendance Policy Management (Admin / HR)
router.get('/policy', getAttendancePolicies);
router.post('/policy', restrictTo('SUPER_ADMIN', 'HR'), saveAttendancePolicy);
router.put('/policy/:id', restrictTo('SUPER_ADMIN', 'HR'), saveAttendancePolicy);

// 3. Employee Enrollment (One-Time Setup) & Administrative Resets
router.get('/enrollment/status', getEnrollmentStatus);
router.post('/enrollment/complete', completeEnrollment);
router.post('/enrollment/reset/:employeeId', restrictTo('SUPER_ADMIN', 'HR'), resetEmployeeEnrollment);
router.delete('/enrollment/reset/:employeeId', restrictTo('SUPER_ADMIN', 'HR'), resetEmployeeEnrollment);

// 4. Admin Attendance Clearing (Today single employee / Today all employees)
router.delete('/admin/today-all', restrictTo('SUPER_ADMIN', 'HR'), clearAllTodayAttendance);
router.delete('/admin/today/:employeeId', restrictTo('SUPER_ADMIN', 'HR'), clearTodayAttendance);

// 5. Daily Smart Biometric Auto-Verification & Check-in
router.post('/smart/verify-and-mark', smartVerifyAndMark);

// 6. Smart Attendance Dashboard & Logs (Admin / HR)
router.get('/smart/dashboard', restrictTo('SUPER_ADMIN', 'HR'), getSmartAttendanceDashboard);
router.get('/smart/logs', restrictTo('SUPER_ADMIN', 'HR'), getVerificationLogs);

// -------------------------------------------------------------
// LEGACY / EXISTING ATTENDANCE ROUTES (PRESERVED)
// -------------------------------------------------------------

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
