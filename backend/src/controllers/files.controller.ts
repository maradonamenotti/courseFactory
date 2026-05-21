import { Request, Response } from 'express';
import { UploadApiResponse } from 'cloudinary';
import cloudinary from '../config/cloudinary';
import multer from 'multer';

// Multer en memoria (no guarda en disco, sube directo a Cloudinary)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST /api/files/upload
export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: 'No se proporcionó ningún archivo' });
    return;
  }

  try {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'coursefactory',
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result!);
        }
      );
      stream.end(req.file!.buffer);
    });

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error subiendo a Cloudinary:', error);
    res.status(500).json({ message: 'Error al subir el archivo' });
  }
};

// DELETE /api/files/:publicId
export const deleteFile = async (req: Request, res: Response): Promise<void> => {
  const publicId = decodeURIComponent(req.params.publicId);

  try {
    await cloudinary.uploader.destroy(publicId);
    res.json({ message: 'Archivo eliminado de Cloudinary' });
  } catch (error) {
    console.error('Error eliminando de Cloudinary:', error);
    res.status(500).json({ message: 'Error al eliminar el archivo' });
  }
};
