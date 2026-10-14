import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getAdminNotificationConfig,
  updateAdminNotificationConfig,
  createMeeting,
  getMeetings,
  updateMeeting,
  cancelMeeting,
  createAnnouncement,
  getAnnouncements,
  triggerChatEvent,
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  testPushNotification,
  triggerCheckoutRemindersManual,
  triggerCheckInRemindersManual,
  triggerGreetingManual,
} from '../controllers/notificationController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

// 1. Notification Center (Feed, Count, Actions)
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markAsRead);
router.post('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);

// 2. User Settings (Preferences)
router.get('/preferences', getUserNotificationPreferences);
router.put('/preferences', updateUserNotificationPreferences);

// 3. Admin Settings (Reminder Times & Notification Templates)
router.get('/admin/config', restrictTo('SUPER_ADMIN', 'HR'), getAdminNotificationConfig);
router.put('/admin/config', restrictTo('SUPER_ADMIN', 'HR'), updateAdminNotificationConfig);

// 4. Meetings & Reminders
router.post('/meetings', createMeeting);
router.get('/meetings', getMeetings);
router.put('/meetings/:id', updateMeeting);
router.post('/meetings/:id/cancel', cancelMeeting);

// 5. Announcements
router.post('/announcements', restrictTo('SUPER_ADMIN', 'HR'), createAnnouncement);
router.get('/announcements', getAnnouncements);

// 6. Chat Events
router.post('/chat-event', triggerChatEvent);

// 7. Push Notifications & Manual Testing (Preserved)
router.get('/vapid-public-key', getVapidPublicKey);
router.post('/push-subscription', subscribePush);
router.post('/push-unsubscribe', unsubscribePush);
router.post('/test-push', testPushNotification);
router.post('/trigger-checkout-reminder', restrictTo('SUPER_ADMIN', 'HR'), triggerCheckoutRemindersManual);
router.post('/trigger-checkin-reminder', restrictTo('SUPER_ADMIN', 'HR'), triggerCheckInRemindersManual);
router.post('/trigger-greeting', restrictTo('SUPER_ADMIN', 'HR'), triggerGreetingManual);

export default router;
