import { Router } from 'express';
import { generateHtml, publishMoodle } from '../controllers/systems.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess);

router.post('/generate-html', generateHtml);
router.post('/publish-moodle', publishMoodle);

export default router;
