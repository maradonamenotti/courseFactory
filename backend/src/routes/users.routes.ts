import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '../controllers/users.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess, requireAdmin);

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.patch('/:id/reset-password', resetPassword);

export default router;
