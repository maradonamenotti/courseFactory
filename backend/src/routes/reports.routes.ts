import { Router } from 'express';
import { getDashboardReports, createTrackingEvent, createUserActivity, getUserActivityReport, recordHeartbeat, submitExamAttempt, getGradebook, getMoodleCoursesListHandler, getMoodleStudentProgressHandler } from '../controllers/reports.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Ruta pública para registrar eventos de tracking y heartbeat desde Moodle
router.post('/event', createTrackingEvent);
router.post('/heartbeat', recordHeartbeat);
router.post('/exam-attempt/:rowId/submit', submitExamAttempt);
router.get('/gradebook', getGradebook);

router.use(requireAuth);

router.get('/moodle-courses', getMoodleCoursesListHandler);
router.get('/moodle-student-progress', getMoodleStudentProgressHandler);
router.get('/dashboard', getDashboardReports);
router.post('/user-activity', createUserActivity);
router.get('/user-activity-report', getUserActivityReport);

export default router;
