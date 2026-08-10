import { Router } from 'express';
import {
  createOfferLetter,
  getOfferLetters,
  getOfferLetter,
  updateOfferLetter,
  approveOfferLetter,
  generateOfferLetterDocx,
  generateOfferLetterPdf,
  sendOfferLetterEmail,
  approveAndCreateEmployeeWorkflow,
  uploadOfferLetterPdf,
  generateHRDocument,
  listHRDocuments,
  getAllHolidays,
  addHoliday,
  deleteHoliday,
  getTimelineEvents,
} from '../controllers/hrDocumentController';
import { protect, restrictTo } from '../middleware/auth';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });

const router = Router();

router.use(protect);

router.get('/timeline/:employeeId', getTimelineEvents);

router.get('/holidays', getAllHolidays);
router.post('/holidays', restrictTo('SUPER_ADMIN', 'HR'), addHoliday);
router.delete('/holidays/:id', restrictTo('SUPER_ADMIN', 'HR'), deleteHoliday);

router.get('/documents', listHRDocuments);
router.post('/documents', restrictTo('SUPER_ADMIN', 'HR'), generateHRDocument);

router.get('/offer-letters', getOfferLetters);
router.post('/offer-letters', restrictTo('SUPER_ADMIN', 'HR'), createOfferLetter);
router.get('/offer-letters/:id', getOfferLetter);
router.put('/offer-letters/:id', restrictTo('SUPER_ADMIN', 'HR'), updateOfferLetter);
router.post('/offer-letters/:id/approve', restrictTo('SUPER_ADMIN', 'HR'), approveOfferLetter);
router.get('/offer-letters/:id/generate-docx', generateOfferLetterDocx);
router.get('/offer-letters/:id/generate-pdf', generateOfferLetterPdf);
router.post('/offer-letters/:id/send-email', restrictTo('SUPER_ADMIN', 'HR'), sendOfferLetterEmail);
router.post('/offer-letters/:id/upload-pdf', restrictTo('SUPER_ADMIN', 'HR'), upload.single('pdf'), uploadOfferLetterPdf);
router.post('/offer-letters/:id/approve-create-employee', restrictTo('SUPER_ADMIN', 'HR'), approveAndCreateEmployeeWorkflow);

export default router;
