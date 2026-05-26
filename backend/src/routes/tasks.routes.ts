import { Router } from 'express';
import { getTasks, getPaginatedTasks, createTask, updateTask, cycleTaskStatus, deleteTask } from '../controllers/tasks.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess);

router.get('/', getTasks);
router.get('/paginated', getPaginatedTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id/status', cycleTaskStatus);
router.delete('/:id', deleteTask);

export default router;
