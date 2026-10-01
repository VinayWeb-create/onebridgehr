import { Router } from 'express';
import {
  createGoal,
  getGoals,
  getMyGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  addCheckIn,
  addGoalComment,
  updateGoalProgress,
  reviewGoal,
  getGoalTimeline,
  getGoalsDashboard,
  getGoalsAnalytics,
  getManagerReview,
  getCareerInsights,
  getGoalTemplates,
  createGoalTemplate,
  deleteGoalTemplate,
  aiAssist,
  getRecognition,
  getEmployeeOptions,
} from '../controllers/goalController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

// Static routes FIRST (before :id)
router.get('/dashboard', getGoalsDashboard);
router.get('/analytics', getGoalsAnalytics);
router.get('/manager-review', getManagerReview);
router.get('/career', getCareerInsights);
router.get('/timeline', getGoalTimeline);
router.get('/templates', getGoalTemplates);
router.get('/recognition', getRecognition);
router.get('/employees', getEmployeeOptions);
router.get('/mine', getMyGoals);
router.get('/all', getGoals);
router.get('/', getGoals);

router.post('/', createGoal);
router.post('/templates', restrictTo('HR', 'SUPER_ADMIN', 'TEAM_LEAD'), createGoalTemplate);
router.post('/ai/assist', aiAssist);

// Parameterized routes
router.get('/:id', getGoalById);
router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);
router.post('/:id/check-in', addCheckIn);
router.post('/:id/comment', addGoalComment);
router.post('/:id/progress', updateGoalProgress);
router.post('/:id/review', reviewGoal);
router.delete('/templates/:id', restrictTo('HR', 'SUPER_ADMIN', 'TEAM_LEAD'), deleteGoalTemplate);

export default router;