import { Router } from 'express';
import {
  uploadAndParseStatement,
  convertParsedToInvoicesOrExpenses,
  getStatementLogs,
} from '../controllers/documentOcrController';
import { protect, restrictTo } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Strict Super Admin Access Only
router.use(protect);
router.use(restrictTo('SUPER_ADMIN'));

router.post('/upload', upload.single('statement'), uploadAndParseStatement);
router.post('/convert', convertParsedToInvoicesOrExpenses);
router.get('/logs', getStatementLogs);

export default router;
