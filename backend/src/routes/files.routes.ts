import { Router } from 'express';
import { uploadFile, deleteFile, upload } from '../controllers/files.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess);

router.post('/upload', upload.single('file'), uploadFile);
router.delete('/:publicId', deleteFile);

export default router;
