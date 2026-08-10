import { Router } from 'express';
import multer from 'multer';
import { protect, restrictTo } from '../middleware/auth';
import {
  getPortal,
  getPortalTemplate,
  saveChanges,
  submitDocuments,
  getOnboardings,
  getOnboardingDetail,
  getCandidates,
  createCandidate,
  sendOfferLetter,
  startVerification,
  verify,
  sendJoiningLetter,
  markJoined,
  sendCredentials,
  completeOnboarding,
  processNow,
  activate,
  bulkAction,
  acceptOffer,
  autoAccept,
  getMyOnboarding,
  getMyOnboardingTemplate,
  saveMyOnboarding,
  submitMyDocuments,
} from '../controllers/onboardingController';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max per file
});

// Public candidate portal routes — no auth required
router.get('/portal/:token', getPortal);
router.get('/portal/:token/template', getPortalTemplate);
router.post('/portal/:token/save', saveChanges);
router.post('/portal/:token/accept', acceptOffer);
router.get('/portal/:token/auto-accept', autoAccept);
router.post(
  '/portal/:token/submit',
  upload.fields([
    { name: 'aadhaar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'certificates', maxCount: 5 },
    { name: 'passportPhoto', maxCount: 1 },
    { name: 'bankPassbook', maxCount: 1 },
    { name: 'experienceLetter', maxCount: 1 },
    { name: 'relievingLetter', maxCount: 1 },
    { name: 'nda', maxCount: 1 },
    { name: 'otherDocuments', maxCount: 5 },
  ]),
  submitDocuments
);

// Authenticated routes (require login)
router.use(protect);

// Employee self-service onboarding (any logged-in employee)
router.get('/my-onboarding', getMyOnboarding);
router.get('/my-onboarding/template', getMyOnboardingTemplate);
router.post('/my-onboarding/save', saveMyOnboarding);
router.post(
  '/my-onboarding/submit',
  upload.fields([
    { name: 'aadhaar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'certificates', maxCount: 5 },
    { name: 'passportPhoto', maxCount: 1 },
    { name: 'bankPassbook', maxCount: 1 },
    { name: 'experienceLetter', maxCount: 1 },
    { name: 'relievingLetter', maxCount: 1 },
    { name: 'nda', maxCount: 1 },
    { name: 'otherDocuments', maxCount: 5 },
  ]),
  submitMyDocuments
);

// HR-only routes
router.get('/', restrictTo('SUPER_ADMIN', 'HR'), getOnboardings);
router.get('/candidates', restrictTo('SUPER_ADMIN', 'HR'), getCandidates);
router.post('/candidates', restrictTo('SUPER_ADMIN', 'HR'), createCandidate);
router.post('/send', restrictTo('SUPER_ADMIN', 'HR'), sendOfferLetter);
router.post('/bulk', restrictTo('SUPER_ADMIN', 'HR'), bulkAction);
router.get('/:id', restrictTo('SUPER_ADMIN', 'HR'), getOnboardingDetail);
router.post('/:id/start-verification', restrictTo('SUPER_ADMIN', 'HR'), startVerification);
router.post('/:id/verify', restrictTo('SUPER_ADMIN', 'HR'), verify);
router.post('/:id/joining-letter', restrictTo('SUPER_ADMIN', 'HR'), sendJoiningLetter);
router.post('/:id/joined', restrictTo('SUPER_ADMIN', 'HR'), markJoined);
router.post('/:id/process', restrictTo('SUPER_ADMIN', 'HR'), processNow);
router.post('/:id/activate', restrictTo('SUPER_ADMIN', 'HR'), activate);
router.post('/:id/send-credentials', restrictTo('SUPER_ADMIN', 'HR'), sendCredentials);
router.post('/:id/complete', restrictTo('SUPER_ADMIN', 'HR'), completeOnboarding);

export default router;

