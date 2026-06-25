import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CoursePreview } from '../entities/CoursePreview';
import { CourseRow } from '../entities/CourseRow';
import { Course } from '../entities/Course';
import crypto from 'crypto';

const previewRepo = () => AppDataSource.getRepository(CoursePreview);
const rowRepo     = () => AppDataSource.getRepository(CourseRow);
const courseRepo  = () => AppDataSource.getRepository(Course);

// ─── Genera el HTML completo a partir de las filas actuales del curso ────────
function buildPreviewHtml(courseName: string, rows: CourseRow[]): string {
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

  // Replicar exactamente el sort del frontend: por moduloNumero numérico
  const classGroups = groupOrder.map(k => groupMap.get(k)!);
  classGroups.sort((a, b) => {
    const numA = parseInt(a.moduloNumero || '', 10);
    const numB = parseInt(b.moduloNumero || '', 10);
    const hasA = !isNaN(numA);
    const hasB = !isNaN(numB);
    if (hasA && hasB) return numA - numB;
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });


  const now = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'full', timeStyle: 'short' });

  const bodyParts: string[] = [
    `<div style="width:100%;max-width:900px;">
      <h1 style="margin:0 0 0.4rem 0;font-size:2rem;font-weight:800;color:#fff;">${courseName}</h1>
      <p style="margin:0 0 0.75rem;color:#a1a1aa;font-size:0.95rem;">Resumen ordenado de las clases maquetadas para alumnos.</p>
      <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(20,184,166,0.12);border:1px solid rgba(20,184,166,0.3);border-radius:8px;padding:4px 12px;font-size:0.75rem;color:#14b8a6;">
        🕐 Actualizado: ${now}
      </div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin-top:1.5rem;">
    </div>`,
  ];

  classGroups.forEach((group, idx) => {
    const classHtmls = group.rows.map(r => r.generatedHtml).filter(Boolean) as string[];
    const materia = group.rows[0]?.materia || '';
    // Nombres del contenido (descripcion de cada row, sin duplicados)
    const contenidos = [...new Set(
      group.rows.map(r => r.descripcion).filter(d => d && d.trim())
    )];

    if (idx > 0) bodyParts.push('<hr class="class-separator">');

    bodyParts.push(`<div class="preview-class-section">
      <!-- Cabezal de clase -->
      <div style="
        background: linear-gradient(135deg, #0d3d38 0%, #0a2e2a 100%);
        border-radius: 16px;
        border-left: 5px solid #14b8a6;
        padding: 2rem 2.5rem;
        margin-bottom: 2rem;
        position: relative;
        overflow: hidden;
      ">
        <!-- Badge clase -->
        <div style="margin-bottom: 1rem;">
          <span style="
            background: #14b8a6;
            color: #fff;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 20px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            font-family: 'Manrope', sans-serif;
          ">Clase ${group.moduloNumero || (idx + 1)}</span>
        </div>
        <!-- Materia (tamaño mediano) -->
        ${materia ? `<p style="
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 700;
          color: #14b8a6;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-family: 'Manrope', sans-serif;
        ">${materia}</p>` : ''}
        <!-- Nombre de la clase (tamaño grande) -->
        <h2 style="
          margin: 0 0 1rem 0;
          font-family: 'Bebas Neue', 'Impact', sans-serif;
          font-size: 2.8rem;
          font-weight: 400;
          color: #ffffff;
          line-height: 1.05;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        ">${group.name}</h2>
        <!-- Nombres del contenido (tamaño chico) -->
        ${contenidos.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.25rem;">
          ${contenidos.map(c => `<span style="
            font-size: 0.75rem;
            color: rgba(255,255,255,0.55);
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 3px 10px;
            font-family: 'Manrope', sans-serif;
          ">${c}</span>`).join('')}
        </div>` : ''}
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
// Crea o devuelve el link permanente del curso (upsert por courseId)
export const createPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, courseName } = req.body as { courseId: string; courseName?: string };

    if (!courseId) {
      res.status(400).json({ message: 'El campo courseId es requerido.' });
      return;
    }

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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Vary', '*');
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
