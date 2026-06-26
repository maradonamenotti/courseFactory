import { Router } from 'express';
import { createPreview, getPreview, getRowPreview } from '../controllers/preview.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

// GET /api/preview/clase/:rowId — PÚBLICO, sin autenticación
router.get('/clase/:rowId', getRowPreview);

// GET /api/preview/:token — PÚBLICO, sin autenticación
router.get('/:token', getPreview);

// POST /api/preview — Requiere autenticación para crear el enlace
router.post('/', requireAuth, requireFullAccess, createPreview);

export default router;
