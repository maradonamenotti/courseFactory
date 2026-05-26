import { Router } from 'express';
import { getLibraryItems, getPaginatedLibraryItems, createLibraryItem, deleteLibraryItem, assignLibraryItem } from '../controllers/library.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess);

router.get('/', getLibraryItems);
router.get('/paginated', getPaginatedLibraryItems);
router.post('/', createLibraryItem);
router.delete('/:id', deleteLibraryItem);
router.post('/:id/assign', assignLibraryItem);

export default router;
