import { Router } from 'express';
import { uploadFile, deleteFile, upload, uploadDocx, importGoogleDriveFile, downloadFile } from '../controllers/files.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router();

// Descarga directa de archivos locales (accesible vía enlace directo)
router.get('/download/:filename', downloadFile);

const handleMulterUpload = (uploadMiddleware: any) => (req: any, res: any, next: any) => {
  uploadMiddleware(req, res, (err: any) => {
    if (err) {
      console.error('[Multer Error]:', err);
      return res.status(400).json({ message: err?.message || 'Error al procesar el archivo subido' });
    }
    next();
  });
};

router.post('/upload', handleMulterUpload(upload.single('file')), uploadFile);
router.post('/upload-docx', handleMulterUpload(upload.single('file')), uploadDocx);
router.post('/import-drive', importGoogleDriveFile);
router.delete('/:publicId', deleteFile);

export default router;
