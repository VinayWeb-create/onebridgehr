import { Router } from 'express';
import {
  registerEmployee,
  updateEmployee,
  getEmployee,
  getEmployeesList,
  uploadSignature,
  uploadProfileImage,
  uploadDocument,
  deleteEmployee,
} from '../controllers/employeeController';
import { protect, restrictTo } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(protect);

router.post('/', restrictTo('SUPER_ADMIN', 'HR'), registerEmployee);
router.get('/', getEmployeesList);
router.get('/:employeeId', getEmployee);
router.put('/:employeeId', updateEmployee);
router.delete('/:employeeId', restrictTo('SUPER_ADMIN', 'HR'), deleteEmployee);

// File uploads
router.post('/:employeeId/signature', upload.single('signature'), uploadSignature);
router.post('/:employeeId/profile-image', upload.single('profileImage'), uploadProfileImage);
router.post('/:employeeId/document', upload.single('document'), uploadDocument);

export default router;
