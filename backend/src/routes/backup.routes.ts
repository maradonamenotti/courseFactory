import { Router } from 'express';
import { 
  downloadBackup,
  createCourseSnapshot,
  listCourseBackups,
  restoreCourseBackup,
  downloadCourseBackup,
  runDailyCourseSnapshots
} from '../controllers/backup.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

// GET /api/backup/download (Copia global de base de datos)
router.get('/download', requireAuth, requireFullAccess, requireAdmin, downloadBackup);

// POST /api/backup/courses/run-daily (Ejecución automática por cron)
router.post('/courses/run-daily', runDailyCourseSnapshots);

// Rutas de backups individuales por curso
router.post('/courses/:courseId/snapshot', requireAuth, requireFullAccess, createCourseSnapshot);
router.get('/courses/:courseId/list', requireAuth, requireFullAccess, listCourseBackups);
router.post('/courses/:courseId/restore', requireAuth, requireFullAccess, requireAdmin, restoreCourseBackup);
router.get('/courses/:courseId/download/:filename', requireAuth, requireFullAccess, requireAdmin, downloadCourseBackup);

export default router;
