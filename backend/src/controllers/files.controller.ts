import { Request, Response } from 'express';
import { UploadApiResponse } from 'cloudinary';
import cloudinary from '../config/cloudinary';
import multer from 'multer';
import * as mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer en memoria (hasta 100MB)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// GET /api/files/download/:filename
export const downloadFile = async (req: Request, res: Response): Promise<void> => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: 'Archivo no encontrado' });
    return;
  }

  const originalName = filename.replace(/^\d+-/, '');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.query.download === '1') {
    res.download(filePath, originalName);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalName)}"`);
    res.sendFile(filePath);
  }
};

const saveExtractedImage = async (element: any): Promise<{ src: string }> => {
  try {
    const imageBuffer = await element.read("base64");
    const buffer = Buffer.from(imageBuffer, 'base64');
    const ext = element.contentType ? (element.contentType.split('/')[1] || 'png') : 'png';
    const safeName = `img-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    await fs.promises.writeFile(filePath, buffer);
    const baseUrl = process.env.FRONTEND_URL || 'https://cf.maradonamenotti.cloud';
    return { src: `${baseUrl}/api/files/download/${safeName}` };
  } catch (err) {
    console.error('Error saving extracted image:', err);
    return { src: '' };
  }
};

const uploadToCloudinaryWithTimeout = (buffer: Buffer, folder: string, resource_type: string, timeoutMs = 3500): Promise<UploadApiResponse> => {
  return Promise.race([
    new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resource_type as any },
        (error, result) => {
          if (error) reject(error);
          else resolve(result!);
        }
      );
      stream.end(buffer);
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Cloudinary timeout')), timeoutMs))
  ]);
};

// POST /api/files/upload
export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: 'No se proporcionó ningún archivo' });
    return;
  }

  console.log(`[Upload File Request] File: ${req.file.originalname}, Size: ${req.file.buffer.length} bytes`);

  try {
    let fileUrl = '';
    let publicId: string | null = null;

    if (req.file.buffer.length <= 10 * 1024 * 1024) {
      try {
        const result = await uploadToCloudinaryWithTimeout(req.file.buffer, 'coursefactory', 'auto', 3500);
        fileUrl = result.secure_url;
        publicId = result.public_id;
      } catch (cloudErr) {
        console.warn('Cloudinary upload falló o superó límite/tiempo, guardando en disco local del servidor:', cloudErr);
      }
    }

    if (!fileUrl) {
      const safeName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(uploadsDir, safeName);
      fs.writeFileSync(filePath, req.file.buffer);
      fileUrl = `/api/files/download/${safeName}`;
      publicId = safeName;
      console.log(`[Upload File] Guardado en disco local: ${fileUrl}`);
    }

    res.json({
      url: fileUrl,
      publicId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
    });
  } catch (error: any) {
    console.error('Error subiendo archivo:', error);
    res.status(500).json({ message: error?.message || 'Error al subir el archivo' });
  }
};

// DELETE /api/files/:publicId
export const deleteFile = async (req: Request, res: Response): Promise<void> => {
  const publicId = decodeURIComponent(req.params.publicId);

  try {
    const localFilePath = path.join(uploadsDir, publicId);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    await cloudinary.uploader.destroy(publicId).catch(() => {});
    res.json({ message: 'Archivo eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando archivo:', error);
    res.status(500).json({ message: 'Error al eliminar el archivo' });
  }
};

// POST /api/files/upload-docx
export const uploadDocx = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: 'No se proporcionó ningún archivo .docx' });
    return;
  }

  console.log(`[Upload DOCX Request] File: ${req.file.originalname}, Size: ${req.file.buffer.length} bytes`);

  try {
    let htmlContent = '';
    try {
      const options = {
        convertImage: mammoth.images.imgElement(saveExtractedImage)
      };

      const result = await mammoth.convertToHtml({ buffer: req.file.buffer }, options);
      htmlContent = result.value || '';
      htmlContent = postProcessDocxHtml(htmlContent, req.file.buffer);
    } catch (mammothErr: any) {
      console.warn('[Upload DOCX] Mammoth conversion failed, continuing with raw file save:', mammothErr?.message);
    }

    let docxUrl = '';
    let docxPublicId: string | null = null;

    if (req.file.buffer.length <= 10 * 1024 * 1024) {
      try {
        const docxUpload = await uploadToCloudinaryWithTimeout(req.file.buffer, 'coursefactory', 'raw', 3500);
        docxUrl = docxUpload.secure_url;
        docxPublicId = docxUpload.public_id;
      } catch (cloudErr) {
        console.warn('Cloudinary upload_stream falló o superó límite/tiempo de 3.5s, guardando en disco local:', cloudErr);
      }
    }

    if (!docxUrl) {
      const safeName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(uploadsDir, safeName);
      fs.writeFileSync(filePath, req.file.buffer);
      docxUrl = `/api/files/download/${safeName}`;
      docxPublicId = safeName;
      console.log(`[Upload DOCX] Archivo guardado en disco local: ${docxUrl}`);
    }

    res.json({
      htmlContent, // El texto e imágenes extraídas (o vacío si Mammoth no aplica)
      url: docxUrl,
      publicId: docxPublicId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
    });
  } catch (error: any) {
    console.error('Error procesando el .docx:', error);
    res.status(500).json({ message: error?.message || 'Error procesando el documento Word' });
  }
};

async function fetchGoogleDriveWithAuth(initialUrl: string, oauthToken: string): Promise<Buffer> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount < 8; redirectCount++) {
    const urlObj = new URL(currentUrl);
    // Solo enviar el header Authorization a dominios de googleapis.com.
    // Cuando Google redirige a googleusercontent.com o storage.googleapis.com,
    // la URL firmada ya contiene credenciales en los query params.
    // Enviar el header Authorization a googleusercontent.com provoca HTTP 401 (UNAUTHENTICATED).
    const isGoogleApis = urlObj.hostname === 'www.googleapis.com' || urlObj.hostname === 'googleapis.com';
    const headers: Record<string, string> = {};
    if (isGoogleApis) {
      headers['Authorization'] = `Bearer ${oauthToken}`;
    }

    const res = await fetch(currentUrl, {
      headers,
      redirect: 'manual',
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error(`Redirect without location header from ${currentUrl}`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Google Drive Import] Fetch failed (${res.status}) on ${currentUrl.substring(0, 80)}:`, errText);
      const err: any = new Error(`Google API fetch failed: ${res.status} ${errText}`);
      err.status = res.status;
      err.statusCode = res.status;
      throw err;
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Validar que Google no haya devuelto una página HTML de advertencia o captcha en lugar de un binario
    const sample = buffer.slice(0, 100).toString('utf-8').trim().toLowerCase();
    if (sample.startsWith('<!doctype') || sample.startsWith('<html')) {
      console.error('[Google Drive Import] Received HTML instead of binary content. Sample:', sample.slice(0, 150));
      throw new Error('Google Drive devolvió una página HTML en lugar del contenido binario del archivo.');
    }

    return buffer;
  }

  throw new Error('Too many redirects while downloading from Google Drive');
}

// POST /api/files/import-drive
export const importGoogleDriveFile = async (req: Request, res: Response): Promise<void> => {
  const { fileId, oauthToken } = req.body;

  if (!fileId || !oauthToken) {
    res.status(400).json({ message: 'fileId y oauthToken son requeridos' });
    return;
  }

  try {
    // 1. Validar el token contra Google tokeninfo
    console.log('[Google Drive Import] Inspecting oauthToken...');
    try {
      const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${oauthToken}`);
      const tokenInfo = await tokenInfoRes.json();
      console.log('[Google Drive Import] Google TokenInfo result:', tokenInfo);
    } catch (e: any) {
      console.error('[Google Drive Import] Error checking tokeninfo:', e.message);
    }

    const auth = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    auth.setCredentials({ access_token: oauthToken });

    const drive = google.drive({ version: 'v3', auth });

    // Obtener metadatos del archivo
    console.log('[Google Drive Import] Requesting metadata for fileId:', fileId);
    let fileMeta: any;
    try {
      fileMeta = await drive.files.get({
        fileId,
        fields: 'id,name,mimeType,modifiedTime,size,shortcutDetails,webContentLink,exportLinks,capabilities',
        supportsAllDrives: true,
      });
    } catch (driveErr: any) {
      console.warn('[Google Drive Import] drive.files.get failed, trying direct fetch for metadata...', driveErr?.message);
      const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,shortcutDetails,webContentLink,exportLinks,capabilities&supportsAllDrives=true`;
      const metaFetchRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${oauthToken}` }
      });
      if (!metaFetchRes.ok) {
        const metaErrText = await metaFetchRes.text();
        console.error('[Google Drive Import] Direct meta fetch failed:', metaFetchRes.status, metaErrText);
        throw driveErr;
      }
      fileMeta = { data: await metaFetchRes.json() };
      console.log('[Google Drive Import] Direct meta fetch succeeded!');
    }

    console.log('[Google Drive Import] Metadata retrieved:', JSON.stringify(fileMeta.data, null, 2));

    let fileName = fileMeta.data.name;
    let fileType = fileMeta.data.mimeType;
    let googleModifiedTime = fileMeta.data.modifiedTime;
    let targetFileId = fileId;

    // Si es un acceso directo (shortcut), obtenemos el ID y tipo real
    if (fileType === 'application/vnd.google-apps.shortcut' && fileMeta.data.shortcutDetails?.targetId) {
      targetFileId = fileMeta.data.shortcutDetails.targetId;
      fileType = fileMeta.data.shortcutDetails.targetMimeType || fileType;
      console.log('[Google Drive Import] Resolved shortcut to targetFileId:', targetFileId, 'mimeType:', fileType);
    }

    if (!fileName || !fileType) {
      res.status(400).json({ message: 'No se pudieron recuperar los metadatos del archivo' });
      return;
    }

    // Descargar el archivo
    let fileBuffer: Buffer | null = null;
    const isGoogleDoc = fileType === 'application/vnd.google-apps.document';

    if (isGoogleDoc) {
      // Si es un Google Doc nativo, lo exportamos como docx
      console.log('[Google Drive Import] Exporting Google Doc to docx...');
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${targetFileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.wordprocessingml.document`;
      try {
        fileBuffer = await fetchGoogleDriveWithAuth(exportUrl, oauthToken);
        console.log('[Google Drive Import] Direct export fetch succeeded! Downloaded bytes:', fileBuffer.length);
      } catch (exportFetchErr: any) {
        console.warn('[Google Drive Import] Direct export fetch failed, trying drive.files.export stream...', exportFetchErr?.message);
        try {
          const exportRes = await drive.files.export(
            {
              fileId: targetFileId,
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            },
            { responseType: 'stream' }
          );
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve, reject) => {
            (exportRes.data as any)
              .on('data', (chunk: any) => chunks.push(Buffer.from(chunk)))
              .on('end', () => resolve())
              .on('error', (err: any) => reject(err));
          });
          fileBuffer = Buffer.concat(chunks);
          console.log('[Google Drive Import] Stream export succeeded! Downloaded bytes:', fileBuffer.length);
        } catch (streamErr: any) {
          throw exportFetchErr;
        }
      }
    } else {
      // Archivo binario directo (docx o pdf)
      console.log('[Google Drive Import] Downloading binary file with direct API fetch...');
      const directUrl = `https://www.googleapis.com/drive/v3/files/${targetFileId}?alt=media&supportsAllDrives=true`;
      try {
        fileBuffer = await fetchGoogleDriveWithAuth(directUrl, oauthToken);
        console.log('[Google Drive Import] Direct alt=media fetch succeeded! Downloaded bytes:', fileBuffer.length);
      } catch (directErr: any) {
        console.warn('[Google Drive Import] Direct alt=media fetch failed, trying alternative strategies...', directErr?.message);

        // Si es un archivo que termina en .docx o tipo word, intentar export por si Google Drive lo trata como doc
        if (fileName.toLowerCase().endsWith('.docx') || fileType.includes('word')) {
          try {
            console.log('[Google Drive Import] Trying export as docx fallback...');
            const exportUrl = `https://www.googleapis.com/drive/v3/files/${targetFileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.wordprocessingml.document`;
            fileBuffer = await fetchGoogleDriveWithAuth(exportUrl, oauthToken);
            console.log('[Google Drive Import] Export fallback succeeded! Downloaded bytes:', fileBuffer.length);
          } catch (exportFallbackErr: any) {
            console.warn('[Google Drive Import] Export fallback failed:', exportFallbackErr?.message);
          }
        }

        // Si aún no tenemos buffer, intentar drive.files.get stream
        if (!fileBuffer) {
          try {
            console.log('[Google Drive Import] Trying drive.files.get stream...');
            const downloadRes = await drive.files.get(
              { fileId: targetFileId, alt: 'media', supportsAllDrives: true },
              { responseType: 'stream' }
            );
            const chunks: Buffer[] = [];
            await new Promise<void>((resolve, reject) => {
              (downloadRes.data as any)
                .on('data', (chunk: any) => chunks.push(Buffer.from(chunk)))
                .on('end', () => resolve())
                .on('error', (err: any) => reject(err));
            });
            fileBuffer = Buffer.concat(chunks);
            console.log('[Google Drive Import] Stream download succeeded! Downloaded bytes:', fileBuffer.length);
          } catch (streamErr: any) {
            console.error('[Google Drive Import] Stream download also failed:', streamErr?.message);
            throw directErr;
          }
        }
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('El archivo descargado está vacío');
    }

    const isDocx = fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || isGoogleDoc || fileName.toLowerCase().endsWith('.docx');

    // Validar cabecera ZIP en caso de ser DOCX
    if (isDocx && fileBuffer.length > 4) {
      const isZip = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04;
      if (!isZip) {
        console.warn('[Google Drive Import] Buffer does not have PK\\x03\\x04 ZIP header. First 4 bytes:', fileBuffer.slice(0, 4));
        // Intentar una exportación de emergencia por si es un Google Doc que reportó mimeType de Office
        try {
          console.log('[Google Drive Import] Attempting emergency export...');
          const emergencyExportUrl = `https://www.googleapis.com/drive/v3/files/${targetFileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.wordprocessingml.document`;
          const emergencyBuffer = await fetchGoogleDriveWithAuth(emergencyExportUrl, oauthToken);
          if (emergencyBuffer.length > 4 && emergencyBuffer[0] === 0x50 && emergencyBuffer[1] === 0x4b) {
            fileBuffer = emergencyBuffer;
            console.log('[Google Drive Import] Emergency export succeeded! Bytes:', fileBuffer.length);
          }
        } catch (e: any) {
          console.warn('[Google Drive Import] Emergency export failed:', e.message);
        }
      }
    }

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
      const options = {
        convertImage: mammoth.images.imgElement(saveExtractedImage)
      };

      const mammothRes = await mammoth.convertToHtml({ buffer: fileBuffer }, options);
      htmlContent = mammothRes.value;
      htmlContent = postProcessDocxHtml(htmlContent, fileBuffer);

      if (exceedsCloudinaryLimit) {
        console.warn(`Archivo DOCX demasiado grande (${fileSizeBytes} bytes) para Cloudinary. Usando URL de Drive como fallback.`);
        fileUrl = driveViewUrl;
      } else {
        try {
          const uploadResult = await uploadToCloudinaryWithTimeout(fileBuffer, 'coursefactory', 'raw', 3500);
          fileUrl = uploadResult.secure_url;
          publicId = uploadResult.public_id;
        } catch (cloudErr) {
          console.warn('Cloudinary upload_stream falló o superó límite/tiempo de 3.5s en Drive Import, guardando en disco local:', cloudErr);
          const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const filePath = path.join(uploadsDir, safeName);
          fs.writeFileSync(filePath, fileBuffer);
          fileUrl = `/api/files/download/${safeName}`;
          publicId = safeName;
        }
      }
    } else {
      if (exceedsCloudinaryLimit) {
        console.warn(`Archivo demasiado grande (${fileSizeBytes} bytes) para Cloudinary. Usando URL de Drive como fallback.`);
        fileUrl = driveViewUrl;
      } else {
        try {
          const uploadResult = await uploadToCloudinaryWithTimeout(fileBuffer, 'coursefactory', 'auto', 3500);
          fileUrl = uploadResult.secure_url;
          publicId = uploadResult.public_id;
        } catch (cloudErr) {
          console.warn('Cloudinary upload falló o superó tiempo de 3.5s en Drive Import, guardando en disco local:', cloudErr);
          const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const filePath = path.join(uploadsDir, safeName);
          fs.writeFileSync(filePath, fileBuffer);
          fileUrl = `/api/files/download/${safeName}`;
          publicId = safeName;
        }
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
    console.error('Error importando desde Google Drive:', error?.message);
    if (error?.response?.data) {
      const dataStr = Buffer.isBuffer(error.response.data)
        ? error.response.data.toString('utf-8')
        : (typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data));
      console.error('Google API Error Details:', dataStr);
    }
    const isAuthError =
      error?.code === 401 ||
      error?.status === 401 ||
      error?.response?.status === 401 ||
      error?.message?.includes('invalid authentication credentials') ||
      error?.message?.includes('UNAUTHENTICATED');

    if (isAuthError) {
      res.status(401).json({
        message: 'Tu sesión de Google Drive ha expirado o las credenciales no son válidas. Por favor volvé a conectar con Google.',
        code: 'GOOGLE_AUTH_EXPIRED',
      });
      return;
    }

    const message = error?.message?.includes('File size too large')
      ? 'El archivo supera el límite de almacenamiento permitido. Intentá con un archivo más pequeño.'
      : (error?.message || 'Error al importar el archivo desde Google Drive');
    res.status(500).json({ message });
  }
};

function extractShadedTextsFromDocx(buffer: Buffer): Set<string> {
  const shaded = new Set<string>();
  try {
    const zip = new AdmZip(buffer);
    const docXml = zip.readAsText('word/document.xml');
    
    // 1. Extraer sombreados y resaltados a nivel de RUN (<w:r>)
    let pos = 0;
    while (true) {
      const rStart1 = docXml.indexOf('<w:r ', pos);
      const rStart2 = docXml.indexOf('<w:r>', pos);
      let rStart = -1;
      if (rStart1 !== -1 && rStart2 !== -1) rStart = Math.min(rStart1, rStart2);
      else if (rStart1 !== -1) rStart = rStart1;
      else if (rStart2 !== -1) rStart = rStart2;
      else break;

      pos = rStart;
      const rEnd = docXml.indexOf('</w:r>', pos);
      if (rEnd === -1) break;

      const rBlock = docXml.substring(pos, rEnd + 6);
      pos = rEnd + 6;

      const hasHighlight = rBlock.includes('<w:highlight') && !rBlock.includes('w:val="none"');
      const hasShading = rBlock.includes('<w:shd') && 
                         !rBlock.includes('w:fill="auto"') && 
                         !rBlock.includes('w:fill="none"') && 
                         !rBlock.includes('w:fill="ffffff"') && 
                         !rBlock.includes('w:fill="FFFFFF"') &&
                         !rBlock.includes('w:fill="000000"');

      if (hasHighlight || hasShading) {
        let rText = '';
        let tPos = 0;
        while (true) {
          const tStart = rBlock.indexOf('<w:t', tPos);
          if (tStart === -1) break;
          const tContentStart = rBlock.indexOf('>', tStart) + 1;
          const tEnd = rBlock.indexOf('</w:t>', tContentStart);
          if (tEnd === -1) break;
          rText += rBlock.substring(tContentStart, tEnd);
          tPos = tEnd + 6;
        }

        const cleanRText = rText.trim();
        if (cleanRText && cleanRText.length > 2) {
          shaded.add(cleanRText);
        }
      }
    }

    // 2. Extraer sombreados a nivel de PÁRRAFO (<w:p>)
    pos = 0;
    while (true) {
      const pStart1 = docXml.indexOf('<w:p ', pos);
      const pStart2 = docXml.indexOf('<w:p>', pos);
      let pStart = -1;
      if (pStart1 !== -1 && pStart2 !== -1) pStart = Math.min(pStart1, pStart2);
      else if (pStart1 !== -1) pStart = pStart1;
      else if (pStart2 !== -1) pStart = pStart2;
      else break;

      pos = pStart;
      const pEnd = docXml.indexOf('</w:p>', pos);
      if (pEnd === -1) break;

      const pBlock = docXml.substring(pos, pEnd + 6);
      pos = pEnd + 6;

      const hasHighlight = pBlock.includes('<w:highlight') && !pBlock.includes('w:val="none"');
      const hasShading = pBlock.includes('<w:shd') && 
                         !pBlock.includes('w:fill="auto"') && 
                         !pBlock.includes('w:fill="none"') && 
                         !pBlock.includes('w:fill="ffffff"') && 
                         !pBlock.includes('w:fill="FFFFFF"');

      if (hasHighlight || hasShading) {
        let pText = '';
        let tPos = 0;
        while (true) {
          const tStart = pBlock.indexOf('<w:t', tPos);
          if (tStart === -1) break;
          const tContentStart = pBlock.indexOf('>', tStart) + 1;
          const tEnd = pBlock.indexOf('</w:t>', tContentStart);
          if (tEnd === -1) break;
          pText += pBlock.substring(tContentStart, tEnd);
          tPos = tEnd + 6;
        }

        const cleanPText = pText.trim();
        if (cleanPText) {
          shaded.add(cleanPText);
        }
      }
    }
  } catch (err) {
    console.error('Error extracting shaded texts from DOCX:', err);
  }
  return shaded;
}

function cleanAndNormalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u201c\u201d\u2018\u2019"']/g, '') // Remove curly/straight quotes
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .toLowerCase();
}

function postProcessDocxHtml(htmlContent: string, buffer: Buffer): string {
  try {
    const shadedTexts = extractShadedTextsFromDocx(buffer);
    if (shadedTexts.size === 0) return htmlContent;

    const normalizedShaded = new Set<string>();
    for (const t of shadedTexts) {
      const norm = cleanAndNormalizeText(t);
      if (norm) normalizedShaded.add(norm);
    }

    const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
    const modifiedHtml = htmlContent.replace(pRegex, (match, attrs, innerHtml) => {
      // Skip question stems: paragraphs that are ONLY a <strong> block (bold question text)
      const strippedInner = innerHtml.replace(/<[^>]+>/g, '').trim();
      const isStrongOnly = /^<strong[\s>]/i.test(innerHtml.trim()) || innerHtml.trim().startsWith('<strong>');
      if (isStrongOnly) return match;

      const lines = innerHtml.split(/(<br\s*\/?>)/gi);
      const updatedLines = lines.map((line: string) => {
        if (/^<br\s*\/?>$/i.test(line)) return line;

        // Skip lines that are themselves question stems (wrapped in <strong>)
        if (/^<strong[\s>]/i.test(line.trim()) || line.trim().startsWith('<strong>')) return line;

        const cleanLine = cleanAndNormalizeText(line);
        if (!cleanLine || cleanLine.length <= 3) return line;

        // 1) Exact match
        let isMatch = normalizedShaded.has(cleanLine);

        if (!isMatch) {
          // Strip option prefix (a) b) 1. etc.) from both sides before comparing
          const stripOpt = (str: string) => str.replace(/^[a-e1-9][\.\)\:\-]\s*/i, '').trim();
          const cleanNoOpt = stripOpt(cleanLine);

          for (const s of normalizedShaded) {
            const sNoOpt = stripOpt(s);
            if (cleanNoOpt && sNoOpt && cleanNoOpt.length > 3 && sNoOpt.length > 3) {
              // Only allow: exact match after stripping prefix, OR the option line fully CONTAINS the shaded fragment
              // Do NOT allow sNoOpt.includes(cleanNoOpt) — that matches short fragments inside long question stems
              if (cleanNoOpt === sNoOpt || cleanNoOpt.includes(sNoOpt)) {
                isMatch = true;
                break;
              }
            }
          }
        }

        if (isMatch && !line.includes('[CORRECT]') && !line.includes('✓')) {
          return `[CORRECT] ✓ ${line}`;
        }
        return line;
      });

      return `<p${attrs}>${updatedLines.join('')}</p>`;
    });

    return modifiedHtml;
  } catch (err) {
    console.error('Error post-processing DOCX HTML:', err);
    return htmlContent;
  }
}

