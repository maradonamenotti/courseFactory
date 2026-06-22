import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CoursePreview } from '../entities/CoursePreview';
import { CourseRow } from '../entities/CourseRow';
import { Course } from '../entities/Course';
import crypto from 'crypto';

const previewRepo = () => AppDataSource.getRepository(CoursePreview);
const rowRepo    = () => AppDataSource.getRepository(CourseRow);
const courseRepo = () => AppDataSource.getRepository(Course);

// ─── Genera el HTML completo a partir de las filas actuales del curso ────────
function buildPreviewHtml(courseName: string, rows: CourseRow[]): string {
  // Agrupar por módulo (misma lógica que el frontend)
  const groupMap = new Map<string, { name: string; moduloNumero: string | null; rows: CourseRow[] }>();
  const groupOrder: string[] = [];

  for (const row of rows) {
    const key = row.modulo || 'Sin clase';
    if (!groupMap.has(key)) {
      groupMap.set(key, { name: key, moduloNumero: row.moduloNumero, rows: [] });
      groupOrder.push(key);
    }
    groupMap.get(key)!.rows.push(row);
  }

  const classGroups = groupOrder.map(k => groupMap.get(k)!);

  const bodyParts: string[] = [
    `<div style="width:100%;max-width:900px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:2rem;margin-bottom:1rem;">
      <h1 style="margin:0 0 0.5rem 0;font-size:2rem;font-weight:800;color:#fff;">${courseName}</h1>
      <p style="margin:0;color:#a1a1aa;font-size:0.95rem;">Resumen ordenado de las clases maquetadas para alumnos.</p>
    </div>`,
  ];

  classGroups.forEach((group, idx) => {
    const classHtmls = group.rows.map(r => r.generatedHtml).filter(Boolean) as string[];
    if (idx > 0) bodyParts.push('<hr class="class-separator">');
    bodyParts.push(`<div class="preview-class-section">
      <div style="margin-bottom:1.5rem;display:flex;align-items:center;gap:8px;">
        <span style="font-size:0.8rem;background:#14b8a6;color:#fff;padding:4px 8px;border-radius:6px;font-weight:bold;">
          Clase ${group.moduloNumero || (idx + 1)}
        </span>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700;color:#f4f4f5;">${group.name}</h2>
      </div>`);
    if (classHtmls.length > 0) {
      classHtmls.forEach(h => bodyParts.push(h));
    } else {
      bodyParts.push('<div class="no-html-placeholder"><h3>Contenido No Generado</h3><p>Esta clase aún no tiene HTML aprobado.</p></div>');
    }
    bodyParts.push('</div>');
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vista Previa — ${courseName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto:wght@400;500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { background-color:#0f0f12; color:#e4e4e7; font-family:Roboto,system-ui,sans-serif; margin:0; padding:3rem 1.5rem; display:flex; flex-direction:column; align-items:center; gap:3rem; }
    .preview-class-section { width:100%; max-width:900px; }
    .class-separator { width:100%; max-width:900px; margin:4rem 0; border:none; border-top:3px dashed #14b8a6; position:relative; opacity:0.4; }
    .class-separator::after { content:"Siguiente Clase"; position:absolute; top:-12px; left:50%; transform:translateX(-50%); background-color:#0f0f12; color:#14b8a6; padding:0 20px; font-weight:800; font-size:0.8rem; text-transform:uppercase; letter-spacing:2px; }
    .no-html-placeholder { background:rgba(255,255,255,0.02); border:2px dashed rgba(255,255,255,0.08); border-radius:16px; padding:3rem; text-align:center; color:#71717a; }
  </style>
</head>
<body>
${bodyParts.join('\n')}
</body>
</html>`;
}

// ─── POST /api/preview ──────────────────────────────────────────────────────
// Crea o devuelve un link permanente para el curso (upsert por courseId)
export const createPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, courseName } = req.body as { courseId: string; courseName?: string };

    if (!courseId) {
      res.status(400).json({ message: 'El campo courseId es requerido.' });
      return;
    }

    // Buscar si ya existe un token para este curso → upsert
    let preview = await previewRepo().findOne({ where: { courseId } });

    if (!preview) {
      const token = crypto.randomBytes(7).toString('base64url').slice(0, 10);
      preview = previewRepo().create({
        token,
        courseId,
        courseName: courseName || 'Vista Previa del Curso',
      });
      await previewRepo().save(preview);
    } else if (courseName && preview.courseName !== courseName) {
      // Actualizar nombre si cambió
      preview.courseName = courseName;
      await previewRepo().save(preview);
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://cf.maradonamenotti.cloud';
    const shareUrl = `${baseUrl}/api/preview/${preview.token}`;

    res.status(200).json({
      token: preview.token,
      url: shareUrl,
      permanent: true,
    });
  } catch (error) {
    console.error('[preview] Error al crear preview:', error);
    res.status(500).json({ message: 'Error interno al crear el enlace de preview.' });
  }
};

// ─── GET /api/preview/:token ─────────────────────────────────────────────────
// Endpoint PÚBLICO — genera el HTML en tiempo real desde los datos actuales de la DB
export const getPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const preview = await previewRepo().findOne({ where: { token } });
    if (!preview) {
      res.status(404).send(errorPage('🔍 Preview no encontrada', 'Este enlace no existe.'));
      return;
    }

    const course = await courseRepo().findOne({ where: { id: preview.courseId } });
    const rows   = await rowRepo().find({
      where: { courseId: preview.courseId },
      order: { sortOrder: 'ASC' },
    });

    const courseName = course?.name || preview.courseName;
    const html = buildPreviewHtml(courseName, rows);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (error) {
    console.error('[preview] Error al obtener preview:', error);
    res.status(500).json({ message: 'Error interno.' });
  }
};

function errorPage(title: string, msg: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
  <style>body{background:#0f0f12;color:#e4e4e7;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:1rem;}
  h1{font-size:1.5rem;color:#f4f4f5;}p{color:#71717a;}</style></head>
  <body><h1>${title}</h1><p>${msg}</p></body></html>`;
}


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
    const shareUrl = `${baseUrl}/api/preview/${token}`;

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
