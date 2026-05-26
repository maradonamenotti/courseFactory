import { Router } from 'express';
import { uploadToVimeo, getVimeoVideoStatus, uploadVimeoMiddleware } from '../controllers/vimeo.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess);

// POST /api/vimeo/upload    → recibe multipart/form-data con campo 'video'
router.post('/upload', uploadVimeoMiddleware.single('video'), uploadToVimeo);

// GET  /api/vimeo/status/:videoId → estado de procesamiento del video
router.get('/status/:videoId', getVimeoVideoStatus);

export default router;
