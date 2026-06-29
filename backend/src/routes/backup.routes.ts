import { Router } from 'express';
import { downloadBackup } from '../controllers/backup.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

// GET /api/backup/download
router.get('/download', requireAuth, requireFullAccess, requireAdmin, downloadBackup);

export default router;
