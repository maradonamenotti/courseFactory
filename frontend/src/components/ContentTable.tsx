import { Plus, Trash2, ExternalLink, Upload, Pencil, GripVertical, Loader2, ClipboardList, ChevronDown, ChevronRight, ChevronUp, Clock, Eye, EyeOff, Video, Calendar } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CourseRow, User, Task } from '../types';
import { filesApi, rowsApi } from '../services/api';
import { HistoryDrawer } from './HistoryDrawer';
import { useDialog } from './CustomDialog';
import { VideotecaModal } from './VideotecaModal';
import { findBestVmmMatch } from '../utils/vmmMatcher';

interface ContentTableProps {
  rows: CourseRow[];
  tasks?: Task[];
  courseId: string;
  addRow: (materia?: string, modulo?: string) => void;
  updateRow: (id: string, field: keyof CourseRow | Partial<CourseRow>, value?: any) => void;
  removeRow: (id: string) => void;
  updateModule: (oldName: string, newName: string) => void;
  updateModuloNumero?: (moduloName: string, numero: string) => void;
  updateMateria: (oldName: string, newName: string) => void;
  moveRow: (draggedId: string, targetId: string | null, targetModule?: string) => void;
  moveModule?: (sourceMateria: string, sourceModule: string, targetMateria: string, targetModule: string | null) => void;
  moveMateria?: (materiaName: string, direction: 'up' | 'down') => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
  user: User;
  isSidebarCollapsed?: boolean;
  isHeaderCollapsed?: boolean;
  releaseMode?: string;
  loadCourseRows?: (courseId: string) => Promise<void>;
}
const formatOptions = ['VIDEO', 'TEXTO', 'CUESTIONARIO', 'EXAMEN', 'GENIALLY', 'PDF', 'FLIP', 'MEET', 'OTRO'];

/**
 * Detects VMM video URLs (iframe.mediadelivery.net/embed/...) inside HTML
 * and replaces them with a proper responsive <iframe> player.
 * Works for:
 *   - Plain text URLs: https://iframe.mediadelivery.net/embed/...
 *   - Anchor tags: <a href="https://iframe.mediadelivery.net/embed/...">...</a>
 */
function injectVmmPlayers(html: string): string {
  if (!html) return html;

  let processed = html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\?share=copy[^\s"'>]*["']?>/gi, '')
    .replace(/(\s|^)\?share=[^\s<]+/gi, '');

  const iframes: string[] = [];
  processed = processed.replace(/<iframe[\s\S]*?<\/iframe>/gi, (match) => {
    const idx = iframes.length;
    iframes.push(match);
    return `___CF_IFRAME_PROTECTED_${idx}___`;
  });

  const getEmbedSrc = (rawUrl: string): string => {
    let url = rawUrl.replace(/&amp;/g, '&').trim();
    if (url.includes('vimeo.com')) {
      const m = url.match(/vimeo\.com\/(?:video\/|manage\/videos\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/i);
      if (m) {
        const vId = m[1];
        const hash = m[2];
        return hash
          ? `https://player.vimeo.com/video/${vId}?h=${hash}`
          : `https://player.vimeo.com/video/${vId}`;
      }
    }
    if (url.includes('videos.maradonamenotti.cloud')) {
      const m = url.match(/videos\.maradonamenotti\.cloud\/embed\/([a-zA-Z0-9_-]+)/i);
      if (m) return `https://videos.maradonamenotti.cloud/embed/${m[1]}`;
    }
    if (url.includes('iframe.mediadelivery.net')) {
      return url.replace(/([?&])autoplay=true/gi, '$1autoplay=false');
    }
    return url;
  };

  const VIDEO_URL_REGEX = /(?:https?:\/\/(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/|manage\/videos\/)?\d+(?:\/[a-zA-Z0-9]+)?|https?:\/\/videos\.maradonamenotti\.cloud\/embed\/[a-zA-Z0-9_-]+|https?:\/\/iframe\.mediadelivery\.net\/embed\/[^\s"'<>]+)/i;

  const cardItems: string[] = [];

  processed = processed.replace(
    /(<p[^>]*>[\s\S]*?<\/p>)(?:\s*(<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:Descargar|\.mp4|\.mov|\.mkv)[\s\S]*?<\/p>))?/gi,
    (fullMatch, p1, p2) => {
      if (!VIDEO_URL_REGEX.test(p1)) return fullMatch;

      const urlMatch = p1.match(/href=["']([^"']+)["']/i) || p1.match(VIDEO_URL_REGEX);
      if (!urlMatch) return fullMatch;

      const videoUrl = urlMatch[1] || urlMatch[0];
      const embedSrc = getEmbedSrc(videoUrl);

      let title = '';
      const parts = p1.split(/<br\s*\/?>|<a\b/i);
      if (parts.length > 1 && parts[0].replace(/<[^>]+>/g, '').trim().length > 0) {
        title = parts[0].replace(/<[^>]+>/g, '').trim();
      }

      let downloadHtml = '';
      if (p2) {
        downloadHtml = p2.replace(/<\/?p[^>]*>/gi, '').trim();
      } else if (p1.toLowerCase().includes('descargar') || p1.toLowerCase().includes('.mp4')) {
        const dMatch = p1.match(/(<a[^>]*>(?:Descargar|🎬)[\s\S]*?<\/a>|Descargar:[\s\S]*?$)/i);
        if (dMatch) {
          downloadHtml = dMatch[0].replace(/<\/?p[^>]*>/gi, '').trim();
        }
      }

      const cardIndex = cardItems.length;
      const cardHtml =
        `<div class="cf-media-item" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">` +
          (title ? `<div style="font-weight: 700; font-size: 1.05rem; color: #0f172a; margin-bottom: 0.75rem; line-height: 1.3;">${title}</div>` : '') +
          `<div style="flex: 1; margin-bottom: 0.75rem;">` +
            `<div style="width: 100%; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: #000; box-shadow: 0 4px 14px rgba(0,0,0,0.18);">` +
              `<iframe src="${embedSrc}" style="width: 100%; height: 100%; border: none;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture" allowfullscreen loading="lazy"></iframe>` +
            `</div>` +
          `</div>` +
          (downloadHtml ? `<div style="font-size: 0.85rem; color: #475569; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; word-break: break-all;">${downloadHtml}</div>` : '') +
        `</div>`;

      cardItems.push(cardHtml);
      return `___CF_CARD_ITEM_${cardIndex}___`;
    }
  );

  processed = processed.replace(
    /(?:<a\s[^>]*href=["'](https?:\/\/(?:vimeo\.com|iframe\.mediadelivery\.net|videos\.maradonamenotti\.cloud)[^"']+)["'][^>]*>[\s\S]*?<\/a>|(https?:\/\/(?:vimeo\.com|iframe\.mediadelivery\.net|videos\.maradonamenotti\.cloud)[^\s"'<>]+))/gi,
    (match, url1, url2) => {
      const url = url1 || url2;
      if (!url) return match;
      const embedSrc = getEmbedSrc(url);
      const cardIndex = cardItems.length;
      const cardHtml =
        `<div class="cf-media-item" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">` +
          `<div style="flex: 1;">` +
            `<div style="width: 100%; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: #000; box-shadow: 0 4px 14px rgba(0,0,0,0.18);">` +
              `<iframe src="${embedSrc}" style="width: 100%; height: 100%; border: none;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture" allowfullscreen loading="lazy"></iframe>` +
            `</div>` +
          `</div>` +
        `</div>`;
      cardItems.push(cardHtml);
      return `___CF_CARD_ITEM_${cardIndex}___`;
    }
  );

  processed = processed.replace(/___CF_IFRAME_PROTECTED_(\d+)___/g, (_, idx) => iframes[parseInt(idx, 10)] || '');

  const gridPlaceholderRegex = /(?:___CF_CARD_ITEM_\d+___\s*)+/gi;
  processed = processed.replace(gridPlaceholderRegex, (gridMatch) => {
    const indices = (gridMatch.match(/___CF_CARD_ITEM_(\d+)___/g) || []).map(m => parseInt(m.replace(/[^\d]/g, ''), 10));
    if (indices.length >= 2) {
      const cardsContent = indices.map(i => cardItems[i]).join('\n');
      return `<div class="cf-video-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin: 2rem 0; width: 100%; box-sizing: border-box; clear: both;">` +
        cardsContent +
      `</div>`;
    } else if (indices.length === 1) {
      return cardItems[indices[0]];
    }
    return gridMatch;
  });

  processed = processed.replace(/___CF_CARD_ITEM_(\d+)___/g, (_, i) => cardItems[parseInt(i, 10)] || '');

  return processed;
}


const configEstados = [
  { value: '1-NO EMPEZADO', label: 'Pendiente', color: '#ffb300', glow: 'rgba(255, 179, 0, 0.4)' },
  { value: '2-EN PROCESO', label: 'En Proceso', color: '#ff6f00', glow: 'rgba(255, 111, 0, 0.4)' },
  { value: '3-CORREGIR', label: 'Corregir', color: '#e53935', glow: 'rgba(229, 57, 53, 0.4)' },
  { value: '4-DISPONIBLE', label: 'Disponible', color: '#00c853', glow: 'rgba(0, 200, 83, 0.4)' }
];

// ── Utilities ──────────────────────────────────────────────────────────────
const renderMateriaProgress = (materiaRows: CourseRow[]) => {
  const total = materiaRows.length;
  if (total === 0) return null;

  const countPending = materiaRows.filter(r => r.estado === '1-NO EMPEZADO').length;
  const countInProgress = materiaRows.filter(r => r.estado === '2-EN PROCESO').length;
  const countCorrection = materiaRows.filter(r => r.estado === '3-CORREGIR').length;
  const countAvailable = materiaRows.filter(r => r.estado === '4-DISPONIBLE').length;

  const pctPending = (countPending / total) * 100;
  const pctInProgress = (countInProgress / total) * 100;
  const pctCorrection = (countCorrection / total) * 100;
  const pctAvailable = (countAvailable / total) * 100;
  

  return (
    <div 
      style={{
        position: 'relative',
        height: '10px',
        width: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '5px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
        minWidth: '110px'
      }} 
      title={`Disponible: ${Math.round(pctAvailable)}% | En Proceso: ${Math.round(pctInProgress)}% | Corregir: ${Math.round(pctCorrection)}% | Pendiente: ${Math.round(pctPending)}%`}
    >
      {/* Segmento Pendiente */}
      {pctPending > 0 && (
        <div 
          title={`Pendiente: ${Math.round(pctPending)}%`}
          style={{
            height: '100%',
            width: `${pctPending}%`,
            backgroundColor: '#ffb300',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento En Proceso */}
      {pctInProgress > 0 && (
        <div 
          title={`En Proceso: ${Math.round(pctInProgress)}%`}
          style={{
            height: '100%',
            width: `${pctInProgress}%`,
            backgroundColor: '#ff6f00',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Corregir */}
      {pctCorrection > 0 && (
        <div 
          title={`Corregir: ${Math.round(pctCorrection)}%`}
          style={{
            height: '100%',
            width: `${pctCorrection}%`,
            backgroundColor: '#e53935',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Disponible */}
      {pctAvailable > 0 && (
        <div 
          title={`Disponible: ${Math.round(pctAvailable)}%`}
          style={{
            height: '100%',
            width: `${pctAvailable}%`,
            backgroundColor: '#00c853',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}

    </div>
  );
};

const renderModuloProgress = (moduloRows: CourseRow[]) => {
  const total = moduloRows.length;
  if (total === 0) return null;

  const countPending = moduloRows.filter(r => r.estado === '1-NO EMPEZADO').length;
  const countInProgress = moduloRows.filter(r => r.estado === '2-EN PROCESO').length;
  const countCorrection = moduloRows.filter(r => r.estado === '3-CORREGIR').length;
  const countAvailable = moduloRows.filter(r => r.estado === '4-DISPONIBLE').length;

  const pctPending = (countPending / total) * 100;
  const pctInProgress = (countInProgress / total) * 100;
  const pctCorrection = (countCorrection / total) * 100;
  const pctAvailable = (countAvailable / total) * 100;

  return (
    <div 
      style={{
        position: 'relative',
        height: '6px',
        width: '60px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '3px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
        flexShrink: 0
      }} 
      title={`Disponible: ${Math.round(pctAvailable)}% | En Proceso: ${Math.round(pctInProgress)}% | Corregir: ${Math.round(pctCorrection)}% | Pendiente: ${Math.round(pctPending)}%`}
    >
      {/* Segmento Pendiente */}
      {pctPending > 0 && (
        <div 
          style={{
            height: '100%',
            width: `${pctPending}%`,
            backgroundColor: '#ffb300',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento En Proceso */}
      {pctInProgress > 0 && (
        <div 
          style={{
            height: '100%',
            width: `${pctInProgress}%`,
            backgroundColor: '#ff6f00',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Corregir */}
      {pctCorrection > 0 && (
        <div 
          style={{
            height: '100%',
            width: `${pctCorrection}%`,
            backgroundColor: '#e53935',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Disponible */}
      {pctAvailable > 0 && (
        <div 
          style={{
            height: '100%',
            width: `${pctAvailable}%`,
            backgroundColor: '#00c853',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
    </div>
  );
};

const isGoogleDriveUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return ['drive.google.com', 'docs.google.com', 'sheets.google.com',
            'slides.google.com', 'forms.google.com'].includes(hostname);
  } catch { return false; }
};

const getExternalEditUrl = (row: CourseRow): string => {
  if (row.googleFileId) {
    const isPdf = (row.links && row.links.toLowerCase().endsWith('.pdf')) || row.fileType === 'application/pdf';
    if (isPdf) {
      return `https://drive.google.com/file/d/${row.googleFileId}/view`;
    }
    return `https://docs.google.com/document/d/${row.googleFileId}/edit`;
  }
  if (row.links && isGoogleDriveUrl(row.links)) {
    return row.links;
  }
  return row.links || '';
};

const extractGoogleFileId = (url: string): string | null => {
  if (!url) return null;
  try {
    const dMatch = url.match(/\/d\/([^/]+)/);
    if (dMatch) return dMatch[1];
    const idMatch = url.match(/[?&]id=([^&]+)/);
    if (idMatch) return idMatch[1];
    return null;
  } catch {
    return null;
  }
};

const decodeHTML = (str: string): string => {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

const cleanGoogleTitle = (raw: string): string => {
  // Replace non-breaking spaces (\u00a0) and multiple spaces with a standard space
  const normalized = decodeHTML(raw).replace(/\s+/g, ' ').trim();
  
  // Check if it's an error, sign-in, or access-denied page
  const lower = normalized.toLowerCase();
  const isError = [
    'page not found', 'página no encontrada', 'error', 
    'sign in', 'iniciar sesión', 'access denied', 'acceso denegado',
    'iniciar sesión en las cuentas de google', 'google drive - virus scan warning'
  ].some(err => lower.includes(err));
  
  if (isError) {
    throw new Error('Proxy returned an error/auth page');
  }

  return normalized
    .replace(/\s*-\s*Google\s*(Docs|Sheets|Slides|Forms|Drive)$/i, '')
    .replace(/\s*-\s*(Documentos|Hojas de cálculo|Presentaciones|Formularios)\s*de\s*Google$/i, '')
    .trim();
};

const fetchTitleFromProxies = async (url: string, signal?: AbortSignal): Promise<string> => {
  const proxies = [
    {
      // Proxy 1: CodeTabs (Fast, clean, free, raw response - trailing slash required)
      getUrl: (target: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(target)}`,
      parse: (text: string) => text
    },
    {
      // Proxy 2: CORS.lol (Reliable free public proxy)
      getUrl: (target: string) => `https://api.cors.lol/?url=${encodeURIComponent(target)}`,
      parse: (text: string) => text
    },
    {
      // Proxy 3: AllOrigins (Robust, JSON wrapper as backup)
      getUrl: (target: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
      parse: (text: string) => {
        try {
          const json = JSON.parse(text);
          return json.contents || '';
        } catch {
          return text;
        }
      }
    }
  ];

  let lastError: any = new Error('No proxies succeeded');

  for (const proxy of proxies) {
    try {
      const response = await fetch(proxy.getUrl(url), { signal });
      if (!response.ok) continue;
      const text = await response.text();
      const html = proxy.parse(text);
      
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match) {
        return cleanGoogleTitle(match[1]);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
};

// ── DriveLink component ────────────────────────────────────────────────────
interface DriveLinkProps {
  url: string;
  storedTitle: string;
  rowId: string;
  onTitleFetched: (id: string, title: string) => void;
  onClear: () => void;
  onEdit?: () => void;
  onPreview?: () => void;
  disabled?: boolean;
}

const DriveLink: React.FC<DriveLinkProps> = ({ url, storedTitle, rowId, onTitleFetched, onClear, onEdit, onPreview, disabled }) => {
  type Status = 'loading' | 'done' | 'manual';
  const [title, setTitle] = useState(storedTitle);
  const [status, setStatus] = useState<Status>(storedTitle ? 'done' : 'loading');
  const [editVal, setEditVal] = useState('');

  useEffect(() => {
    if (storedTitle) { setTitle(storedTitle); setStatus('done'); return; }

    setStatus('loading');
    const ctrl = new AbortController();

    fetchTitleFromProxies(url, ctrl.signal)
      .then(t => {
        setTitle(t);
        onTitleFetched(rowId, t);
        setStatus('done');
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          console.warn("Failed to fetch Drive title automatically, falling back to manual input:", err);
          setStatus('manual');
        }
      });

    return () => ctrl.abort();
  }, [url, storedTitle]);

  const confirmManual = () => {
    const val = editVal.trim();
    if (val) { setTitle(val); onTitleFetched(rowId, val); setStatus('done'); }
  };

  const chipStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    background: 'rgba(139, 92, 246, 0.1)', borderRadius: '6px',
    padding: '0.25rem 0.65rem', flex: 1, minWidth: 0,
    border: '1px solid rgba(139, 92, 246, 0.22)',
    color: 'var(--accent)', textDecoration: 'none',
    fontSize: '0.82rem', fontWeight: 500,
    overflow: 'hidden', whiteSpace: 'nowrap',
  };

  const clearBtn = !disabled && (
    <button
      onClick={onClear}
      title="Remover enlace"
      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
               padding: '0 0.3rem', opacity: 0.65, flexShrink: 0, fontSize: '1rem', lineHeight: 1 }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
    >×</button>
  );

  if (status === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
      <div style={{ ...chipStyle, color: 'var(--text-muted)', cursor: 'default', gap: '0.5rem' }}>
        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Obteniendo título...</span>
      </div>
      {clearBtn}
    </div>
  );

  if (status === 'manual') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}>
      <input
        type="text"
        className="cell-input"
        placeholder="Nombre del documento..."
        autoFocus
        value={editVal}
        disabled={disabled}
        onChange={e => setEditVal(e.target.value)}
        onBlur={confirmManual}
        onKeyDown={e => e.key === 'Enter' && confirmManual()}
        style={{ flex: 1, minWidth: 0 }}
      />
      {clearBtn}
    </div>
  );

  // status === 'done'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}>
      <a href={url} target="_blank" rel="noopener noreferrer" title={url} style={chipStyle}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}
      >
        <ExternalLink size={11} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title || url}</span>
      </a>
      {onPreview && (
        <button
          onClick={onPreview}
          title="Previsualizar documento"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                   padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
        >
          <Eye size={13} />
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          title="Editar documento"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                   padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
        >
          <Pencil size={13} />
        </button>
      )}
      {clearBtn}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const ContentTable: React.FC<ContentTableProps> = ({ rows, tasks = [], courseId, addRow, updateRow, removeRow, updateModule, updateModuloNumero, updateMateria, moveRow, moveModule, moveMateria, onAddRowTask, user, isSidebarCollapsed, isHeaderCollapsed, releaseMode, loadCourseRows }) => {
  const { showAlert, DialogRenderer } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyRow, setHistoryRow] = useState<{ id: string; label: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CourseRow | null>(null);
  const [videotecaRowId, setVideotecaRowId] = useState<string | null>(null);

  // Google Drive Integration States
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
  });
  
  interface FileStatus {
    hasUpdate: boolean;
    checked: boolean;
    currentModifiedTime?: string;
    lastModifyingUser?: string;
    error?: boolean;
  }
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatus>>({});

  // ── Importación Masiva States & Helpers ────────────────────────────────────
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ materia: string; classesCount: number; itemsCount: number; rows: any[] }[]>([]);
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importMateriaDefault, setImportMateriaDefault] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const loadSheetJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = () => resolve((window as any).XLSX);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const extractGoogleFileId = (url: string): string | null => {
    if (!url) return null;
    const docMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    if (docMatch) return docMatch[1];
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (fileMatch) return fileMatch[1];
    const openMatch = url.match(/id=([a-zA-Z0-9-_]+)/);
    if (openMatch) return openMatch[1];
    return null;
  };

  const detectDelimiter = (text: string): string => {
    const firstLines = text.split('\n').slice(0, 3).join('\n');
    const commas = (firstLines.match(/,/g) || []).length;
    const semicolons = (firstLines.match(/;/g) || []).length;
    return commas >= semicolons ? ',' : ';';
  };

  const parseCSV = (text: string, delimiter: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [""];
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push("");
      } else if (char === '\n' && !inQuotes) {
        lines.push(row);
        row = [""];
      } else if (char === '\r') {
        // ignore
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const normalizeHeader = (str: string): string => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const parseSheetData = (matrix: any[][], defaultMateria: string): any[] => {
    if (matrix.length < 2) return [];
    
    // 1. Detect Header Row
    let headerRowIndex = -1;
    for (let r = 0; r < Math.min(15, matrix.length); r++) {
      const row = matrix[r] || [];
      const rowNorm = row.map(c => normalizeHeader(String(c || '')));
      
      const hasClase = rowNorm.some(s => s === 'clase' || s.startsWith('clase') || s === 'modulo' || s === 'tarjeta');
      const hasDesc = rowNorm.some(s => s.includes('descrip') || s === 'tema' || s === 'nombre');
      const hasNro = rowNorm.some(s => s === 'nro' || s === 'num' || s === 'numero' || s === 'n');
      const hasSalida = rowNorm.some(s => s === 'salida' || s === 'formato');
      const hasMedia = rowNorm.some(s => s === 'crudo' || s.includes('drive') || s === 'link' || s.includes('vimeo') || s === 'estado');

      if ((hasClase && hasDesc) || (hasNro && (hasSalida || hasMedia || hasClase || hasDesc))) {
        headerRowIndex = r;
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      for (let r = 0; r < Math.min(15, matrix.length); r++) {
        const rowNorm = (matrix[r] || []).map(c => normalizeHeader(String(c || '')));
        if (rowNorm.some(s => s === 'nro' || s === 'clase' || s === 'modulo')) {
          headerRowIndex = r;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = 0;
    }
    
    const headers = (matrix[headerRowIndex] || []).map(c => normalizeHeader(String(c || '')));
    const dataRows = matrix.slice(headerRowIndex + 1);

    // 2. Smart Header Inference for missing/blank column headers
    const KNOWN_FORMATS = new Set(['VIDEO', 'ARTICULATE', 'GENIALLY', 'PDF', 'CUESTIONARIO', 'EXAMEN', 'MEET', 'TEXTO']);
    let salidaCol = headers.findIndex(h => h === 'salida' || h === 'formato');
    const nroCol = headers.findIndex(h => h === 'nro' || h === 'num' || h === 'numero' || h === 'n');

    // If 'salida' column was blank in the header row, detect it by inspecting data values
    if (salidaCol === -1) {
      for (let c = 0; c < headers.length; c++) {
        let matches = 0;
        for (let r = 0; r < Math.min(10, dataRows.length); r++) {
          const val = String(dataRows[r]?.[c] || '').trim().toUpperCase();
          if (KNOWN_FORMATS.has(val)) matches++;
        }
        if (matches >= 2) {
          salidaCol = c;
          headers[c] = 'salida';
          break;
        }
      }
    }

    // If we have nro and salida, and empty header columns in between (e.g. TÉCNICA TÁCTICA Y ESTRATEGIA I)
    if (nroCol !== -1 && salidaCol !== -1 && salidaCol > nroCol) {
      const gap: number[] = [];
      for (let c = nroCol + 1; c < salidaCol; c++) {
        if (!headers[c]) gap.push(c);
      }
      if (gap.length === 2) {
        headers[gap[0]] = 'clase';
        headers[gap[1]] = 'descripcion';
      } else if (gap.length === 1) {
        headers[gap[0]] = 'clase';
      }
    }

    // Infer any empty column that holds document/file links (.docx, .pdf, .mp4, etc.)
    for (let c = 0; c < headers.length; c++) {
      if (!headers[c]) {
        let matches = 0;
        for (let r = 0; r < Math.min(15, dataRows.length); r++) {
          const val = String(dataRows[r]?.[c] || '').toLowerCase();
          if (val.includes('.docx') || val.includes('.pdf') || val.includes('.mp4') || val.includes('.doc') || val.includes('http')) {
            matches++;
          }
        }
        if (matches >= 2) {
          headers[c] = 'link_referencia';
        }
      }
    }
    
    const parsed: any[] = [];
    
    dataRows.forEach((row) => {
      if (row.length === 0 || row.every(c => c === null || c === undefined || c === '')) return;
      
      const item: any = {
        materia: defaultMateria,
        modulo: '',
        moduloNumero: null,
        descripcion: '',
        formato: 'VIDEO',
        links: '',
        videoVimeo: '',
        geniallyUrl: '',
        googleFileId: ''
      };
      
      let driveMmVal = '';
      let driveAfaVal = '';
      let generalLinkVal = '';
      let vimeoMmVal = '';
      let geniallyVal = '';

      row.forEach((cell, colIndex) => {
        const header = headers[colIndex];
        if (!header) return;
        
        const val = String(cell || '').trim();
        if (!val) return;
        
        if (header === 'nro' || header === 'num' || header === 'numero' || header === 'n') {
          item.moduloNumero = val || null;
        } else if ((header === 'clase' || header === 'modulo' || header === 'tarjeta') && !item.modulo) {
          item.modulo = val;
        } else if ((header.includes('descrip') || header === 'nombre' || header === 'tema') && !item.descripcion) {
          item.descripcion = val;
        } else if (header === 'salida' || header === 'formato') {
          const cleanFormat = val.toUpperCase();
          if (cleanFormat.includes('VIDEO')) item.formato = 'VIDEO';
          else if (cleanFormat.includes('ARTICULATE')) item.formato = 'ARTICULATE';
          else if (cleanFormat.includes('GENIALLY')) item.formato = 'GENIALLY';
          else if (cleanFormat.includes('PDF')) item.formato = 'PDF';
          else if (cleanFormat.includes('CUESTIONARIO')) item.formato = 'CUESTIONARIO';
          else if (cleanFormat.includes('EXAMEN')) item.formato = 'EXAMEN';
          else if (cleanFormat.includes('MEET')) item.formato = 'MEET';
          else item.formato = cleanFormat || 'VIDEO';
        } else if (header === 'drive_mm') {
          driveMmVal = val;
        } else if (header === 'drive_afa') {
          driveAfaVal = val;
        } else if (
          header === 'link_referencia' ||
          header === 'link' ||
          header === 'links' ||
          header === 'link_de_drive' ||
          header === 'drive'
        ) {
          generalLinkVal = val;
        } else if (
          header === 'vimeo_mm' ||
          header === 'vimeo_afa' ||
          header === 'link_de_video' ||
          header === 'video_mm' ||
          header === 'vimeo' ||
          header === 'link_video'
        ) {
          vimeoMmVal = val;
        } else if (
          header === 'link_esp' ||
          header === 'genially_mm' ||
          header === 'genially' ||
          header === 'diseno' ||
          header === 'diseño'
        ) {
          geniallyVal = val;
        }
      });
      
      item.videoDrive = driveMmVal || driveAfaVal || generalLinkVal;
      item.links = generalLinkVal || driveMmVal || driveAfaVal;
      if (vimeoMmVal) item.videoVimeo = vimeoMmVal;
      if (geniallyVal) item.geniallyUrl = geniallyVal;

      const activeLink = item.links || item.videoDrive || '';
      const driveId = extractGoogleFileId(activeLink);
      if (driveId) item.googleFileId = driveId;
      
      // Fallback si modulo o descripcion falta (e.g. Reglamento I)
      if (!item.descripcion && item.modulo) {
        item.descripcion = item.modulo;
      }
      if (!item.modulo && item.descripcion) {
        item.modulo = item.descripcion;
      }

      if (item.modulo || item.descripcion) {
        parsed.push(item);
      }
    });
    
    return parsed;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    try {
      if (isXlsx) {
        const XLSX = await loadSheetJS();
        const reader = new FileReader();
        reader.onload = (evt) => {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const groups: Record<string, any[]> = {};
          
          workbook.SheetNames.forEach((sheetName: string) => {
            const normalizedSheet = sheetName.toLowerCase().trim();
            // Ignorar pestañas de configuración estándar que no son materias
            if (['calendario', 'arbol', 'planing', 'config', 'sheet1', 'hoja1'].some(s => normalizedSheet.includes(s))) {
              return;
            }
            
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            if (json.length < 2) return;
            
            const sheetRows = parseSheetData(json, sheetName);
            if (sheetRows.length > 0) {
              groups[sheetName] = sheetRows;
            }
          });
          
          const list = Object.entries(groups).map(([materiaName, rowsList]) => {
            const classesCount = new Set(rowsList.map(r => r.modulo).filter(Boolean)).size;
            return {
              materia: materiaName,
              classesCount,
              itemsCount: rowsList.length,
              rows: rowsList
            };
          });
          
          setImportPreview(list);
          if (list.length > 0) {
            setImportMateriaDefault(list[0].materia);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Asumir CSV
        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = evt.target?.result as string;
          const delimiter = detectDelimiter(text);
          const matrix = parseCSV(text, delimiter);
          
          const defaultMat = file.name.replace(/\.[^/.]+$/, "").toUpperCase();
          const sheetRows = parseSheetData(matrix, defaultMat);
          
          const classesCount = new Set(sheetRows.map(r => r.modulo).filter(Boolean)).size;
          const list = [{
            materia: defaultMat,
            classesCount,
            itemsCount: sheetRows.length,
            rows: sheetRows
          }];
          
          setImportPreview(list);
          setImportMateriaDefault(defaultMat);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      console.error(err);
      showAlert('❌ Error al procesar el archivo', err.message || 'El formato del archivo no es válido.', 'danger');
    }
  };

  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;
    
    setIsImporting(true);
    
    let allRows: any[] = [];
    importPreview.forEach(group => {
      const finalMateriaName = importPreview.length === 1 ? importMateriaDefault : group.materia;
      
      const mapped = group.rows.map(r => ({
        ...r,
        materia: finalMateriaName
      }));
      
      allRows.push(...mapped);
    });
    
    // Auto-vincular automáticamente con VMM (videos.maradonamenotti.cloud) si hay coincidencias
    try {
      const vmmRes = await fetch('/api/videoteca/videos');
      if (vmmRes.ok) {
        const vmmData = await vmmRes.json();
        const vmmVideos = Array.isArray(vmmData.data) ? vmmData.data : (Array.isArray(vmmData) ? vmmData : []);
        if (vmmVideos.length > 0) {
          let autoMatchedCount = 0;
          allRows.forEach(r => {
            if (r.formato === 'VIDEO' && !r.videoVimeo) {
              const matched = findBestVmmMatch(r.videoDrive || r.links || r.fileName || '', vmmVideos, r.descripcion);
              if (matched) {
                r.videoVimeo = `https://videos.maradonamenotti.cloud/embed/${matched.id}`;
                autoMatchedCount++;
              }
            }
          });
          if (autoMatchedCount > 0) {
            console.log(`[VMM Auto-Match] Se auto-vincularon ${autoMatchedCount} videos con VMM durante la importación.`);
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo autocompletar VMM durante la importación:', e);
    }

    try {
      const res = await rowsApi.importRows(courseId, allRows, importOverwrite);
      
      showAlert('✅ Importación Exitosa', `Se han importado ${res.count} filas de cronograma correctamente.`, 'success');
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportPreview([]);
      
      if (loadCourseRows) {
        await loadCourseRows(courseId);
      }
    } catch (err: any) {
      console.error(err);
      showAlert('❌ Error al importar', err.message || 'No se pudo guardar el cronograma en la base de datos.', 'danger');
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    let checkInterval: ReturnType<typeof setTimeout>;
    
    const checkLoaded = () => {
      if ((window as any).google && (window as any).gapi) {
        setGoogleLoaded(true);
        // Pre-load picker
        (window as any).gapi.load('picker', { callback: () => console.log('Google Picker loaded') });
      } else {
        checkInterval = setTimeout(checkLoaded, 500);
      }
    };
    
    checkLoaded();
    
    return () => {
      if (checkInterval) clearTimeout(checkInterval);
    };
  }, []);


  const requestFreshGoogleToken = (onSuccess: (token: string) => void, _forceConsent: boolean = false) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      showAlert('Configuración faltante', 'Falta VITE_GOOGLE_CLIENT_ID en la configuración.', 'warning');
      return;
    }
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.error) {
            console.error('Error Google OAuth:', response);
            showAlert('Error de autenticación', `No se pudo autorizar el acceso a Google Drive: ${response.error_description || response.error}`, 'danger');
            return;
          }
          if (response.access_token) {
            const token = response.access_token;
            const expiresIn = response.expires_in ? Number(response.expires_in) : 3500;
            const expiresAt = String(Date.now() + (expiresIn - 120) * 1000);
            setAccessToken(token);
            sessionStorage.setItem('google_access_token', token);
            localStorage.setItem('google_access_token', token);
            sessionStorage.setItem('google_token_expires_at', expiresAt);
            localStorage.setItem('google_token_expires_at', expiresAt);
            onSuccess(token);
          }
        },
      });

      // SIEMPRE pasar prompt: 'select_account'.
      // Si se invoca sin prompt, Google intenta adivinar la cuenta usando cookies en authuser=0.
      // En navegadores con múltiples cuentas abiertas o cuentas corporativas de Workspace,
      // esto dispara el 'Error 401 (Solicitud incorrecta)!!1' en accounts.google.com/signin/oauth/v3/consent.
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      console.error('Error initializing Google auth client:', err);
      showAlert('Error de conexión', 'Error de conexión con Google Identity Services.', 'danger');
    }
  };

  const handleGoogleDrivePick = (rowId: string) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

    if (!clientId || !apiKey) {
      showAlert('Configuración faltante', 'Por favor, configura VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY en tu archivo .env para usar Google Drive.', 'warning');
      return;
    }

    const showPicker = (token: string) => {
      try {
        const docsView = new (window as any).google.picker.DocsView()
          .setIncludeFolders(true)
          .setEnableDrives(true);
          
        const picker = new (window as any).google.picker.PickerBuilder()
          .enableFeature((window as any).google.picker.Feature.SUPPORT_DRIVES)
          .addView(docsView)
          .setOAuthToken(token)
          .setDeveloperKey(apiKey)
          .setOrigin(window.location.protocol + '//' + window.location.host)
          .setCallback((data: any) => {
            if (data.action === (window as any).google.picker.Action.PICKED) {
              const file = data.docs[0];
              const fileId = file.id;
              importDriveFile(rowId, fileId, token);
            }
          })
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error('Error opening Google Picker:', err);
        showAlert('Error', 'Error al abrir el selector de Google Drive.', 'danger');
      }
    };

    const currentToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
    const expiresAt = Number(localStorage.getItem('google_token_expires_at') || sessionStorage.getItem('google_token_expires_at') || 0);
    const isTokenValid = currentToken && expiresAt > 0 && Date.now() < expiresAt;

    if (isTokenValid && currentToken) {
      showPicker(currentToken);
    } else {
      requestFreshGoogleToken((freshToken) => {
        showPicker(freshToken);
      }, false);
    }
  };

  const importDriveFile = async (rowId: string, fileId: string, token: string, isRetry: boolean = false) => {
    setIsUploading(prev => ({ ...prev, [rowId]: true }));
    try {
      const res = await filesApi.importDrive(fileId, token);
      updateRow(rowId, {
        links: res.url,
        fileName: res.fileName,
        fileType: res.fileType,
        htmlContent: res.htmlContent || undefined,
        googleFileId: res.googleFileId,
        googleModifiedTime: res.googleModifiedTime,
        googleLastSyncedAt: new Date().toISOString()
      });
      setFileStatuses(prev => ({
        ...prev,
        [rowId]: { checked: true, hasUpdate: false, currentModifiedTime: res.googleModifiedTime }
      }));
      setIsUploading(prev => ({ ...prev, [rowId]: false }));
    } catch (err: any) {
      console.error('Error importing file:', err);
      const msg = err instanceof Error ? err.message : 'Error al importar el archivo de Google Drive';
      const isAuth =
        msg.includes('sesión de Google Drive ha expirado') ||
        msg.includes('GOOGLE_AUTH_EXPIRED');

      if (isAuth && !isRetry) {
        // Token expiró en el backend → renovar silenciosamente y reintentar
        console.log('Token expirado, renovando...');
        setAccessToken(null);
        sessionStorage.removeItem('google_access_token');
        localStorage.removeItem('google_access_token');
        sessionStorage.removeItem('google_token_expires_at');
        localStorage.removeItem('google_token_expires_at');
        requestFreshGoogleToken((freshToken) => {
          importDriveFile(rowId, fileId, freshToken, true);
        }, false);
      } else if (isAuth && isRetry) {
        setIsUploading(prev => ({ ...prev, [rowId]: false }));
        showAlert(
          'Sesión de Google Drive expirada',
          'Tu sesión con Google Drive expiró. Por favor hacé clic en el botón de Drive para renovar los permisos.',
          'warning'
        );
      } else {
        setIsUploading(prev => ({ ...prev, [rowId]: false }));
        showAlert('Error al importar', msg, 'danger');
      }
    }
  };

  const handleResync = async (rowId: string, fileId: string) => {
    const currentToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
    const expiresAt = Number(localStorage.getItem('google_token_expires_at') || sessionStorage.getItem('google_token_expires_at') || 0);
    const isTokenValid = currentToken && expiresAt > 0 && Date.now() < expiresAt;

    if (!isTokenValid || !currentToken) {
      requestFreshGoogleToken((freshToken) => {
        executeResync(rowId, fileId, freshToken);
      });
      return;
    }

    executeResync(rowId, fileId, currentToken);
  };

  const executeResync = async (rowId: string, fileId: string, token: string, isRetry: boolean = false) => {
    setIsUploading(prev => ({ ...prev, [rowId]: true }));
    try {
      const res = await filesApi.importDrive(fileId, token);
      updateRow(rowId, {
        links: res.url,
        fileName: res.fileName,
        fileType: res.fileType,
        htmlContent: res.htmlContent || undefined,
        googleFileId: res.googleFileId,
        googleModifiedTime: res.googleModifiedTime,
        googleLastSyncedAt: new Date().toISOString()
      });
      setFileStatuses(prev => ({
        ...prev,
        [rowId]: { checked: true, hasUpdate: false, currentModifiedTime: res.googleModifiedTime }
      }));
      setIsUploading(prev => ({ ...prev, [rowId]: false }));
    } catch (err: any) {
      console.error('Error syncing file:', err);
      const msg = err instanceof Error ? err.message : 'Error al sincronizar';
      const isAuth =
        msg.includes('sesión de Google Drive ha expirado') ||
        msg.includes('GOOGLE_AUTH_EXPIRED');

      if (isAuth && !isRetry) {
        setAccessToken(null);
        sessionStorage.removeItem('google_access_token');
        localStorage.removeItem('google_access_token');
        sessionStorage.removeItem('google_token_expires_at');
        localStorage.removeItem('google_token_expires_at');
        requestFreshGoogleToken((freshToken) => {
          executeResync(rowId, fileId, freshToken, true);
        }, false);
      } else if (isAuth && isRetry) {
        setIsUploading(prev => ({ ...prev, [rowId]: false }));
        showAlert(
          'Sesión de Google Drive expirada',
          'Tu sesión con Google Drive expiró. Por favor hacé clic nuevamente para reconectar.',
          'warning'
        );
      } else {
        setIsUploading(prev => ({ ...prev, [rowId]: false }));
        showAlert('Error al sincronizar', msg, 'danger');
      }
    }
  };

  const handleCheckUpdates = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

    if (!clientId || !apiKey) {
      showAlert('Configuración faltante', 'Por favor, configura VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY en tu archivo .env.', 'warning');
      return;
    }

    const runCheck = (token: string) => {
      let hasDriveFiles = false;
      const forceCheck = async (t: string) => {
        const newStatuses: Record<string, FileStatus> = {};
        for (const row of rows) {
          if (!row.googleFileId) continue;
          hasDriveFiles = true;
          try {
            const url = `https://www.googleapis.com/drive/v3/files/${row.googleFileId}?fields=modifiedTime,lastModifyingUser&supportsAllDrives=true${apiKey ? `&key=${apiKey}` : ''}`;
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${t}` }
            });
            if (!res.ok) {
              if (res.status === 401) {
                setAccessToken(null);
                sessionStorage.removeItem('google_access_token');
                localStorage.removeItem('google_access_token');
                sessionStorage.removeItem('google_token_expires_at');
                localStorage.removeItem('google_token_expires_at');
              }
              newStatuses[row.id] = { checked: true, hasUpdate: false, error: true };
              continue;
            }
            const data = await res.json();
            const currentModifiedTime = data.modifiedTime;
            const hasUpdate = currentModifiedTime && row.googleModifiedTime && (currentModifiedTime !== row.googleModifiedTime);
            newStatuses[row.id] = {
              checked: true,
              hasUpdate: !!hasUpdate,
              currentModifiedTime,
              lastModifyingUser: data.lastModifyingUser?.displayName || data.lastModifyingUser?.emailAddress || 'Desconocido'
            };
          } catch (err) {
            console.error(err);
            newStatuses[row.id] = { checked: true, hasUpdate: false, error: true };
          }
        }
        setFileStatuses(newStatuses);
        if (hasDriveFiles) {
          showAlert('Verificación completa', 'Verificación de archivos completada.', 'success');
        }
      };
      
      forceCheck(token);
    };

    const currentToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
    const expiresAt = Number(localStorage.getItem('google_token_expires_at') || sessionStorage.getItem('google_token_expires_at') || 0);
    const isTokenValid = currentToken && expiresAt > 0 && Date.now() < expiresAt;

    if (isTokenValid && currentToken) {
      runCheck(currentToken);
    } else {
      requestFreshGoogleToken((freshToken) => {
        runCheck(freshToken);
      });
    }
  };

  const getTaskIconColor = (rowId: string, defaultColor: string = 'var(--accent)') => {
    const rowTasks = tasks.filter(t => t.rowId === rowId);
    if (rowTasks.length === 0) return defaultColor;
    const hasPending = rowTasks.some(t => t.status === 'PENDIENTE' || t.status === 'EN_PROCESO');
    if (hasPending) return '#f59e0b'; // orange
    const hasResolved = rowTasks.every(t => t.status === 'RESUELTO');
    if (hasResolved) return 'var(--status-available)'; // green
    return defaultColor;
  };
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggableRowId, setDraggableRowId] = useState<string | null>(null);

  const [draggedModule, setDraggedModule] = useState<{ materia: string; modulo: string } | null>(null);
  const [draggableModuleKey, setDraggableModuleKey] = useState<string | null>(null);

  const hasEditAccess = user.isAdmin || user.canEdit;
  const hasDeleteAccess = user.isAdmin || user.canDelete;
  const [collapsedMaterias, setCollapsedMaterias] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`collapsed_materias_${courseId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const [collapsedModulos, setCollapsedModulos] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`collapsed_modulos_${courseId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      const savedMaterias = localStorage.getItem(`collapsed_materias_${courseId}`);
      setCollapsedMaterias(savedMaterias ? new Set(JSON.parse(savedMaterias)) : new Set());
      
      const savedModulos = localStorage.getItem(`collapsed_modulos_${courseId}`);
      setCollapsedModulos(savedModulos ? new Set(JSON.parse(savedModulos)) : new Set());
    } catch (e) {
      console.error('Error loading collapsed states:', e);
    }
  }, [courseId]);

  const toggleMateria = (materia: string) => {
    setCollapsedMaterias(prev => {
      const next = new Set(prev);
      if (next.has(materia)) next.delete(materia); else next.add(materia);
      localStorage.setItem(`collapsed_materias_${courseId}`, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleModulo = (key: string) => {
    setCollapsedModulos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem(`collapsed_modulos_${courseId}`, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDropOnRow = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) moveRow(draggedId, targetId);
    setDraggedId(null); setDraggableRowId(null);
  };
  const handleDropOnModule = (e: React.DragEvent, moduleName: string) => {
    e.preventDefault();
    if (draggedId) moveRow(draggedId, null, moduleName);
    setDraggedId(null); setDraggableRowId(null);
  };

  const handleModuleDragStart = (e: React.DragEvent, materia: string, modulo: string) => {
    setDraggedModule({ materia, modulo });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `module:${materia}::${modulo}`);
  };

  const handleModuleDragEnd = () => {
    setDraggedModule(null);
    setDraggableModuleKey(null);
  };

  const handleModuleDrop = (e: React.DragEvent, targetMateria: string, targetModule: string) => {
    e.preventDefault();
    if (draggedModule) {
      if (moveModule) {
        moveModule(draggedModule.materia, draggedModule.modulo, targetMateria, targetModule);
      }
      setDraggedModule(null);
      setDraggableModuleKey(null);
    } else if (draggedId) {
      handleDropOnModule(e, targetModule);
    }
  };

  const handleMateriaDrop = (e: React.DragEvent, targetMateria: string) => {
    e.preventDefault();
    if (draggedModule) {
      if (moveModule) {
        moveModule(draggedModule.materia, draggedModule.modulo, targetMateria, null);
      }
      setDraggedModule(null);
      setDraggableModuleKey(null);
    }
  };


  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const rowId = activeUploadId;
    if (file && rowId) {
      setIsUploading(prev => ({ ...prev, [rowId]: true }));
      try {
        const isDocx = file.name.toLowerCase().endsWith('.docx');
        let resUrl = '';
        let resFileName = file.name;
        let resFileType = file.type;
        let resHtmlContent = '';

        if (isDocx) {
          try {
            const res = await filesApi.uploadDocx(file);
            resUrl = res.url;
            resFileName = res.fileName || file.name;
            resFileType = res.fileType || file.type;
            resHtmlContent = res.htmlContent || '';
          } catch (docxErr) {
            console.warn('filesApi.uploadDocx falló, reintentando con subida estándar:', docxErr);
            const res = await filesApi.upload(file);
            resUrl = res.url;
            resFileName = res.fileName || file.name;
            resFileType = res.fileType || file.type;
          }
        } else {
          const res = await filesApi.upload(file);
          resUrl = res.url;
          resFileName = res.fileName || file.name;
          resFileType = res.fileType || file.type;
        }

        updateRow(rowId, {
          links: resUrl,
          fileName: resFileName,
          fileType: resFileType,
          htmlContent: resHtmlContent
        });
      } catch (err) {
        console.error('Error uploading file:', err);
        showAlert('Error al subir', err instanceof Error ? err.message : 'Error al subir el archivo', 'danger');
      } finally {
        setIsUploading(prev => ({ ...prev, [rowId]: false }));
      }
    }
    e.target.value = '';
    setActiveUploadId(null);
  };

  const triggerUpload = (id: string) => { setActiveUploadId(id); fileInputRef.current?.click(); };

  // Build 3-level hierarchy: Materia → Módulo → Rows
  // Use raw values (including '') so that updateMateria/updateModule pass the correct oldName to the API
  const materias = Array.from(new Set(rows.map(r => r.materia)));

  // Helper to decide which cell to render for the links column
  const renderLinksCell = (row: CourseRow) => {
    if (isUploading[row.id]) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(139, 92, 246, 0.1)', borderRadius: '6px',
            padding: '0.25rem 0.65rem', flex: 1, minWidth: 0,
            border: '1px solid rgba(139, 92, 246, 0.22)',
            color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 500,
            overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            <Loader2 size={12} className="spin" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Procesando...</span>
          </div>
        </div>
      );
    }

    if (row.formato === 'MEET') {
      const meetUrl = row.meetLink || row.links || '';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%', padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
            <span style={{ color: '#00968F', display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Enlace de Google Meet / Videoconferencia">
              <Video size={14} />
            </span>
            <input
              type="text"
              className="cell-input"
              value={meetUrl}
              placeholder="https://meet.google.com/..."
              disabled={!hasEditAccess}
              onChange={e => {
                const val = e.target.value;
                updateRow(row.id, 'links', val);
                updateRow(row.id, 'meetLink', val);
              }}
              style={{ flex: 1, minWidth: 0, fontSize: '0.82rem' }}
              title={meetUrl}
            />
            {meetUrl && (
              <a
                href={meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Probar / Abrir enlace de Meet"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '3px 5px', borderRadius: '4px',
                  background: 'rgba(0, 150, 143, 0.12)', color: '#00968F',
                  textDecoration: 'none', flexShrink: 0
                }}
              >
                <ExternalLink size={12} />
              </a>
            )}
            {hasEditAccess && meetUrl && (
              <button
                onClick={() => {
                  updateRow(row.id, 'links', '');
                  updateRow(row.id, 'meetLink', null);
                }}
                style={{
                  background: 'none', border: 'none', color: '#ef4444',
                  cursor: 'pointer', padding: '0 2px', fontSize: '1rem', lineHeight: 1
                }}
                title="Limpiar enlace de Meet"
              >×</button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Fecha y Hora de la conferencia">
              <Calendar size={12} />
            </span>
            <input
              type="datetime-local"
              value={row.meetDateTime || ''}
              disabled={!hasEditAccess}
              onChange={e => updateRow(row.id, 'meetDateTime', e.target.value || null)}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-main)',
                fontSize: '0.74rem',
                padding: '2px 5px',
                outline: 'none',
                flex: 1,
                cursor: hasEditAccess ? 'pointer' : 'default'
              }}
              title="Fecha y hora del encuentro en vivo"
            />
          </div>
        </div>
      );
    }

    const isFile = row.fileName && row.fileType && row.fileType !== 'link';
    const isDriveLink = row.links && isGoogleDriveUrl(row.links);

    // 1. Uploaded local file / Drive file
    if (isFile) {
      const status = fileStatuses[row.id];
      const showWarning = status?.hasUpdate;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0,
                        background: row.googleFileId ? 'rgba(52, 168, 83, 0.08)' : 'rgba(139,92,246,0.1)', 
                        borderRadius: '6px',
                        padding: '0.1rem 0.6rem', 
                        border: row.googleFileId ? '1px solid rgba(52, 168, 83, 0.25)' : '1px solid rgba(139,92,246,0.2)' }}>
            
            {row.googleFileId && (
              <svg viewBox="0 0 360 322" width="12" height="12" style={{ flexShrink: 0, marginRight: '2px' }}>
                <path fill="#34A853" d="M117 220 L30 322 L243 322 L330 220 Z"/>
                <path fill="#4285F4" d="M180 0 L117 220 L330 220 L270 0 Z"/>
                <path fill="#FBBC05" d="M180 0 L30 322 L117 220 L240 0 Z"/>
              </svg>
            )}

            <input type="text" value={row.fileName || ''}
              onChange={e => updateRow(row.id, 'fileName', e.target.value)}
              disabled={!hasEditAccess}
              style={{ background: 'transparent', border: 'none', outline: 'none',
                       fontSize: '0.85rem', color: row.googleFileId ? '#2e7d32' : 'var(--accent)', flex: 1, fontWeight: 500,
                       width: '100%', padding: '0.2rem 0', textOverflow: 'ellipsis' }}
              title={hasEditAccess ? "Haz clic para editar el nombre" : undefined} />
            
            {row.links && (
              <>
                <button onClick={() => setPreviewDoc(row)}
                  title="Previsualizar archivo"
                  style={{ background: 'none', border: 'none', color: row.googleFileId ? '#2e7d32' : 'var(--accent)', cursor: 'pointer',
                           padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
                  <Eye size={13} />
                </button>
                <button onClick={() => window.open(getExternalEditUrl(row), '_blank', 'noopener,noreferrer')}
                  title="Editar archivo"
                  style={{ background: 'none', border: 'none', color: row.googleFileId ? '#2e7d32' : 'var(--accent)', cursor: 'pointer',
                           padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
                  <Pencil size={13} />
                </button>
              </>
            )}
            
            {hasEditAccess && (
              <button onClick={() => { 
                updateRow(row.id, {
                  links: '',
                  fileName: '',
                  fileType: '',
                  htmlContent: '',
                  googleFileId: null,
                  googleLastSyncedAt: null,
                  googleModifiedTime: null
                });
              }}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                         padding: '0 0 0 0.5rem', opacity: 0.7, fontSize: '1rem', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
                title="Remover">×</button>
            )}
          </div>
          
          {row.googleFileId && showWarning && (
            <div 
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#d97706',
                cursor: 'help'
              }}
              title={status?.lastModifyingUser ? `Último cambio por: ${status.lastModifyingUser}\nFecha: ${new Date(status.currentModifiedTime || '').toLocaleString('es-AR')}` : 'Modificado en Drive'}
            >
              <span>⚠️ Modificado en Drive</span>
              {hasEditAccess && (
                <button 
                  onClick={() => handleResync(row.id, row.googleFileId!)}
                  style={{
                    background: '#d97706', color: '#fff', border: 'none', borderRadius: '3px',
                    padding: '1px 6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#b45309'}
                  onMouseLeave={e => e.currentTarget.style.background = '#d97706'}
                >
                  Sincronizar
                </button>
              )}
            </div>
          )}
          
          {row.googleFileId && status?.error && (
            <div style={{ fontSize: '0.72rem', color: '#ef4444', paddingLeft: '4px' }}>
              Error al verificar cambios
            </div>
          )}
        </div>
      );
    }

    // 2. Google Drive / Docs link → show DriveLink with fetched title
    if (isDriveLink) return (
      <DriveLink
        url={row.links}
        storedTitle={row.fileName && row.fileType === 'link' ? row.fileName : ''}
        rowId={row.id}
        onTitleFetched={(id, t) => { updateRow(id, 'fileName', t); updateRow(id, 'fileType', 'link'); }}
        onClear={() => { updateRow(row.id, 'links', ''); updateRow(row.id, 'fileName', ''); updateRow(row.id, 'fileType', ''); }}
        onEdit={() => window.open(getExternalEditUrl(row), '_blank', 'noopener,noreferrer')}
        onPreview={() => setPreviewDoc(row)}
        disabled={!hasEditAccess}
      />
    );

    // 3. Other pasted link with a display name
    if (row.fileName && row.fileType === 'link') return (
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(139,92,246,0.1)',
                    borderRadius: '6px', padding: '0.1rem 0.6rem', flex: 1, minWidth: 0,
                    border: '1px solid rgba(139,92,246,0.2)' }}>
        <input type="text" value={row.fileName}
          onChange={e => updateRow(row.id, 'fileName', e.target.value)}
          disabled={!hasEditAccess}
          style={{ background: 'transparent', border: 'none', outline: 'none',
                   fontSize: '0.85rem', color: 'var(--accent)', flex: 1, fontWeight: 500,
                   width: '100%', padding: '0.2rem 0', textOverflow: 'ellipsis' }} />
        {row.links && (
          <>
            <button onClick={() => setPreviewDoc(row)}
              title="Previsualizar enlace"
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                       padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
              <Eye size={13} />
            </button>
            <button onClick={() => window.open(getExternalEditUrl(row), '_blank', 'noopener,noreferrer')}
              title="Editar enlace"
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                       padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
              <Pencil size={13} />
            </button>
          </>
        )}
        {hasEditAccess && (
          <button onClick={() => { updateRow(row.id, 'links', ''); updateRow(row.id, 'fileName', ''); updateRow(row.id, 'fileType', ''); }}
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                     padding: '0 0 0 0.5rem', opacity: 0.7, fontSize: '1rem' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            title="Remover">×</button>
        )}
      </div>
    );

    // 4. Empty → show input with placeholder
    return (
      <input type="text" className="cell-input" value={row.links}
        placeholder="https://... o subir archivo"
        disabled={!hasEditAccess}
        onChange={e => updateRow(row.id, 'links', e.target.value)}
        onPaste={e => {
          if (!hasEditAccess) return;
          const text = e.clipboardData.getData('text');
          if (!text.startsWith('http')) return;
          try {
            const url = new URL(text);
            let name = '';
            if (isGoogleDriveUrl(text)) {
              // Don't set name yet — DriveLink will fetch the real title
              e.preventDefault();
              updateRow(row.id, 'links', text);
              updateRow(row.id, 'fileType', 'link');
              return;
            } else if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
              name = 'Video de YouTube';
            } else {
              const segs = url.pathname.split('/').filter(Boolean);
              name = segs.length > 0 ? decodeURIComponent(segs[segs.length - 1]) : url.hostname;
            }
            e.preventDefault();
            updateRow(row.id, 'links', text);
            updateRow(row.id, 'fileName', name);
            updateRow(row.id, 'fileType', 'link');
          } catch { /* fallback: normal paste */ }
        }}
        title={row.links}
      />
    );
  };

  return (
    <div className="table-wrapper glass-panel" style={{ '--sticky-header-height': '53px' } as React.CSSProperties}>
      <div 
        className="table-responsive" 
        style={{ 
          paddingBottom: '80px',
          maxHeight: isHeaderCollapsed ? 'calc(100vh - 160px)' : 'calc(100vh - 250px)',
          transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <table className="content-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>NRO</th>
              <th style={{ width: '38%' }}>Descripción del contenido</th>
              <th style={{ width: '12%' }}>Formato de salida</th>
              <th style={{ width: '25%' }}>Links del contenido</th>
              <th style={{ width: '15%' }}>ESTADO</th>
              <th style={{ width: '5%' }}></th>
            </tr>
          </thead>
          <tbody>
            {materias.map((materiaName, materiaIndex) => {
              const materiaRows = rows.filter(r => r.materia === materiaName);
              const modulos = Array.from(new Set(materiaRows.map(r => r.modulo)));
              const isMateriaCollapsed = collapsedMaterias.has(materiaName);

              return (
                <React.Fragment key={`materia-${materiaIndex}`}>
                  {/* ── MATERIA HEADER (Level 1) ─────────────────── */}
                  <tr className="module-header-row materia-header-row"
                    style={{ background: 'rgba(79, 70, 229, 0.12)' }}
                    onDragOver={handleDragOver}
                    onDrop={e => handleMateriaDrop(e, materiaName)}>
                    <td colSpan={4} style={{ padding: '0.9rem 1rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <button
                          onClick={() => toggleMateria(materiaName)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary)', display: 'flex' }}
                        >
                          {isMateriaCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>MATERIA:</span>
                        <input type="text" value={materiaName}
                          placeholder="Sin materia"
                          disabled={!hasEditAccess}
                          onChange={e => updateMateria(materiaName, e.target.value)}
                          style={{ background: 'transparent', border: '1px solid transparent', fontWeight: 'bold',
                                   fontSize: '1.1rem', outline: 'none', flex: 1, padding: '0.2rem 0.5rem',
                                   borderRadius: '4px', color: 'var(--text)' }}
                          onFocus={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--border)'; }}
                          onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }} />
                      </div>
                    </td>
                    <td style={{ padding: '0.9rem 1.2rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)', verticalAlign: 'middle' }}>
                      {renderMateriaProgress(materiaRows)}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)', textAlign: 'right', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {hasEditAccess && moveMateria && (
                          <>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => moveMateria(materiaName, 'up')}
                              disabled={materiaIndex === 0}
                              title="Subir materia"
                              style={{ padding: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: materiaIndex === 0 ? 0.3 : 1 }}
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => moveMateria(materiaName, 'down')}
                              disabled={materiaIndex === materias.length - 1}
                              title="Bajar materia"
                              style={{ padding: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: materiaIndex === materias.length - 1 ? 0.3 : 1 }}
                            >
                              <ChevronDown size={16} />
                            </button>
                          </>
                        )}
                        {hasEditAccess && (
                          <button className="btn btn-sm btn-secondary" onClick={() => addRow(materiaName, `Clase ${modulos.length + 1}`)}
                            title="Agregar clase"
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            <Plus size={14} /> Añadir clase
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ── CLASES within this materia ──────────────── */}
                  {!isMateriaCollapsed && modulos.map((modName, modIndex) => {
                    const modRows = materiaRows.filter(r => r.modulo === modName);
                    const moduloKey = `${materiaIndex}::${modIndex}`;
                    const isModuloCollapsed = collapsedModulos.has(`${materiaName}::${modName}`);

                    return (
                      <React.Fragment key={moduloKey}>
                        {/* ── CLASE HEADER (Level 2) ──────────── */}
                        {/* ── CLASE HEADER (Level 2) ──────────── */}
                        <tr className="module-header-row clase-header-row"
                          draggable={hasEditAccess && draggableModuleKey === `${materiaName}::${modName}`}
                          onDragStart={e => handleModuleDragStart(e, materiaName, modName)}
                          onDragEnd={handleModuleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={e => handleModuleDrop(e, materiaName, modName)}
                          style={{
                            background: 'rgba(139, 92, 246, 0.06)',
                            opacity: draggedModule && draggedModule.materia === materiaName && draggedModule.modulo === modName ? 0.4 : 1,
                            transition: 'opacity 0.2s',
                          }}>
                          <td colSpan={6} style={{ padding: '0.65rem 1rem 0.65rem 2.5rem', borderBottom: '1px solid rgba(139, 92, 246, 0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                {hasEditAccess && (
                                  <div
                                    onMouseEnter={() => setDraggableModuleKey(`${materiaName}::${modName}`)}
                                    onMouseLeave={() => setDraggableModuleKey(null)}
                                    style={{ display: 'flex', alignItems: 'center', padding: '0.2rem', marginRight: '2px' }}
                                  >
                                    <GripVertical size={16} style={{ color: '#94a3b8', cursor: 'grab', flexShrink: 0 }} />
                                  </div>
                                )}
                                <button
                                  onClick={() => toggleModulo(`${materiaName}::${modName}`)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--accent)', display: 'flex' }}
                                >
                                  {isModuloCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                </button>
                                <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLASE:</span>
                                {/* Campo # Número de clase */}
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                  <span style={{
                                    position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)',
                                    color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none', lineHeight: 1
                                  }}>#</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    title="Clase número"
                                    value={modRows[0]?.moduloNumero ?? ''}
                                    disabled={!hasEditAccess}
                                    placeholder="—"
                                    onChange={e => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      updateModuloNumero?.(modName, val);
                                    }}
                                    style={{
                                      width: '48px', paddingLeft: '18px', paddingRight: '4px',
                                      background: 'transparent', border: '1px solid transparent',
                                      fontWeight: 700, fontSize: '0.95rem', outline: 'none',
                                      borderRadius: '4px', color: 'var(--accent)', textAlign: 'center',
                                      cursor: hasEditAccess ? 'text' : 'default',
                                    }}
                                    onFocus={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--border)'; }}
                                    onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
                                  />
                                </div>
                                <input type="text" value={modName}
                                  placeholder="Sin clase"
                                  disabled={!hasEditAccess}
                                  onChange={e => updateModule(modName, e.target.value)}
                                  style={{ background: 'transparent', border: '1px solid transparent', fontWeight: 'bold',
                                           fontSize: '1rem', outline: 'none', flex: 1, padding: '0.2rem 0.5rem',
                                           borderRadius: '4px', color: 'var(--text)' }}
                                  onFocus={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--border)'; }}
                                  onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {renderModuloProgress(modRows)}

                                {/* Fecha o Días de Disponibilidad en Panel 1 */}
                                 <div style={{ 
                                   display: 'flex', 
                                   alignItems: 'center', 
                                   gap: '6px', 
                                   background: 'rgba(255,255,255,0.03)', 
                                   padding: '4px 10px', 
                                   borderRadius: '6px', 
                                   border: '1px solid rgba(255,255,255,0.08)' 
                                 }}>
                                    {releaseMode === 'SEQUENTIAL' ? (
                                      <span style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                        🔗 Por Prelación (Secuencial)
                                      </span>
                                    ) : releaseMode === 'RELATIVE' ? (
                                     <>
                                       <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                         ⏱️ Día de inicio:
                                       </span>
                                       <input
                                         type="number"
                                         min="0"
                                         placeholder="Ej: 0"
                                         value={modRows.find(r => r.diasDisponibilidad !== null && r.diasDisponibilidad !== undefined)?.diasDisponibilidad ?? ''}
                                         disabled={!hasEditAccess}
                                         onChange={e => {
                                           const val = e.target.value === '' ? null : parseInt(e.target.value);
                                           if (modRows[0]) {
                                             updateRow(modRows[0].id, 'diasDisponibilidad', val);
                                           }
                                         }}
                                         style={{
                                           background: 'transparent',
                                           border: 'none',
                                           color: 'var(--text-primary)',
                                           fontSize: '0.75rem',
                                           outline: 'none',
                                           width: '45px',
                                           textAlign: 'center',
                                           cursor: hasEditAccess ? 'pointer' : 'default',
                                           padding: 0
                                         }}
                                       />
                                       <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>días</span>
                                     </>
                                   ) : (
                                     <>
                                       <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                         📅 Disponible:
                                       </span>
                                       <input
                                         type="date"
                                         value={modRows.find(r => r.fechaDisponibilidad)?.fechaDisponibilidad || ''}
                                         disabled={!hasEditAccess}
                                         onChange={e => {
                                           const val = e.target.value || '';
                                           if (modRows[0]) {
                                             updateRow(modRows[0].id, 'fechaDisponibilidad', val || null);
                                           }
                                         }}
                                         style={{
                                           background: 'transparent',
                                           border: 'none',
                                           color: 'var(--text-primary)',
                                           fontSize: '0.75rem',
                                           outline: 'none',
                                           cursor: hasEditAccess ? 'pointer' : 'default',
                                           padding: 0
                                         }}
                                       />
                                     </>
                                   )}
                                 </div>

                                {hasEditAccess && (
                                  <button className="btn btn-sm btn-secondary" onClick={() => addRow(materiaName, modName)}
                                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}>
                                    <Plus size={13} /> Añadir contenido
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* ── CONTENT ROWS (Level 3) ───────────── */}
                        {!isModuloCollapsed && modRows.map(row => {
                          const isRowOfDraggedModule = draggedModule && draggedModule.materia === materiaName && draggedModule.modulo === modName;
                          return (
                            <tr key={row.id}
                              draggable={hasEditAccess && draggableRowId === row.id}
                              onDragStart={e => handleDragStart(e, row.id)}
                              onDragOver={handleDragOver}
                              onDrop={e => handleDropOnRow(e, row.id)}
                              onDragEnd={() => { setDraggedId(null); setDraggableRowId(null); }}
                              style={{ opacity: (draggedId === row.id || isRowOfDraggedModule) ? 0.5 : 1, transition: 'opacity 0.2s',
                                       background: draggedId === row.id ? 'var(--surface)' : 'transparent' }}>
                            {/* NRO */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '1.5rem' }}>
                                {hasEditAccess && (
                                  <div onMouseEnter={() => setDraggableRowId(row.id)} onMouseLeave={() => setDraggableRowId(null)}
                                    style={{ display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                                    <GripVertical size={16} style={{ color: '#94a3b8', cursor: 'grab', flexShrink: 0 }} />
                                  </div>
                                )}
                                <input type="text" className="cell-input" value={row.nro}
                                  disabled={!hasEditAccess}
                                  onChange={e => updateRow(row.id, 'nro', e.target.value)}
                                  style={{ width: '100%' }} />
                              </div>
                            </td>
                            {/* Descripción */}
                            <td>
                              <input type="text" className="cell-input" value={row.descripcion}
                                placeholder="Descripción del contenido..."
                                disabled={!hasEditAccess}
                                onChange={e => updateRow(row.id, 'descripcion', e.target.value)} />
                            </td>
                            {/* Formato */}
                            <td>
                              <select className="cell-select" value={row.formato}
                                disabled={!hasEditAccess}
                                onChange={e => updateRow(row.id, 'formato', e.target.value)}>
                                {formatOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </td>
                            {/* Links */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {renderLinksCell(row)}

                                {/* Upload button (hidden when Google Drive link active) */}
                                {hasEditAccess && !isGoogleDriveUrl(row.links) && (
                                  <button className="icon-btn"
                                    style={{ padding: '0.3rem', color: 'var(--accent)', flexShrink: 0 }}
                                    onClick={() => triggerUpload(row.id)}
                                    title="Subir Archivo (.doc, .pdf, .mp4)">
                                    <Upload size={14} />
                                  </button>
                                )}

                                {/* Google Drive Picker button */}
                                {hasEditAccess && googleLoaded && (
                                  <button className="icon-btn"
                                    style={{ padding: '0.3rem', color: '#34a853', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={() => handleGoogleDrivePick(row.id)}
                                    title="Importar desde Google Drive">
                                    <svg viewBox="0 0 360 322" width="14" height="14" style={{ flexShrink: 0 }}>
                                      <path fill="#34A853" d="M117 220 L30 322 L243 322 L330 220 Z"/>
                                      <path fill="#4285F4" d="M180 0 L117 220 L330 220 L270 0 Z"/>
                                      <path fill="#FBBC05" d="M180 0 L30 322 L117 220 L240 0 Z"/>
                                    </svg>
                                  </button>
                                )}

                                {/* External link button for non-drive, non-file links */}
                                {row.links && !isGoogleDriveUrl(row.links) && (
                                  row.fileName && row.fileType !== 'link' ? (
                                    <button
                                      onClick={() => window.open(getExternalEditUrl(row), '_blank', 'noopener,noreferrer')}
                                      title="Editar archivo"
                                      style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', border: 'none', cursor: 'pointer',
                                               borderRadius: '6px', color: 'var(--accent)',
                                               background: 'rgba(139,92,246,0.12)', transition: 'background 0.2s', flexShrink: 0 }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.28)')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}>
                                      <Pencil size={14} />
                                    </button>
                                  ) : (
                                    <a href={row.links} target="_blank" rel="noopener noreferrer"
                                      title="Abrir enlace"
                                      style={{ display: 'flex', alignItems: 'center', padding: '0.3rem',
                                               borderRadius: '6px', color: 'var(--accent)',
                                               background: 'rgba(139,92,246,0.12)', transition: 'background 0.2s', flexShrink: 0 }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.28)')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}>
                                      <ExternalLink size={14} />
                                    </a>
                                  )
                                )}
                              </div>
                            </td>
                            {/* Estado */}
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  background: 'rgba(0, 0, 0, 0.3)',
                                  padding: '5px 10px',
                                  borderRadius: '20px',
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  justifyContent: 'center'
                                }}>
                                  {configEstados.map(estado => {
                                    const esActivo = row.estado === estado.value;
                                    return (
                                      <button
                                        key={estado.value}
                                        onClick={() => hasEditAccess && updateRow(row.id, 'estado', estado.value)}
                                        disabled={!hasEditAccess}
                                        title={estado.label}
                                        style={{
                                          width: esActivo ? '15px' : '10px',
                                          height: esActivo ? '15px' : '10px',
                                          borderRadius: '50%',
                                          backgroundColor: estado.color,
                                          border: 'none',
                                          padding: 0,
                                          cursor: hasEditAccess ? 'pointer' : 'default',
                                          opacity: esActivo ? 1.0 : 0.25,
                                          transform: esActivo ? 'scale(1.1)' : 'scale(1)',
                                          boxShadow: esActivo ? `0 0 10px ${estado.glow}` : 'none',
                                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                          flexShrink: 0
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                            {/* Acciones */}
                            <td className="actions-cell" style={{ borderBottom: 'none', verticalAlign: 'middle', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                <button 
                                  className="icon-btn" 
                                  style={{ color: getTaskIconColor(row.id), padding: '4px', cursor: 'pointer' }} 
                                  onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin clase', row.nro)}
                                  title="Crear tarea / observación"
                                >
                                  <ClipboardList size={16} />
                                </button>
                                <button
                                  className="icon-btn"
                                  style={{ color: 'var(--text-muted)', padding: '4px', cursor: 'pointer' }}
                                  onClick={() => setHistoryRow({ id: row.id, label: `Clase ${row.nro} - ${row.modulo || 'Sin clase'}` })}
                                  title="Ver historial de cambios"
                                >
                                  <Clock size={16} />
                                </button>
                                {hasDeleteAccess && (
                                  <button 
                                    className="icon-btn danger" 
                                    style={{ padding: '4px', cursor: 'pointer' }} 
                                    onClick={() => removeRow(row.id)}
                                    title="Eliminar contenido"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {(hasEditAccess || (googleLoaded && rows.some(r => r.googleFileId))) && (
        <div 
          style={{ 
            position: 'fixed', 
            bottom: '24px', 
            left: isSidebarCollapsed ? '104px' : '304px', 
            display: 'flex', 
            gap: '12px', 
            zIndex: 100,
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {hasEditAccess && (
            <>
              <button 
                className="btn btn-primary" 
                onClick={() => addRow(`Materia ${materias.length + 1}`, 'Clase 1')}
                style={{ 
                  borderRadius: '50px', 
                  padding: '0.75rem 1.25rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontWeight: 600, 
                  boxShadow: '0 10px 25px -5px rgba(20, 184, 166, 0.4)' 
                }}
              >
                <Plus size={16} /> Añadir Materia
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsImportModalOpen(true)}
                style={{ 
                  borderRadius: '50px', 
                  padding: '0.75rem 1.25rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontWeight: 600, 
                  border: '1px solid var(--border)', 
                  background: 'var(--bg-secondary)', 
                  color: 'var(--text-main)', 
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                }}
              >
                <Upload size={16} /> Importar Cronograma
              </button>
            </>
          )}
          {googleLoaded && rows.some(r => r.googleFileId) && (
            <button 
              className="btn btn-secondary" 
              onClick={handleCheckUpdates} 
              style={{ 
                borderRadius: '50px', 
                padding: '0.75rem 1.25rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontWeight: 600, 
                border: '1px solid var(--border)', 
                background: 'var(--bg-secondary)', 
                color: 'var(--text-main)', 
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
              }}
            >
              <Clock size={16} /> Verificar actualizaciones de Drive
            </button>
          )}
        </div>
      )}

      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload}
        accept=".pdf,.doc,.docx,.mp4,video/mp4,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />

      {historyRow && (
        <HistoryDrawer
          rowId={historyRow.id}
          courseId={courseId}
          rowLabel={historyRow.label}
          panel={1}
          onRestored={() => {}}
          onClose={() => setHistoryRow(null)}
        />
      )}

      {previewDoc && (
        <DocumentPreviewModal
          row={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      <VideotecaModal
        isOpen={!!videotecaRowId}
        onClose={() => setVideotecaRowId(null)}
        onSelect={(video) => {
          if (videotecaRowId) {
            updateRow(videotecaRowId, {
              videoVimeo: `https://videos.maradonamenotti.cloud/embed/${video.id}`,
              fileName: video.title,
              fileType: 'link',
              links: `https://videos.maradonamenotti.cloud/embed/${video.id}`
            });
          }
        }}
      />
      {isImportModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#13131a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(90deg, #002d2b 0%, #13131a 100%)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={20} color="#00ffc4" /> Importar Cronograma desde Excel/CSV
              </h3>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, color: '#e4e4e7', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Instructions alert */}
              <div style={{
                backgroundColor: 'rgba(0,255,196,0.05)',
                border: '1px solid rgba(0,255,196,0.2)',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                color: '#a7f3d0'
              }}>
                <strong>💡 Columnas Esperadas:</strong> El archivo debe incluir cabeceras en la fila de títulos como 
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', margin: '0 4px', borderRadius: '4px', color: '#00ffc4' }}>NRO</code>, 
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', margin: '0 4px', borderRadius: '4px', color: '#00ffc4' }}>CLASE</code>, 
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', margin: '0 4px', borderRadius: '4px', color: '#00ffc4' }}>DESCRIPCIÓN</code>, 
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', margin: '0 4px', borderRadius: '4px', color: '#00ffc4' }}>SALIDA</code>, y opcionalmente 
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', margin: '0 4px', borderRadius: '4px', color: '#00ffc4' }}>LINK REFERENCIA</code>, 
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', margin: '0 4px', borderRadius: '4px', color: '#00ffc4' }}>VIMEO MM</code> o 
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', margin: '0 4px', borderRadius: '4px', color: '#00ffc4' }}>LINK ESP</code>.
                <br/>
                <em>* Si subís un archivo Excel (.xlsx) con varias pestañas, se creará automáticamente una <strong>Materia por cada pestaña</strong>.</em>
              </div>

              {/* File input / Drag & drop */}
              <div 
                style={{
                  border: '2px dashed rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  transition: 'border-color 0.2s',
                  position: 'relative'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(0, 255, 196, 0.4)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
                onClick={() => document.getElementById('import-file-selector')?.click()}
              >
                <input 
                  type="file" 
                  id="import-file-selector" 
                  accept=".csv,.xlsx" 
                  onChange={handleFileChange} 
                  style={{ display: 'none' }} 
                />
                <Upload size={32} color="#888" style={{ marginBottom: '0.75rem' }} />
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                  {importFile ? `📄 ${importFile.name}` : 'Elegir archivo Excel (.xlsx) o CSV'}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#888' }}>
                  {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : 'Arrastrá el archivo aquí o hacé clic para buscar'}
                </p>
              </div>

              {/* CSV Default Materia config */}
              {importPreview.length === 1 && importFile && !importFile.name.endsWith('.xlsx') && !importFile.name.endsWith('.xls') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#aaa' }}>Asociar este CSV a la Materia:</label>
                  <select 
                    value={importMateriaDefault} 
                    onChange={(e) => setImportMateriaDefault(e.target.value)}
                    style={{
                      backgroundColor: '#1b1b24',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '0.6rem 0.8rem',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  >
                    <option value={importMateriaDefault || 'NUEVA MATERIA'}>Crear Materia: "{importMateriaDefault || 'NUEVA MATERIA'}"</option>
                    {materias.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Preview data */}
              {importPreview.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#aaa' }}>Resumen de Contenido Detectado:</label>
                  <div style={{
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    padding: '0.8rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {importPreview.map((group, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.88rem',
                        borderBottom: idx < importPreview.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        paddingBottom: idx < importPreview.length - 1 ? '8px' : 0
                      }}>
                        <span style={{ fontWeight: 600, color: '#00ffc4' }}>
                          📚 {importPreview.length === 1 && !importFile?.name?.endsWith('.xlsx') ? importMateriaDefault : group.materia}
                        </span>
                        <span style={{ color: '#aaa', fontSize: '0.82rem' }}>
                          {group.classesCount} Clases | {group.itemsCount} Recursos
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overwrite mode */}
              {importPreview.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '0.5rem',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  border: importOverwrite ? '1px solid rgba(229,57,53,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  backgroundColor: importOverwrite ? 'rgba(229,57,53,0.03)' : 'transparent'
                }}>
                  <input 
                    type="checkbox" 
                    id="overwrite-import-check"
                    checked={importOverwrite}
                    onChange={(e) => setImportOverwrite(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="overwrite-import-check" style={{ fontSize: '0.85rem', cursor: 'pointer', color: importOverwrite ? '#f87171' : '#ccc' }}>
                    ⚠️ <strong>Sobrescribir el curso completo</strong> (Elimina todas las clases actuales e inicia con esta nueva estructura)
                  </label>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#0f0f14'
            }}>
              <button 
                className="btn btn-secondary"
                disabled={isImporting}
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
                style={{
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'none',
                  color: '#ccc'
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary"
                disabled={isImporting || importPreview.length === 0}
                onClick={handleExecuteImport}
                style={{
                  borderRadius: '6px',
                  padding: '0.5rem 1.25rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: isImporting || importPreview.length === 0 ? '#444' : 'rgba(20, 184, 166, 0.9)',
                  color: '#fff',
                  border: 'none',
                  cursor: isImporting || importPreview.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {isImporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Importando...
                  </>
                ) : (
                  'Iniciar Importación'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {DialogRenderer}
    </div>
  );
};

interface DocumentPreviewModalProps {
  row: CourseRow;
  onClose: () => void;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ row, onClose }) => {
  const isDrive = isGoogleDriveUrl(row.links || '');
  const fileId = row.googleFileId || (row.links ? extractGoogleFileId(row.links) : null);
  const genUrl = row.geniallyUrl || (row.formato === 'GENIALLY' && row.links ? row.links : (row.links && isGeniallyUrl(row.links) ? row.links : null));
  
  let contentNode = null;

  if (genUrl) {
    contentNode = (
      <iframe
        src={genUrl}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', background: '#fff' }}
        allow="autoplay; fullscreen"
        allowFullScreen
        title="Previsualización de Genially"
      />
    );
  } else if (isDrive && fileId) {
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    contentNode = (
      <iframe
        src={previewUrl}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
        allow="autoplay"
        title="Previsualización de Google Drive"
      />
    );
  } else if (row.htmlContent) {
    contentNode = (
      <div 
        style={{ 
          width: '100%', 
          height: '100%', 
          overflowY: 'auto', 
          background: 'rgba(0, 0, 0, 0.4)', 
          padding: '2rem 1rem', 
          display: 'flex', 
          justifyContent: 'center' 
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .word-preview-page img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            margin: 1.5rem 0;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
          }
          .word-preview-page table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
            font-size: 0.9rem;
          }
          .word-preview-page th, .word-preview-page td {
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 12px;
            text-align: left;
          }
          .word-preview-page th {
            background: rgba(255, 255, 255, 0.05);
          }
        ` }} />
        <div 
          className="word-preview-page"
          style={{
            background: '#ffffff',
            color: '#333333',
            width: '100%',
            maxWidth: '800px',
            minHeight: '100%',
            padding: '3rem 4rem',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            boxSizing: 'border-box',
            fontFamily: 'Georgia, serif',
            lineHeight: 1.6,
            fontSize: '1.05rem',
            overflowX: 'hidden'
          }}
          dangerouslySetInnerHTML={{ __html: injectVmmPlayers(row.htmlContent || '') }}
        />
      </div>
    );
  } else if (row.links && row.links.includes('res.cloudinary.com') && row.links.includes('/raw/upload/')) {
    contentNode = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <ClipboardList size={48} style={{ color: 'var(--primary)' }} />
        <h4 style={{ color: 'var(--text-main)', margin: 0 }}>Archivo de Servidor Multimedia</h4>
        <p style={{ maxWidth: '400px', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Este archivo ({row.fileName || 'documento'}) está almacenado en el servidor multimedia de forma segura. Para visualizarlo o descargarlo, haz clic en el botón <strong>"Abrir Externo"</strong> en la esquina superior derecha.
        </p>
      </div>
    );
  } else if (row.links && (row.links.endsWith('.pdf') || row.fileType === 'application/pdf')) {
    contentNode = (
      <iframe
        src={row.links}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
        title="Previsualización de PDF"
      />
    );
  } else if (row.links && (row.links.endsWith('.docx') || row.links.endsWith('.doc'))) {
    contentNode = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <ClipboardList size={48} style={{ color: 'var(--primary)' }} />
        <h4 style={{ color: 'var(--text-main)', margin: 0 }}>Documento Word (.docx)</h4>
        <p style={{ maxWidth: '400px', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {row.fileName || 'Este documento está listo para ser visualizado o descargado.'}
        </p>
        <a href={row.links} target="_blank" rel="noopener noreferrer" download style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--primary)', color: '#ffffff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>
          📥 Descargar documento Word
        </a>
      </div>
    );
  } else {
    contentNode = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem' }}>
        <EyeOff size={48} />
        <span>No hay previsualización disponible para este tipo de archivo.</span>
        {row.links && (
          <a href={row.links} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
            Abrir archivo en pestaña nueva
          </a>
        )}
      </div>
    );
  }

  return createPortal(
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
    >
      {/* Floating Close Button */}
      <button 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 100000,
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#ffffff',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          transition: 'all 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        ×
      </button>

      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1200px',
          height: '85vh',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Previsualización de Documento
            </span>
            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.fileName || 'Documento sin título'}
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {row.links && (
              <a 
                href={getExternalEditUrl(row)} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  color: '#ffffff',
                  textDecoration: 'none',
                  background: 'rgba(20, 184, 166, 0.15)',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(20, 184, 166, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(20, 184, 166, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.3)';
                }}
              >
                <ExternalLink size={14} />
                Abrir Externo
              </a>
            )}
            <button 
              onClick={onClose}
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                border: 'none', 
                color: 'var(--text-main)', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div style={{ flex: 1, minHeight: 0, background: 'rgba(0, 0, 0, 0.2)' }}>
          {contentNode}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ContentTable;
