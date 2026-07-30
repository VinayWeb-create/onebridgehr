import { Router } from 'express';
import {
  createTask,
  updateTask,
  getEmployeeTasks,
  getAssignedTasks,
  getAllTasks,
} from '../controllers/taskController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/', restrictTo('TEAM_LEAD', 'HR', 'SUPER_ADMIN'), createTask);
router.get('/my-tasks', getEmployeeTasks);
router.get('/my-assigned', getAssignedTasks);
router.get('/all', restrictTo('HR', 'SUPER_ADMIN'), getAllTasks);
router.put('/:taskId', updateTask);

export default router;
