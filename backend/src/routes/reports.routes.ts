import { Router } from 'express';
import { getDashboardReports, createTrackingEvent, createUserActivity, getUserActivityReport } from '../controllers/reports.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Ruta pública para registrar eventos de tracking desde Moodle
router.post('/event', createTrackingEvent);

router.use(requireAuth);

router.get('/dashboard', getDashboardReports);
router.post('/user-activity', createUserActivity);
router.get('/user-activity-report', getUserActivityReport);

export default router;
