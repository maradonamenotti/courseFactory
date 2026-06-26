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
        ">${group.name}        </h2>
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

function getArgentinaDateParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
}

export function getBypassToken(rowId: string): string {
  const secret = process.env.JWT_SECRET || 'coursefactory-bypass-fallback-secret-key-1234';
  return crypto.createHmac('sha256', secret).update(rowId).digest('hex').slice(0, 16);
}

function buildCountdownWidgetHtml(row: CourseRow, targetTimestampMs: number, targetFormattedDate: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Disponible próximamente</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 120px;
      background: transparent;
      overflow: hidden;
      box-sizing: border-box;
    }
    .widget-container {
      background: linear-gradient(135deg, #0d3d38 0%, #0a2e2a 100%);
      border: 1px solid rgba(20, 184, 166, 0.3);
      border-radius: 12px;
      padding: 10px 16px;
      width: calc(100% - 4px);
      height: calc(100% - 4px);
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      box-sizing: border-box;
      gap: 12px;
    }
    .info-col {
      text-align: left;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .title {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #14b8a6;
      margin: 0 0 2px 0;
      font-weight: 700;
    }
    .classname {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.5rem;
      color: #ffffff;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 260px;
      line-height: 1.1;
    }
    .timer-col {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .timer-part {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 32px;
    }
    .timer-num {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.6rem;
      color: #ffffff;
      text-shadow: 0 0 6px rgba(20, 184, 166, 0.4);
      line-height: 1;
    }
    .timer-label {
      font-size: 0.5rem;
      text-transform: uppercase;
      color: #94a3b8;
      margin-top: 1px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    .timer-sep {
      color: rgba(20, 184, 166, 0.5);
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.4rem;
      line-height: 1;
      padding-bottom: 8px;
    }
    .available-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(20, 184, 166, 0.1);
      border: 1px solid rgba(20, 184, 166, 0.3);
      color: #14b8a6;
      font-weight: 700;
      font-size: 0.75rem;
      padding: 6px 12px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-left: auto;
    }
    @media (max-width: 480px) {
      .widget-container {
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        gap: 6px;
      }
      .info-col {
        align-items: center;
        text-align: center;
      }
      .classname {
        font-size: 1.2rem;
      }
      .timer-num {
        font-size: 1.3rem;
      }
    }
  </style>
</head>
<body>
  <div class="widget-container" id="countdown-widget">
    <div class="info-col">
      <p class="title">Disponible próximamente</p>
      <h2 class="classname">${row.modulo || 'Próxima Clase'}</h2>
    </div>
    <div class="timer-col">
      <div class="timer-part">
        <span class="timer-num" id="days">00</span>
        <span class="timer-label">Días</span>
      </div>
      <span class="timer-sep">:</span>
      <div class="timer-part">
        <span class="timer-num" id="hours">00</span>
        <span class="timer-label">Horas</span>
      </div>
      <span class="timer-sep">:</span>
      <div class="timer-part">
        <span class="timer-num" id="minutes">00</span>
        <span class="timer-label">Min</span>
      </div>
      <span class="timer-sep">:</span>
      <div class="timer-part">
        <span class="timer-num" id="seconds">00</span>
        <span class="timer-label">Seg</span>
      </div>
    </div>
  </div>

  <script>
    const targetMs = ${targetTimestampMs};
    function updateCountdown() {
      if (targetMs <= 0) {
        showAvailable();
        return;
      }
      const now = Date.now();
      const diff = targetMs - now;
      if (diff <= 0) {
        showAvailable();
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      document.getElementById('days').innerText = String(days).padStart(2, '0');
      document.getElementById('hours').innerText = String(hours).padStart(2, '0');
      document.getElementById('minutes').innerText = String(minutes).padStart(2, '0');
      document.getElementById('seconds').innerText = String(seconds).padStart(2, '0');
    }
    
    function showAvailable() {
      document.getElementById('countdown-widget').innerHTML = \`
        <div class="info-col">
          <p class="title">Clase habilitada</p>
          <h2 class="classname">${row.modulo || 'Próxima Clase'}</h2>
        </div>
        <div class="available-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Clase disponible
        </div>
      \`;
    }
    
    if (targetMs > 0) {
      setInterval(updateCountdown, 1000);
      updateCountdown();
    } else {
      showAvailable();
    }
  </script>
</body>
</html>`;
}

function buildClassLockedHtml(row: CourseRow, targetTimestampMs: number, targetFormattedDate: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clase reservada</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 2rem;
      background-color: #0f0f12;
      color: #ffffff;
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .lock-card {
      background: linear-gradient(135deg, #0d3d38 0%, #0a2e2a 100%);
      border: 1px solid rgba(20, 184, 166, 0.3);
      border-radius: 20px;
      padding: 3rem 2rem;
      max-width: 550px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }
    .icon-container {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(20, 184, 166, 0.1);
      border: 1px solid rgba(20, 184, 166, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #14b8a6;
      box-shadow: 0 0 20px rgba(20, 184, 166, 0.2);
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 20px rgba(20, 184, 166, 0.2); }
      50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(20, 184, 166, 0.4); }
      100% { transform: scale(1); box-shadow: 0 0 20px rgba(20, 184, 166, 0.2); }
    }
    .materia {
      font-size: 0.9rem;
      font-weight: 700;
      color: #14b8a6;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin: 0;
    }
    .classname {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 2.8rem;
      color: #ffffff;
      line-height: 1;
      margin: 0;
      text-transform: uppercase;
    }
    .description {
      color: #94a3b8;
      font-size: 1rem;
      line-height: 1.5;
      margin: 0;
    }
    .date-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 18px;
      border-radius: 30px;
      font-weight: 600;
      font-size: 0.95rem;
      color: #e2e8f0;
      letter-spacing: 0.5px;
    }
    .timer-container {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 0.5rem;
    }
    .timer-part {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 60px;
    }
    .timer-num {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 3rem;
      color: #ffffff;
      line-height: 1;
    }
    .timer-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      color: #94a3b8;
      margin-top: 4px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .timer-sep {
      color: rgba(20, 184, 166, 0.5);
      font-family: 'Bebas Neue', sans-serif;
      font-size: 2.5rem;
      line-height: 1;
      padding-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="lock-card">
    <div class="icon-container">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    
    <div>
      ${row.materia ? `<p class="materia">${row.materia}</p>` : ''}
      <h1 class="classname">${row.modulo || 'Clase Reservada'}</h1>
    </div>
    
    <p class="description">El contenido de esta clase estará disponible próximamente.</p>
    
    <div class="date-badge">
      Disponible el ${targetFormattedDate}
    </div>
    
    <div class="timer-container" id="timer-box">
      <div class="timer-part">
        <span class="timer-num" id="days">00</span>
        <span class="timer-label">Días</span>
      </div>
      <span class="timer-sep">:</span>
      <div class="timer-part">
        <span class="timer-num" id="hours">00</span>
        <span class="timer-label">Horas</span>
      </div>
      <span class="timer-sep">:</span>
      <div class="timer-part">
        <span class="timer-num" id="minutes">00</span>
        <span class="timer-label">Minutos</span>
      </div>
      <span class="timer-sep">:</span>
      <div class="timer-part">
        <span class="timer-num" id="seconds">00</span>
        <span class="timer-label">Segundos</span>
      </div>
    </div>
  </div>

  <script>
    const targetMs = ${targetTimestampMs};
    function updateCountdown() {
      const now = Date.now();
      const diff = targetMs - now;
      if (diff <= 0) {
        // Habilitado, recargar la página para cargar la clase real
        window.location.reload();
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      document.getElementById('days').innerText = String(days).padStart(2, '0');
      document.getElementById('hours').innerText = String(hours).padStart(2, '0');
      document.getElementById('minutes').innerText = String(minutes).padStart(2, '0');
      document.getElementById('seconds').innerText = String(seconds).padStart(2, '0');
    }
    setInterval(updateCountdown, 1000);
    updateCountdown();
  </script>
</body>
</html>`;
}

function buildRowPreviewHtml(row: CourseRow): string {
  const cleanHtml = (row.generatedHtml || '')
    .replace(/<h3[^>]*>[\s\S]*?📖[\s\S]*?<\/h3>/i, '')
    .replace(
      /(<div[^>]*class="[^"]*block-text[^"]*"[^>]*>[\s\S]{0,300}?)<h3[^>]*>\s*\d+\.\s*[\s\S]{1,150}<\/h3>\s*<p[^>]*>[\s\S]{1,250}<\/p>\s*<p[^>]*>[\s\S]{0,150}<\/p>/gi,
      '$1'
    );

  const headerHtml = `
<div style="
  background: linear-gradient(135deg, #0d3d38 0%, #0a2e2a 100%);
  border-left: 5px solid #14b8a6;
  padding: 2rem 2.5rem;
  margin-bottom: 1.5rem;
  font-family: 'Manrope', Arial, sans-serif;
  border-radius: 12px;
">
  ${row.materia ? `<p style="margin:0 0 0.4rem 0;font-size:0.9rem;font-weight:700;color:#14b8a6;text-transform:uppercase;letter-spacing:0.12em;font-family:Arial,sans-serif;">${row.materia}</p>` : ''}
  <h2 style="margin:0;font-family:Impact,Arial,sans-serif;font-size:2.2rem;font-weight:900;color:#ffffff;line-height:1.05;letter-spacing:0.03em;text-transform:uppercase;">${row.modulo || ''}</h2>
</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clase — ${row.modulo || 'Detalle'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto:wght@400;500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 1.5rem;
      background-color: #f9fafb;
      font-family: 'Roboto', Arial, sans-serif;
    }
  </style>
</head>
<body>
  ${headerHtml}
  ${cleanHtml}
</body>
</html>`;
}

export const getRowPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rowId } = req.params;
    const { mode, token } = req.query;

    const row = await rowRepo().findOne({ where: { id: rowId } });
    if (!row) {
      res.status(404).send(errorPage('🔍 Clase no encontrada', 'Esta clase o código no existe.'));
      return;
    }

    // Calcular token esperado para bypass de docentes
    const expectedToken = getBypassToken(row.id);
    const isTeacher = token === expectedToken;

    // Verificar disponibilidad por fecha
    let isLocked = false;
    let targetTimestampMs = 0;
    let targetFormattedDate = '';

    if (row.fechaDisponibilidad) {
      const { year, month, day } = getArgentinaDateParts();
      const todayStr = `${year}-${month}-${day}`; // YYYY-MM-DD
      
      if (todayStr < row.fechaDisponibilidad) {
        isLocked = true;
        // Argentina es UTC-3, así que YYYY-MM-DD 00:00:00 en Argentina equivale a YYYY-MM-DD 03:00:00 UTC
        const targetUtcDate = new Date(`${row.fechaDisponibilidad}T03:00:00Z`);
        targetTimestampMs = targetUtcDate.getTime();
        const dateParts = row.fechaDisponibilidad.split('-');
        targetFormattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      }
    }

    // Cabeceras de cache
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Vary', '*');

    // Ruteo según el modo
    if (mode === 'countdown') {
      if (isLocked) {
        res.send(buildCountdownWidgetHtml(row, targetTimestampMs, targetFormattedDate));
      } else {
        res.send(buildCountdownWidgetHtml(row, 0, ''));
      }
      return;
    }

    // Modo clase (o default)
    if (isLocked && !isTeacher) {
      res.send(buildClassLockedHtml(row, targetTimestampMs, targetFormattedDate));
      return;
    }

    // Si ya está liberada o es docente, mostramos la clase
    if (!row.generatedHtml) {
      res.status(404).send(errorPage('📭 Contenido no disponible', 'Esta clase aún no tiene contenido maquetado o aprobado.'));
      return;
    }

    const html = buildRowPreviewHtml(row);
    res.send(html);
  } catch (error) {
    console.error('[preview] Error al obtener preview de fila:', error);
    res.status(500).send(errorPage('❌ Error interno', 'Ocurrió un error al cargar el contenido.'));
  }
};

