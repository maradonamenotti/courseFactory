import { Request, Response } from 'express';
import multer from 'multer';

// Multer en memoria para recibir el video
export const uploadVimeoMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB máx para videos
});

const VIMEO_API = 'https://api.vimeo.com';

const getVimeoToken = () => {
  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) throw new Error('VIMEO_ACCESS_TOKEN no configurado en el servidor');
  return token;
};

// ─── POST /api/vimeo/upload ───────────────────────────────────────────────────
// Flujo: crea el video en Vimeo → sube el archivo → devuelve el link embed
export const uploadToVimeo = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: 'No se proporcionó ningún archivo de video' });
    return;
  }

  let token: string;
  try {
    token = getVimeoToken();
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
    return;
  }

  const { name = 'Sin título', description = '' } = req.body;
  const fileSize = req.file.size;

  try {
    // ── Step 1: Crear el video en Vimeo (tus approach) ──────────────────────
    const createRes = await fetch(`${VIMEO_API}/me/videos`, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
      body: JSON.stringify({
        upload: {
          approach: 'tus',
          size: fileSize,
        },
        name,
        description,
        privacy: { view: 'anybody' },
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      throw new Error(`Vimeo create error ${createRes.status}: ${JSON.stringify(errBody)}`);
    }

    const videoData = await createRes.json() as {
      uri: string;
      link: string;
      upload: { upload_link: string };
    };

    const uploadLink = videoData.upload?.upload_link;
    const vimeoUri = videoData.uri;           // /videos/123456
    const videoId = vimeoUri.split('/').pop(); // 123456

    if (!uploadLink) {
      throw new Error('Vimeo no devolvió un upload_link');
    }

    // ── Step 2: Subir el archivo vía TUS (PATCH con todo el buffer) ──────────
    const uploadRes = await fetch(uploadLink, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': '0',
        'Tus-Resumable': '1.0.0',
      },
      body: req.file.buffer,
    });

    if (!uploadRes.ok) {
      throw new Error(`Vimeo upload error ${uploadRes.status}`);
    }

    // ── Step 3: Devolver la URL embeddable ───────────────────────────────────
    const embedUrl = `https://player.vimeo.com/video/${videoId}`;

    res.json({
      videoId,
      uri: vimeoUri,
      embedUrl,
      link: videoData.link,
      status: 'uploaded',
    });
  } catch (error) {
    console.error('Error subiendo a Vimeo:', error);
    res.status(500).json({ message: (error as Error).message || 'Error al subir el video a Vimeo' });
  }
};

// ─── GET /api/vimeo/status/:videoId ──────────────────────────────────────────
// Consulta el estado de procesamiento de un video en Vimeo
export const getVimeoVideoStatus = async (req: Request, res: Response): Promise<void> => {
  const { videoId } = req.params;

  let token: string;
  try {
    token = getVimeoToken();
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
    return;
  }

  try {
    const infoRes = await fetch(`${VIMEO_API}/videos/${videoId}`, {
      headers: {
        Authorization: `bearer ${token}`,
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
    });

    if (!infoRes.ok) {
      res.status(infoRes.status).json({ message: `Vimeo error ${infoRes.status}` });
      return;
    }

    const data = await infoRes.json() as {
      transcode?: { status: string };
      status: string;
      link: string;
      uri: string;
    };

    res.json({
      videoId,
      status: data.transcode?.status || data.status,
      link: data.link,
      embedUrl: `https://player.vimeo.com/video/${videoId}`,
    });
  } catch (error) {
    console.error('Error consultando Vimeo:', error);
    res.status(500).json({ message: 'Error al consultar el estado del video en Vimeo' });
  }
};
