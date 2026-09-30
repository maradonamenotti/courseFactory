import { Router } from 'express';
import { createPreview, getPreview, getRowPreview, getCourseSchedulePreview, getCourseBypass, getRowBypass, redeemUnlockCode, syncStudentProgress, updateStudentClassStatusHandler } from '../controllers/preview.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

// POST /api/preview/sync-progress — PÚBLICO, sincronizar progreso masivo
router.post('/sync-progress', syncStudentProgress);

// POST /api/preview/redeem-code — PÚBLICO, canjear código de desbloqueo
router.post('/redeem-code', redeemUnlockCode);

// GET /api/preview/clase/:rowId — PÚBLICO, sin autenticación
router.get('/clase/:rowId', getRowPreview);

// POST /api/preview/clase/:rowId/get-bypass — Requiere autenticación de CourseFactory
router.post('/clase/:rowId/get-bypass', requireAuth, getRowBypass);

// POST /api/preview/cronograma/:token/get-bypass — Requiere autenticación de CourseFactory
router.post('/cronograma/:token/get-bypass', requireAuth, getCourseBypass);

// GET /api/preview/cronograma/:token — PÚBLICO, sin autenticación
router.get('/cronograma/:token', getCourseSchedulePreview);

// POST /api/preview/cronograma/:token/class-status — PÚBLICO, marcar/desmarcar clase manualmente
router.post('/cronograma/:token/class-status', updateStudentClassStatusHandler);

// GET /api/preview/:token — PÚBLICO, sin autenticación
router.get('/:token', getPreview);

// POST /api/preview — Requiere autenticación para crear el enlace
router.post('/', requireAuth, requireFullAccess, createPreview);

export default router;
