import { Router } from 'express';
import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  testPushNotification,
  triggerCheckoutRemindersManual,
} from '../controllers/notificationController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/push-subscription', subscribePush);
router.post('/push-unsubscribe', unsubscribePush);
router.post('/test-push', testPushNotification);
router.post('/trigger-checkout-reminder', restrictTo('SUPER_ADMIN', 'HR'), triggerCheckoutRemindersManual);

export default router;
