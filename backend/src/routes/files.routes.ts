import { Router } from 'express';
import { uploadFile, deleteFile, upload, uploadDocx } from '../controllers/files.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireFullAccess);

router.post('/upload', upload.single('file'), uploadFile);
router.post('/upload-docx', upload.single('file'), uploadDocx);
router.delete('/:publicId', deleteFile);

export default router;
