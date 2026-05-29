import { Router } from 'express';
import { getDashboardReports, createTrackingEvent } from '../controllers/reports.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Ruta pública para registrar eventos de tracking desde Moodle
router.post('/event', createTrackingEvent);

router.use(requireAuth);

router.get('/dashboard', getDashboardReports);

export default router;
