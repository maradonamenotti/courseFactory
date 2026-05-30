import { Request, Response } from 'express';
import { UploadApiResponse } from 'cloudinary';
import cloudinary from '../config/cloudinary';
import multer from 'multer';
import * as mammoth from 'mammoth';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

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

// POST /api/files/upload-docx
export const uploadDocx = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: 'No se proporcionó ningún archivo .docx' });
    return;
  }

  try {
    const options = {
      convertImage: mammoth.images.imgElement(async (element) => {
        const imageBuffer = await element.read("base64");
        const buffer = Buffer.from(imageBuffer, 'base64');
        
        // Subir imagen extraída a Cloudinary
        const result = await new Promise<UploadApiResponse>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'coursefactory/docx_images', resource_type: 'image' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result!);
            }
          );
          stream.end(buffer);
        });

        return { src: result.secure_url };
      })
    };

    const result = await mammoth.convertToHtml({ buffer: req.file.buffer }, options);
    const htmlContent = result.value; // El HTML generado con las URLs de Cloudinary

    // Además podemos subir el propio .docx a Cloudinary si queremos conservarlo
    const docxUpload = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'coursefactory', resource_type: 'raw' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result!);
        }
      );
      stream.end(req.file!.buffer);
    });

    res.json({
      htmlContent, // El texto e imágenes extraídas
      url: docxUpload.secure_url,
      publicId: docxUpload.public_id,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error procesando el .docx:', error);
    res.status(500).json({ message: 'Error procesando el documento Word' });
  }
};

// POST /api/files/import-drive
export const importGoogleDriveFile = async (req: Request, res: Response): Promise<void> => {
  const { fileId, oauthToken } = req.body;

  if (!fileId || !oauthToken) {
    res.status(400).json({ message: 'fileId y oauthToken son requeridos' });
    return;
  }

  try {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: oauthToken });

    const drive = google.drive({ version: 'v3', auth });

    // Obtener metadatos del archivo
    const fileMeta = await drive.files.get({
      fileId,
      fields: 'name,mimeType,modifiedTime,size',
      supportsAllDrives: true,
    });

    const { name: fileName, mimeType: fileType, modifiedTime: googleModifiedTime } = fileMeta.data;

    if (!fileName || !fileType) {
      res.status(400).json({ message: 'No se pudieron recuperar los metadatos del archivo' });
      return;
    }

    // Descargar el archivo
    let fileBuffer: Buffer;
    const isGoogleDoc = fileType === 'application/vnd.google-apps.document';

    if (isGoogleDoc) {
      // Si es un Google Doc nativo, lo exportamos como docx
      const exportRes = await drive.files.export(
        {
          fileId,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        { responseType: 'arraybuffer' }
      );
      fileBuffer = Buffer.from(exportRes.data as ArrayBuffer);
    } else {
      // Archivo binario directo (docx o pdf)
      const downloadRes = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      );
      fileBuffer = Buffer.from(downloadRes.data as ArrayBuffer);
    }

    const isDocx = fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || isGoogleDoc;

    // Límite de Cloudinary en el plan gratuito: 10 MB
    const CLOUDINARY_MAX_BYTES = 10 * 1024 * 1024;
    const fileSizeBytes = fileBuffer.length;
    const exceedsCloudinaryLimit = fileSizeBytes > CLOUDINARY_MAX_BYTES;

    // URL de vista de Google Drive (fallback para archivos grandes)
    const driveViewUrl = `https://drive.google.com/file/d/${fileId}/view`;

    let htmlContent: string | null = null;
    let fileUrl: string;
    let publicId: string | null = null;

    if (isDocx) {
      // Convertir DOCX a HTML con mammoth (las imágenes internas se suben a Cloudinary individualmente)
      const options = {
        convertImage: mammoth.images.imgElement(async (element) => {
          const imageBuffer = await element.read("base64");
          const buffer = Buffer.from(imageBuffer, 'base64');
          
          const result = await new Promise<UploadApiResponse>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: 'coursefactory/docx_images', resource_type: 'image' },
              (error, result) => {
                if (error) reject(error);
                else resolve(result!);
              }
            );
            stream.end(buffer);
          });

          return { src: result.secure_url };
        })
      };

      const mammothRes = await mammoth.convertToHtml({ buffer: fileBuffer }, options);
      htmlContent = mammothRes.value;

      if (exceedsCloudinaryLimit) {
        // Archivo demasiado grande para Cloudinary: usar URL de Drive como referencia
        console.warn(`Archivo DOCX demasiado grande (${fileSizeBytes} bytes) para Cloudinary. Usando URL de Drive como fallback.`);
        fileUrl = driveViewUrl;
      } else {
        const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'coursefactory', resource_type: 'raw' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result!);
            }
          );
          stream.end(fileBuffer);
        });
        fileUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
      }
    } else {
      if (exceedsCloudinaryLimit) {
        // PDF u otro archivo grande: usar URL de Drive directamente
        console.warn(`Archivo demasiado grande (${fileSizeBytes} bytes) para Cloudinary. Usando URL de Drive como fallback.`);
        fileUrl = driveViewUrl;
      } else {
        const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'coursefactory', resource_type: 'auto' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result!);
            }
          );
          stream.end(fileBuffer);
        });
        fileUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
      }
    }

    res.json({
      url: fileUrl,
      publicId,
      fileName,
      fileType: isGoogleDoc ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : fileType,
      htmlContent,
      googleFileId: fileId,
      googleModifiedTime,
    });

  } catch (error: any) {
    console.error('Error importando desde Google Drive:', error);
    const message = error?.message?.includes('File size too large')
      ? 'El archivo supera el límite de almacenamiento permitido. Intentá con un archivo más pequeño.'
      : 'Error al importar el archivo desde Google Drive';
    res.status(500).json({ message });
  }
};
