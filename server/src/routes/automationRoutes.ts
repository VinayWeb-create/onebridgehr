import { Router } from 'express';
import {
  getTemplates,
  updateTemplate,
  getCommunicationLogs,
} from '../controllers/automationController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

// Strict Super Admin Access Only
router.use(protect);
router.use(restrictTo('SUPER_ADMIN'));

router.get('/templates', getTemplates);
router.put('/templates/:id', updateTemplate);
router.get('/logs', getCommunicationLogs);

export default router;
