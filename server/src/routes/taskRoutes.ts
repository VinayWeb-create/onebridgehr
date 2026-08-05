import { Router } from 'express';
import {
  createTask,
  updateTask,
  deleteTask,
  getEmployeeTasks,
  getAssignedTasks,
  getAllTasks,
  getTaskStats,
} from '../controllers/taskController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

// Static routes MUST come before parameterized routes
router.post('/', restrictTo('TEAM_LEAD', 'HR', 'SUPER_ADMIN'), createTask);
router.get('/my-tasks', getEmployeeTasks);
router.get('/my-assigned', getAssignedTasks);
router.get('/all', restrictTo('HR', 'SUPER_ADMIN'), getAllTasks);
router.get('/stats', getTaskStats);

// Parameterized routes AFTER static ones
router.put('/:taskId', updateTask);
router.delete('/:taskId', restrictTo('HR', 'SUPER_ADMIN'), deleteTask);

export default router;
