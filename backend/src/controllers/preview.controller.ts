import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CoursePreview } from '../entities/CoursePreview';
import crypto from 'crypto';

const previewRepo = () => AppDataSource.getRepository(CoursePreview);

// ─── POST /api/preview ──────────────────────────────────────────────────────
// Crea un enlace público compartible con el HTML de la vista previa
// Requiere autenticación (solo usuarios logueados pueden crear previews)
export const createPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { html, courseName } = req.body as { html: string; courseName?: string };

    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      res.status(400).json({ message: 'El campo html es requerido y no puede estar vacío.' });
      return;
    }

    // Token URL-safe de 10 caracteres (suficientemente único y corto para compartir)
    const token = crypto.randomBytes(7).toString('base64url').slice(0, 10);

    // Expiración: 7 días desde ahora
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const preview = previewRepo().create({
      token,
      html,
      courseName: courseName || 'Vista Previa del Curso',
      expiresAt,
    });

    await previewRepo().save(preview);

    const baseUrl = process.env.FRONTEND_URL || 'https://cf.maradonamenotti.cloud';
    const shareUrl = `${baseUrl}/preview/${token}`;

    res.status(201).json({
      token,
      url: shareUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[preview] Error al crear preview:', error);
    res.status(500).json({ message: 'Error interno al crear el enlace de preview.' });
  }
};

// ─── GET /api/preview/:token ─────────────────────────────────────────────────
// Endpoint PÚBLICO — sirve el HTML de la preview sin requerir autenticación
export const getPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const preview = await previewRepo().findOne({ where: { token } });

    if (!preview) {
      res.status(404).send(`
        <!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
        <title>Preview no encontrado</title>
        <style>body{background:#0f0f12;color:#e4e4e7;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:1rem;}
        h1{font-size:1.5rem;color:#f4f4f5;}p{color:#71717a;}</style></head>
        <body><h1>🔍 Preview no encontrada</h1><p>Este enlace no existe o ha expirado.</p></body></html>
      `);
      return;
    }

    // Verificar expiración
    if (new Date() > new Date(preview.expiresAt)) {
      res.status(410).send(`
        <!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
        <title>Preview expirada</title>
        <style>body{background:#0f0f12;color:#e4e4e7;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:1rem;}
        h1{font-size:1.5rem;color:#f4f4f5;}p{color:#71717a;}</style></head>
        <body><h1>⏰ Enlace expirado</h1><p>Este enlace de vista previa ya no está disponible.</p></body></html>
      `);
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(preview.html);
  } catch (error) {
    console.error('[preview] Error al obtener preview:', error);
    res.status(500).json({ message: 'Error interno.' });
  }
};
