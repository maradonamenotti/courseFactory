import { Router } from 'express';
import { getRowHistory, getCourseHistory, restoreRowHistory } from '../controllers/history.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireFullAccess);

// Historial de una fila específica
router.get('/:courseId/rows/:rowId/history', getRowHistory);

// Historial completo del curso
router.get('/:courseId/history', getCourseHistory);

// Restaurar un snapshot
router.post('/:courseId/rows/:rowId/history/:historyId/restore', restoreRowHistory);

export default router;
