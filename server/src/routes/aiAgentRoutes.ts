import { Router } from 'express';
import {
  getAiWorkforceStatus,
  getAiEventStream,
  getAiDecisionLogs,
  getPendingEscalations,
  approveEscalation,
  getDiscoveryDocuments,
  getCeoBriefing,
  triggerAutonomousSimulation,
} from '../controllers/aiAgentController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

// Protect all AI Command Center routes for Super Admins
router.use(protect);
router.use(restrictTo('SUPER_ADMIN'));

router.get('/workforce', getAiWorkforceStatus);
router.get('/events', getAiEventStream);
router.get('/decisions', getAiDecisionLogs);
router.get('/escalations', getPendingEscalations);
router.post('/escalations/:id/approve', approveEscalation);
router.get('/discovery-documents', getDiscoveryDocuments);
router.get('/ceo-briefing', getCeoBriefing);
router.post('/simulate', triggerAutonomousSimulation);

export default router;
