import { Router } from 'express';
import { getCourses, createCourse, updateCourse, deleteCourse, createCourseInMoodle } from '../controllers/courses.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess);

router.get('/', getCourses);
router.post('/', createCourse);
router.put('/:id', updateCourse);
router.delete('/:id', deleteCourse);
router.post('/:id/moodle/create', createCourseInMoodle);

export default router;
