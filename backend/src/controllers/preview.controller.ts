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
        background: linear-gradient(135deg, #002d2b 0%, #14263d 100%);
        border-radius: 16px;
        border-left: 5px solid #00968f;
        padding: 2rem 2.5rem;
        margin-bottom: 2rem;
        position: relative;
        overflow: hidden;
      ">
        <!-- Badge clase -->
        <div style="margin-bottom: 1rem;">
          <span style="
            background: #00968f;
            color: #fff;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 20px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            font-family: 'Roboto', sans-serif;
          ">Clase ${group.moduloNumero || (idx + 1)}</span>
        </div>
        <!-- Materia (tamaño mediano) -->
        ${materia ? `<p style="
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 700;
          color: #00fff4;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-family: 'Roboto', sans-serif;
        ">${materia}</p>` : ''}
        <!-- Nombre de la clase (tamaño grande) -->
        <h2 style="
          margin: 0 0 1rem 0;
          font-family: 'Roboto', sans-serif;
          font-size: 2.3rem;
          font-weight: 900;
          color: #ffffff;
          line-height: 1.1;
          letter-spacing: 0.01em;
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
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { background-color:#0f0f12; color:#e4e4e7; font-family:Roboto,system-ui,sans-serif; margin:0; padding:3rem 1.5rem; display:flex; flex-direction:column; align-items:center; gap:3rem; }
    .preview-class-section { width:100%; max-width:900px; }
    .class-separator { width:100%; max-width:900px; margin:4rem 0; border:none; border-top:3px dashed #00968f; position:relative; opacity:0.4; }
    .class-separator::after { content:"Siguiente Clase"; position:absolute; top:-12px; left:50%; transform:translateX(-50%); background-color:#0f0f12; color:#00968f; padding:0 20px; font-weight:800; font-size:0.8rem; text-transform:uppercase; letter-spacing:2px; }
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
export function getCourseBypassToken(previewToken: string): string {
  const secret = process.env.JWT_SECRET || 'coursefactory-bypass-fallback-secret-key-1234';
  return crypto.createHmac('sha256', secret).update(previewToken).digest('hex').slice(0, 16);
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
    const bypassToken = getCourseBypassToken(preview.token);

    res.status(200).json({
      token: preview.token,
      url: shareUrl,
      bypassToken,
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
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet">
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
      background: linear-gradient(135deg, #002d2b 0%, #14263d 100%);
      border: 1px solid rgba(0, 150, 143, 0.3);
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
      color: #00fff4;
      margin: 0 0 2px 0;
      font-weight: 700;
    }
    .classname {
      font-family: 'Roboto', sans-serif;
      font-size: 1.35rem;
      font-weight: 700;
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
      font-family: 'Roboto', sans-serif;
      font-size: 1.4rem;
      font-weight: 900;
      color: #ffffff;
      text-shadow: 0 0 6px rgba(0, 255, 244, 0.4);
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
      color: rgba(0, 255, 244, 0.5);
      font-family: 'Roboto', sans-serif;
      font-size: 1.2rem;
      font-weight: 700;
      line-height: 1;
      padding-bottom: 2px;
    }
    .available-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 150, 143, 0.1);
      border: 1px solid rgba(0, 150, 143, 0.3);
      color: #00fff4;
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
    let countdownInterval = null;

    function updateCountdown() {
      if (targetMs <= 0) {
        showAvailable();
        if (countdownInterval) clearInterval(countdownInterval);
        return;
      }
      const now = Date.now();
      const diff = targetMs - now;
      if (diff <= 0) {
        showAvailable();
        if (countdownInterval) clearInterval(countdownInterval);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      const dEl = document.getElementById('days');
      const hEl = document.getElementById('hours');
      const mEl = document.getElementById('minutes');
      const sEl = document.getElementById('seconds');

      if (dEl) dEl.innerText = String(days).padStart(2, '0');
      if (hEl) hEl.innerText = String(hours).padStart(2, '0');
      if (mEl) mEl.innerText = String(minutes).padStart(2, '0');
      if (sEl) sEl.innerText = String(seconds).padStart(2, '0');
    }
    
    function showAvailable() {
      const widget = document.getElementById('countdown-widget');
      if (widget) {
        widget.innerHTML = \`
          <div class="info-col">
            <p class="title">Clase habilitada</p>
            <h2 class="classname">\${row.modulo || 'Próxima Clase'}</h2>
          </div>
          <div class="available-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Clase disponible
          </div>
        \`;
      }
    }
    
    const initialDiff = targetMs - Date.now();
    if (targetMs > 0 && initialDiff > 0) {
      countdownInterval = setInterval(updateCountdown, 1000);
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
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
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
      background: linear-gradient(135deg, #002d2b 0%, #14263d 100%);
      border: 1px solid rgba(0, 150, 143, 0.3);
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
      background: rgba(0, 150, 143, 0.1);
      border: 1px solid rgba(0, 150, 143, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #00fff4;
      box-shadow: 0 0 20px rgba(0, 150, 143, 0.2);
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 150, 143, 0.2); }
      50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(0, 150, 143, 0.4); }
      100% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 150, 143, 0.2); }
    }
    .materia {
      font-size: 0.9rem;
      font-weight: 700;
      color: #00fff4;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin: 0;
    }
    .classname {
      font-family: 'Roboto', sans-serif;
      font-size: 2.2rem;
      font-weight: 900;
      color: #ffffff;
      line-height: 1.1;
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
      font-family: 'Roboto', sans-serif;
      font-size: 2.5rem;
      font-weight: 900;
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
      color: rgba(0, 255, 244, 0.5);
      font-family: 'Roboto', sans-serif;
      font-size: 2rem;
      font-weight: 700;
      line-height: 1;
      padding-bottom: 6px;
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
    let countdownInterval = null;
    
    function showManualReloadButton() {
      const timerBox = document.getElementById('timer-box');
      if (timerBox) {
        timerBox.innerHTML = \`
          <button onclick="clearReloadAndRefresh()" style="
            background: #00968f;
            color: #ffffff;
            border: none;
            padding: 10px 24px;
            font-size: 0.95rem;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Roboto', sans-serif;
            box-shadow: 0 4px 12px rgba(0, 150, 143, 0.3);
            transition: all 0.2s ease;
          " onmouseover="this.style.background='#007a75'" onmouseout="this.style.background='#00968f'">
            Verificar disponibilidad de la clase
          </button>
        \`;
      }
      const desc = document.querySelector('.description');
      if (desc) {
        desc.innerText = 'La fecha de lanzamiento ya se ha cumplido. Si el contenido no se muestra automáticamente, haz clic en el botón para verificar.';
      }
    }

    function clearReloadAndRefresh() {
      const reloadKey = 'cf_reload_' + targetMs;
      sessionStorage.removeItem(reloadKey);
      window.location.reload();
    }

    function updateCountdown() {
      const now = Date.now();
      const diff = targetMs - now;
      if (diff <= 0) {
        if (countdownInterval) clearInterval(countdownInterval);
        const reloadKey = 'cf_reload_' + targetMs;
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, 'true');
          window.location.reload();
        } else {
          showManualReloadButton();
        }
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      const dEl = document.getElementById('days');
      const hEl = document.getElementById('hours');
      const mEl = document.getElementById('minutes');
      const sEl = document.getElementById('seconds');
      
      if (dEl) dEl.innerText = String(days).padStart(2, '0');
      if (hEl) hEl.innerText = String(hours).padStart(2, '0');
      if (mEl) mEl.innerText = String(minutes).padStart(2, '0');
      if (sEl) sEl.innerText = String(seconds).padStart(2, '0');
    }

    const initialDiff = targetMs - Date.now();
    if (initialDiff > 0) {
      countdownInterval = setInterval(updateCountdown, 1000);
      updateCountdown();
    } else {
      updateCountdown();
    }
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
  background: linear-gradient(135deg, #002d2b 0%, #14263d 100%);
  border-left: 5px solid #00968f;
  padding: 2rem 2.5rem;
  margin-bottom: 1.5rem;
  font-family: 'Roboto', Arial, sans-serif;
  border-radius: 12px;
">
  ${row.materia ? `<p style="margin:0 0 0.4rem 0;font-size:0.9rem;font-weight:700;color:#00fff4;text-transform:uppercase;letter-spacing:0.12em;font-family:'Roboto',Arial,sans-serif;">${row.materia}</p>` : ''}
  <h2 style="margin:0;font-family:'Roboto',Arial,sans-serif;font-size:2.2rem;font-weight:900;color:#ffffff;line-height:1.05;letter-spacing:0.03em;text-transform:uppercase;">${row.modulo || ''}</h2>
</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clase — ${row.modulo || 'Detalle'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
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
  <div id="iframe-back-bar" style="display: none; padding: 10px 1.5rem; background: #ffffff; border: 1px solid #e2e8f0; margin-bottom: 1.5rem; border-radius: 8px; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <button onclick="window.history.back()" style="background: none; border: none; color: #00968f; font-family: inherit; font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 0; outline: none;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      <span>Volver al Cronograma</span>
    </button>
  </div>
  <script>
    if (window.self !== window.top) {
      document.getElementById('iframe-back-bar').style.display = 'flex';
    }
  </script>
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

// Helper to build the interactive Schedule (Cronograma) HTML
function buildScheduleHtml(
  courseName: string,
  groups: any[],
  subjects: string[],
  isTeacherBypass: boolean,
  previewToken: string
): string {
  const totalClasses = groups.length;
  let totalResources = 0;
  const materiasSet = new Set<string>();
  
  groups.forEach(g => {
    totalResources += g.rows.length;
    g.rows.forEach((r: any) => {
      if (r.materia) materiasSet.add(r.materia);
    });
  });

  const subjectOptions = subjects.map(s => `<option value="${s.toLowerCase()}">${s}</option>`).join('\n');

  const subjectMap = new Map<string, string[]>();
  const subjectOrder: string[] = [];

  groups.forEach((group, index) => {
    const groupRows = group.rows as CourseRow[];
    const firstRow = groupRows[0];
    const materia = firstRow?.materia || 'General';
    const moduloNumero = group.moduloNumero || (index + 1).toString();
    const cleanMateria = materia.toLowerCase();

    const fechaDisponibilidad = groupRows.find(r => r.fechaDisponibilidad)?.fechaDisponibilidad || null;

    let isLocked = false;
    let targetTimestampMs = 0;
    let targetFormattedDate = '';

    if (fechaDisponibilidad) {
      const { year, month, day } = getArgentinaDateParts();
      const todayStr = `${year}-${month}-${day}`;
      
      if (todayStr < fechaDisponibilidad) {
        isLocked = true;
        const targetUtcDate = new Date(`${fechaDisponibilidad}T03:00:00Z`);
        targetTimestampMs = targetUtcDate.getTime();
        const dateParts = fechaDisponibilidad.split('-');
        targetFormattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      }
    }

    let statusBadge = '';
    let statusClass = '';
    let displayStatus = '';

    if (isTeacherBypass) {
      if (isLocked) {
        statusBadge = `<span class="badge badge-bypass">Vista Docente (Bypass)</span>`;
        statusClass = 'status-bypass';
        displayStatus = 'available';
      } else {
        statusBadge = `<span class="badge badge-available">Disponible</span>`;
        statusClass = 'status-available';
        displayStatus = 'available';
      }
    } else {
      if (isLocked) {
        statusBadge = `<span class="badge badge-locked">📅 Próximamente: ${targetFormattedDate}</span>`;
        statusClass = 'status-locked';
        displayStatus = 'locked';
      } else {
        statusBadge = `<span class="badge badge-available">Disponible</span>`;
        statusClass = 'status-available';
        displayStatus = 'available';
      }
    }

    let contentHtml = '';
    if (isLocked && !isTeacherBypass) {
      contentHtml = `
        <div class="lock-container">
          <div class="lock-icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h4 class="lock-title">Clase programada</h4>
          <p class="lock-desc">El contenido de esta clase se habilitará automáticamente en la fecha indicada.</p>
          <div class="lock-date">Disponible el ${targetFormattedDate}</div>
          
          <div class="countdown-row" data-target="${targetTimestampMs}">
            <div class="time-box">
              <span class="time-num days">00</span>
              <span class="time-label">Días</span>
            </div>
            <span class="time-divider">:</span>
            <div class="time-box">
              <span class="time-num hours">00</span>
              <span class="time-label">Horas</span>
            </div>
            <span class="time-divider">:</span>
            <div class="time-box">
              <span class="time-num minutes">00</span>
              <span class="time-label">Min</span>
            </div>
            <span class="time-divider">:</span>
            <div class="time-box">
              <span class="time-num seconds">00</span>
              <span class="time-label">Seg</span>
            </div>
          </div>
        </div>
      `;
    } else {
      const resourcesHtml = groupRows.map(row => {
        let iconSvg = '';
        const fmt = (row.formato || 'VIDEO').toUpperCase();
        if (fmt === 'VIDEO') {
          iconSvg = `<svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>`;
        } else if (fmt === 'GENIALLY') {
          iconSvg = `<svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
        } else if (fmt === 'PDF') {
          iconSvg = `<svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        } else if (fmt === 'CUESTIONARIO') {
          iconSvg = `<svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14l2 2 4-4"></path></svg>`;
        } else {
          iconSvg = `<svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        }

        const classBypassParam = isTeacherBypass ? `?token=${getBypassToken(row.id)}` : '';
        const accessUrl = `/api/preview/clase/${row.id}${classBypassParam}`;

        return `
          <div class="resource-card">
            <div class="resource-info">
              ${iconSvg}
              <div class="resource-details">
                <span class="resource-format">${row.formato || 'CONTENIDO'}</span>
                <p class="resource-desc">${row.descripcion || 'Sin descripción'}</p>
              </div>
            </div>
            <a href="${accessUrl}" class="btn btn-access">
              <span>Acceder</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </a>
          </div>
        `;
      }).join('\n');

      contentHtml = `
        <div class="resources-list">
          <div class="resources-header">Recursos Disponibles</div>
          ${resourcesHtml}
        </div>
      `;
    }

    const searchTerms = [
      group.name,
      materia,
      `clase ${moduloNumero}`,
      ...groupRows.map(r => r.descripcion || ''),
      ...groupRows.map(r => r.formato || '')
    ].join(' ').toLowerCase().replace(/"/g, '&quot;');

    const accordionHtml = `
      <div class="accordion-item ${statusClass}" data-materia="${cleanMateria}" data-status="${displayStatus}" data-search="${searchTerms}" data-date="${fechaDisponibilidad || '1970-01-01'}" data-class-num="${moduloNumero}">
        <button class="accordion-header" onclick="toggleAccordion(this)">
          <div class="header-left">
            <div class="class-num-badge">Clase ${moduloNumero}</div>
            <div class="header-title-col">
              <h3 class="class-name">${group.name}</h3>
            </div>
          </div>
          <div class="header-right">
            ${statusBadge}
            <svg class="chevron-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </button>
        <div class="accordion-body">
          <div class="accordion-body-inner">
            ${contentHtml}
          </div>
        </div>
      </div>
    `;

    if (!subjectMap.has(materia)) {
      subjectMap.set(materia, []);
      subjectOrder.push(materia);
    }
    subjectMap.get(materia)!.push(accordionHtml);
  });

  const subjectSectionsHtml = subjectOrder.map(subject => {
    const subjectGroups = subjectMap.get(subject)!;
    const cleanSubjectAttr = subject.toLowerCase().replace(/"/g, '&quot;');
    return `
      <div class="subject-section" data-subject="${cleanSubjectAttr}">
        <div class="subject-header">
          <svg class="subject-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <h2 class="subject-title">${subject}</h2>
          <span class="subject-badge">${subjectGroups.length} ${subjectGroups.length === 1 ? 'Clase' : 'Clases'}</span>
        </div>
        <div class="subject-classes">
          ${subjectGroups.join('\n')}
        </div>
      </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cronograma del Curso — ${courseName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto:wght@400;500;700;900&family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: transparent;
      --bg-card: #ffffff;
      --border-color: #e2e8f0;
      --teal-primary: #00968f;
      --teal-hover: #007a75;
      --teal-glow: rgba(0, 150, 143, 0.15);
      --text-main: #14263d;
      --text-muted: #64748b;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      overflow-x: hidden;
    }
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Manrope', system-ui, sans-serif;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow-x: hidden;
    }

    .container {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    header {
      background: linear-gradient(135deg, #002d2b 0%, #14263d 100%);
      border: 1px solid rgba(0, 150, 143, 0.2);
      border-radius: 16px;
      padding: 2rem;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.12);
    }
    
    header::after {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 250px;
      height: 250px;
      background: var(--teal-primary);
      filter: blur(120px);
      opacity: 0.15;
      pointer-events: none;
    }

    .header-top {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .course-badge {
      align-self: flex-start;
      background: rgba(0, 150, 143, 0.12);
      border: 1px solid var(--teal-primary);
      color: var(--teal-primary);
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 4px 10px;
      border-radius: 20px;
    }

    .course-title {
      font-family: 'Roboto', sans-serif;
      font-size: 2.3rem;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: 0.01em;
      color: #ffffff;
      text-transform: uppercase;
    }

    .course-subtitle {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.95rem;
      font-weight: 500;
    }

    .stats-row {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .stat-pill {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      min-width: 100px;
    }

    .stat-val {
      font-family: 'Roboto', sans-serif;
      font-size: 1.35rem;
      font-weight: 900;
      color: #ffffff;
      line-height: 1;
    }

    .stat-lbl {
      font-size: 0.65rem;
      color: rgba(255, 255, 255, 0.65);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 2px;
    }

    .filter-bar {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1rem;
      display: grid;
      grid-template-columns: 2fr 1.2fr 1.2fr 1.2fr;
      gap: 1rem;
      align-items: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.03);
    }

    .search-wrapper {
      position: relative;
      width: 100%;
    }

    .search-wrapper svg {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }

    .filter-input {
      width: 100%;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px 10px 38px;
      color: #0f172a;
      font-family: inherit;
      font-size: 0.9rem;
      transition: all 0.2s ease;
      outline: none;
    }

    .filter-select {
      width: 100%;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      color: #0f172a;
      font-family: inherit;
      font-size: 0.9rem;
      transition: all 0.2s ease;
      outline: none;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-size: 16px;
      padding-right: 30px;
    }

    .filter-input:focus, .filter-select:focus {
      border-color: var(--teal-primary);
      box-shadow: 0 0 10px var(--teal-glow);
    }

    .accordion-list {
      width: 100%;
    }

    #groupedContainer {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
      width: 100%;
    }

    #flatContainer {
      display: none;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }

    .subject-section {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .subject-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.25rem 0.25rem;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .subject-icon {
      color: var(--teal-primary);
      flex-shrink: 0;
    }

    .subject-title {
      font-family: 'Roboto', sans-serif;
      font-size: 1.05rem;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .subject-badge {
      background: rgba(0, 150, 143, 0.08);
      border: 1px solid rgba(0, 150, 143, 0.2);
      color: var(--teal-primary);
      font-size: 0.65rem;
      font-weight: 800;
      border-radius: 20px;
      padding: 2px 8px;
      text-transform: uppercase;
      margin-left: auto;
    }

    .subject-classes {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .accordion-item {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
    }

    .accordion-item:hover {
      border-color: rgba(0, 150, 143, 0.4);
      transform: translateY(-2px);
    }

    .accordion-header {
      width: 100%;
      background: transparent;
      border: none;
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      color: inherit;
      font-family: inherit;
      text-align: left;
      outline: none;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
    }

    .class-num-badge {
      background: rgba(0, 150, 143, 0.08);
      border: 1px solid rgba(0, 150, 143, 0.2);
      color: var(--teal-primary);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .header-title-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .class-subject {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--teal-primary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .class-name {
      font-family: 'Roboto', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-available {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: #059669;
    }

    .badge-locked {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.25);
      color: #d97706;
    }

    .badge-bypass {
      background: rgba(139, 92, 246, 0.08);
      border: 1px solid rgba(139, 92, 246, 0.25);
      color: #7c3aed;
    }

    .chevron-icon {
      color: var(--text-muted);
      transition: transform 0.25s ease;
    }

    .accordion-item.active .chevron-icon {
      transform: rotate(180deg);
      color: var(--teal-primary);
    }

    .accordion-body {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      background: #f8fafc;
    }

    .accordion-body-inner {
      padding: 1.5rem;
      border-top: 1px solid var(--border-color);
    }

    .resources-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .resources-header {
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #0d9488;
      margin-bottom: 0.25rem;
    }

    .resource-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      transition: all 0.2s ease;
    }

    .resource-card:hover {
      background: #f8fafc;
      border-color: rgba(0, 150, 143, 0.35);
    }

    .resource-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
      min-width: 0;
    }

    .res-icon {
      width: 20px;
      height: 20px;
      color: var(--teal-primary);
      flex-shrink: 0;
    }

    .resource-details {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .resource-format {
      font-size: 0.6rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .resource-desc {
      font-size: 0.85rem;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: inherit;
      font-weight: 700;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      border: none;
    }

    .btn-access {
      background: var(--teal-primary);
      color: #071513;
      padding: 8px 16px;
      box-shadow: 0 4px 10px rgba(0, 150, 143, 0.15);
    }

    .btn-access:hover {
      background: var(--teal-hover);
      box-shadow: 0 4px 15px var(--teal-glow);
    }

    .lock-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 1.5rem 1rem;
      background: #ffffff;
      border: 1.5px dashed #cbd5e1;
      border-radius: 10px;
      gap: 0.75rem;
    }

    .lock-icon-wrapper {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: rgba(0, 150, 143, 0.08);
      border: 1px solid rgba(0, 150, 143, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--teal-primary);
      animation: pulse 2s infinite ease-in-out;
      margin-bottom: 0.25rem;
    }

    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 10px rgba(0, 150, 143, 0.1); }
      50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(0, 150, 143, 0.25); }
      100% { transform: scale(1); box-shadow: 0 0 10px rgba(0, 150, 143, 0.1); }
    }

    .lock-title {
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .lock-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      max-width: 320px;
      line-height: 1.4;
    }

    .lock-date {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #1e293b;
    }

    .countdown-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .time-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 44px;
    }

    .time-num {
      font-family: 'Roboto', sans-serif;
      font-size: 1.4rem;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.1;
    }

    .time-label {
      font-size: 0.55rem;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-top: 1px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .time-divider {
      color: #cbd5e1;
      font-family: 'Roboto', sans-serif;
      font-size: 1.2rem;
      font-weight: 700;
      line-height: 1;
      padding-bottom: 2px;
    }

    .btn-verify {
      background: var(--teal-primary);
      color: #071513;
      padding: 10px 20px;
      box-shadow: 0 4px 10px rgba(0, 150, 143, 0.15);
      margin-top: 0.5rem;
    }

    .no-results {
      padding: 3rem;
      text-align: center;
      background: var(--bg-card);
      border: 1px dashed var(--border-color);
      border-radius: 12px;
      color: var(--text-muted);
      display: none;
    }

    @media (max-width: 768px) {
      .filter-bar {
        grid-template-columns: 1fr;
      }
      body {
        padding: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-top">
        <span class="course-badge">Módulo Moodle</span>
        <h1 class="course-title">${courseName}</h1>
        <p class="course-subtitle">Cronograma interactivo de clases y materiales del curso.</p>
      </div>
      
      <div class="stats-row">
        <div class="stat-pill">
          <span class="stat-val">${totalClasses}</span>
          <span class="stat-lbl">Clases</span>
        </div>
        <div class="stat-pill">
          <span class="stat-val">${materiasSet.size}</span>
          <span class="stat-lbl">Materias</span>
        </div>
        <div class="stat-pill">
          <span class="stat-val">${totalResources}</span>
          <span class="stat-lbl">Recursos</span>
        </div>
      </div>
    </header>

    <div class="filter-bar">
      <div class="search-wrapper">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="searchInput" class="filter-input" placeholder="Buscar clase o contenido..." oninput="applyFilters()">
      </div>
      
      <select id="materiaFilter" class="filter-select" onchange="applyFilters()">
        <option value="">Todas las materias</option>
        ${subjectOptions}
      </select>

      <select id="statusFilter" class="filter-select" onchange="applyFilters()">
        <option value="">Todos los estados</option>
        <option value="available">Disponibles</option>
        <option value="locked">Próximamente</option>
      </select>

      <select id="sortOrder" class="filter-select" onchange="applyFilters()">
        <option value="class-num">Ordenar por: Número de clase</option>
        <option value="release-date">Ordenar por: Fecha de disponibilización</option>
      </select>
    </div>

    <div class="accordion-list" id="accordionList">
      <div id="groupedContainer" style="display: flex; flex-direction: column; gap: 1.75rem; width: 100%;">
        ${subjectSectionsHtml}
      </div>
      <div id="flatContainer" style="display: none; flex-direction: column; gap: 0.75rem; width: 100%;">
      </div>
    </div>

    <div class="no-results" id="noResults">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:10px; color:var(--text-muted)">
        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <h3>No se encontraron resultados</h3>
      <p style="font-size:0.85rem; margin-top:4px;">Prueba ajustando los términos de búsqueda o filtros.</p>
    </div>
  </div>

  <script>
    function sendHeight() {
      const height = (document.documentElement.scrollHeight || document.body.scrollHeight) + 15;
      window.parent.postMessage({ type: 'resize-iframe', height: height }, '*');
    }
    window.addEventListener('load', sendHeight);
    window.addEventListener('resize', sendHeight);

    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(entries => {
        sendHeight();
      });
      resizeObserver.observe(document.body);
    }

    function applyFilters() {
      const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
      const materiaVal = document.getElementById('materiaFilter').value;
      const statusVal = document.getElementById('statusFilter').value;
      const sortVal = document.getElementById('sortOrder').value;
      
      const groupedContainer = document.getElementById('groupedContainer');
      const flatContainer = document.getElementById('flatContainer');
      const allItems = Array.from(document.querySelectorAll('.accordion-item'));
      
      let visibleItems = [];
      
      // 1. Filter items and hide/show them
      allItems.forEach(item => {
        const matchesSearch = !searchVal || item.getAttribute('data-search').includes(searchVal);
        const matchesMateria = !materiaVal || item.getAttribute('data-materia') === materiaVal;
        const matchesStatus = !statusVal || item.getAttribute('data-status') === statusVal;
        
        if (matchesSearch && matchesMateria && matchesStatus) {
          item.style.display = 'block';
          visibleItems.push(item);
        } else {
          item.style.display = 'none';
          if (item.classList.contains('active')) {
            item.classList.remove('active');
            item.querySelector('.accordion-body').style.maxHeight = null;
          }
        }
      });
      
      // 2. Handle layout based on sortVal
      if (sortVal === 'release-date') {
        // Flat view by Date
        groupedContainer.style.display = 'none';
        flatContainer.style.display = 'flex';
        
        // Sort visible items
        visibleItems.sort((a, b) => {
          const dateA = a.getAttribute('data-date');
          const dateB = b.getAttribute('data-date');
          
          if (dateA !== dateB) {
            // Sort by date ascending (available/1970 first, then future dates)
            return dateA.localeCompare(dateB);
          }
          
          // Secondary sort: class number
          const numA = parseInt(a.getAttribute('data-class-num'), 10);
          const numB = parseInt(b.getAttribute('data-class-num'), 10);
          return numA - numB;
        });
        
        // Append sorted items to flat container
        visibleItems.forEach(item => {
          flatContainer.appendChild(item);
        });
      } else {
        // Grouped view by Subject (Class Number)
        flatContainer.style.display = 'none';
        groupedContainer.style.display = 'flex';
        
        // Sort ALL items by class number first to ensure correct order when putting them back
        allItems.sort((a, b) => {
          const numA = parseInt(a.getAttribute('data-class-num'), 10);
          const numB = parseInt(b.getAttribute('data-class-num'), 10);
          return numA - numB;
        });
        
        // Put each item back in its original subject container
        allItems.forEach(item => {
          const subject = item.getAttribute('data-materia');
          const originalContainer = document.querySelector('.subject-section[data-subject="' + subject + '"] .subject-classes');
          if (originalContainer) {
            originalContainer.appendChild(item);
          }
        });
        
        // Hide/show subject sections based on whether they contain any visible items
        const sections = document.querySelectorAll('.subject-section');
        sections.forEach(section => {
          const visibleInSection = section.querySelectorAll('.accordion-item[style="display: block;"]').length;
          if (visibleInSection > 0) {
            section.style.display = 'block';
          } else {
            section.style.display = 'none';
          }
        });
      }
      
      const noResults = document.getElementById('noResults');
      if (visibleItems.length === 0) {
        noResults.style.display = 'block';
      } else {
        noResults.style.display = 'none';
      }
    }

    function toggleAccordion(header) {
      const item = header.parentElement;
      const body = item.querySelector('.accordion-body');
      const isActive = item.classList.contains('active');
      
      document.querySelectorAll('.accordion-item.active').forEach(activeItem => {
        if (activeItem !== item) {
          activeItem.classList.remove('active');
          activeItem.querySelector('.accordion-body').style.maxHeight = null;
        }
      });
      
      if (isActive) {
        item.classList.remove('active');
        body.style.maxHeight = null;
      } else {
        item.classList.add('active');
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    }

    const countdowns = [];
    
    function initCountdowns() {
      const rows = document.querySelectorAll('.countdown-row');
      rows.forEach(row => {
        const targetMs = parseInt(row.getAttribute('data-target'), 10);
        if (isNaN(targetMs) || targetMs <= 0) return;
        
        countdowns.push({
          element: row,
          targetMs: targetMs,
          intervalId: null
        });
      });
      
      countdowns.forEach(cd => {
        const initialDiff = cd.targetMs - Date.now();
        if (initialDiff > 0) {
          cd.intervalId = setInterval(() => tick(cd), 1000);
          tick(cd);
        } else {
          showUnlockButton(cd);
        }
      });
    }

    function tick(cd) {
      const now = Date.now();
      const diff = cd.targetMs - now;
      
      if (diff <= 0) {
        if (cd.intervalId) clearInterval(cd.intervalId);
        handleExpiry(cd.targetMs);
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      cd.element.querySelector('.days').innerText = String(days).padStart(2, '0');
      cd.element.querySelector('.hours').innerText = String(hours).padStart(2, '0');
      cd.element.querySelector('.minutes').innerText = String(minutes).padStart(2, '0');
      cd.element.querySelector('.seconds').innerText = String(seconds).padStart(2, '0');
    }
    
    function showUnlockButton(cd) {
      const container = cd.element.parentElement;
      if (container) {
        cd.element.style.display = 'none';
        
        const oldBtn = container.querySelector('.btn-verify');
        if (oldBtn) oldBtn.remove();
        
        const btn = document.createElement('button');
        btn.className = 'btn btn-verify';
        btn.innerText = 'Verificar disponibilidad';
        btn.onclick = () => {
          const reloadKey = 'cf_reload_' + cd.targetMs;
          sessionStorage.removeItem(reloadKey);
          window.location.reload();
        };
        container.appendChild(btn);
        
        const desc = container.querySelector('.lock-desc');
        if (desc) {
          desc.innerText = 'La fecha de lanzamiento se ha cumplido. Haz clic en el botón para verificar y acceder al contenido.';
        }
      }
    }

    function handleExpiry(targetMs) {
      const reloadKey = 'cf_reload_' + targetMs;
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true');
        window.location.reload();
      } else {
        const cd = countdowns.find(c => c.targetMs === targetMs);
        if (cd) showUnlockButton(cd);
      }
    }

    window.addEventListener('load', () => {
      initCountdowns();
    });
  </script>
</body>
</html>`;
}

// GET /api/preview/cronograma/:token — PÚBLICO, genera la vista de cronograma de curso
export const getCourseSchedulePreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const bypassToken = req.query.token as string | undefined;

    const preview = await previewRepo().findOne({ where: { token } });
    if (!preview) {
      res.status(404).send(errorPage('🔍 Cronograma no encontrado', 'El enlace de cronograma solicitado no existe.'));
      return;
    }

    const course = await courseRepo().findOne({ where: { id: preview.courseId } });
    const rows = await rowRepo().find({
      where: { courseId: preview.courseId },
      order: { sortOrder: 'ASC' },
    });

    const isTeacherBypass = bypassToken === getCourseBypassToken(preview.token);
    const courseName = course?.name || preview.courseName;

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

    const subjects = [...new Set(rows.map(r => r.materia).filter(m => m && m.trim()))];

    const html = buildScheduleHtml(courseName, classGroups, subjects, isTeacherBypass, preview.token);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Vary', '*');
    res.send(html);
  } catch (error) {
    console.error('[preview] Error al obtener cronograma:', error);
    res.status(500).send(errorPage('❌ Error interno', 'Ocurrió un error al cargar el cronograma.'));
  }
};

