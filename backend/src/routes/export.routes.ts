import { Router } from 'express';
import { exportCsv } from '../controllers/export.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess);

// GET /api/courses/:courseId/export
router.get('/:courseId/export', exportCsv);

export default router;
