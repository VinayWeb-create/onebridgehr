import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth';
import { upload } from '../../middleware/upload';
import * as c from './controllers/plannerController';

/**
 * Smart Tasks & Reminders REST API — mounted at /api/planner.
 * Every route except the token-scoped notification action requires a session.
 */
const router = Router();

// Service-worker notification buttons (no session available inside the SW).
router.post('/reminders/action', c.reminderActionByToken);

router.use(protect);

router.get('/meta', c.getMeta);
router.get('/dashboard', c.getDashboard);

// Tasks
router.get('/tasks', c.listTasks);
router.post('/tasks', c.createTask);
router.post('/tasks/quick', c.quickAdd);
router.post('/sync', c.syncBatch);
router.get('/tasks/:id', c.getTask);
router.patch('/tasks/:id', c.updateTask);
router.delete('/tasks/:id', c.deleteTask);
router.patch('/tasks/:id/move', c.moveTask);
router.post('/tasks/:id/complete', c.completeTask);
router.post('/tasks/:id/reopen', c.reopenTask);
router.post('/tasks/:id/archive', c.archiveTask);
router.post('/tasks/:id/snooze', c.snooze);
router.get('/tasks/:id/history', c.getHistory);

// Checklist, comments, attachments
router.post('/tasks/:id/checklist', c.addChecklistItem);
router.patch('/tasks/:id/checklist/:itemId', c.updateChecklistItem);
router.delete('/tasks/:id/checklist/:itemId', c.deleteChecklistItem);
router.post('/tasks/:id/comments', c.addComment);
router.delete('/tasks/:id/comments/:commentId', c.deleteComment);
router.post('/tasks/:id/attachments', upload.single('attachment'), c.addAttachment);
router.delete('/tasks/:id/attachments/:attachmentId', c.deleteAttachment);

// Calendar, reports
router.get('/calendar', c.getCalendarFeed);
router.get('/reports', c.getReports);
router.get('/reports/export.csv', c.exportReportCsv);

// Preferences & notifications
router.get('/preferences', c.getMyPreferences);
router.put('/preferences', c.updateMyPreferences);
router.get('/notifications', c.getNotificationHistory);
router.get('/reminders/upcoming', c.getUpcomingReminders);
router.post('/reminders/:reminderId/action', c.reminderAction);
router.post('/reminders/test', c.sendTestReminder);

// Lookups
router.get('/people', c.getPeople);
router.get('/projects', c.getProjects);
router.get('/tags', c.getTags);
router.get('/labels', c.listLabels);
router.post('/labels', c.createLabel);
router.delete('/labels/:labelId', c.deleteLabel);

// Admin (company-wide configuration)
const admin = restrictTo('SUPER_ADMIN', 'HR');
router.get('/admin/settings', admin, c.getAdminSettings);
router.put('/admin/settings', admin, c.updateAdminSettings);
router.post('/admin/company-reminders', admin, c.createCompanyReminder);
router.patch('/admin/company-reminders/:reminderId', admin, c.updateCompanyReminder);
router.delete('/admin/company-reminders/:reminderId', admin, c.deleteCompanyReminder);
router.post('/admin/scheduler/run', admin, c.runSchedulerNow);

export default router;
