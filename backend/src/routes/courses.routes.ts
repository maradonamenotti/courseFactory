import { Router } from 'express';
import { getCourses, createCourse, updateCourse, deleteCourse, createCourseInMoodle } from '../controllers/courses.controller';
import { getUnlockCodes, createUnlockCode, deleteUnlockCode } from '../controllers/unlockCodes.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess);

router.get('/', getCourses);
router.post('/', createCourse);
router.put('/:id', updateCourse);
router.delete('/:id', deleteCourse);
router.post('/:id/moodle/create', createCourseInMoodle);

// ─── Rutas de Códigos de Desbloqueo ──────────────────────────────────────────
router.get('/:courseId/unlock-codes', getUnlockCodes);
router.post('/:courseId/unlock-codes', createUnlockCode);
router.delete('/:courseId/unlock-codes/:id', deleteUnlockCode);

export default router;
