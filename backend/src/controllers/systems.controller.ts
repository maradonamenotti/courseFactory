import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Course } from '../entities/Course';
import { CourseRow } from '../entities/CourseRow';

/**
 * Reemplaza los placeholders del template con los datos reales del row.
 * Se aplica tanto en el customCode de cada bloque (antes de Gemini)
 * como en el HTML final generado (después de Gemini) como seguridad extra.
 */
function replacePlaceholders(text: string, row: Record<string, any>): string {
  // 1. Video URL resolving
  let vimeoUrl = '';
  if (row.videoVimeo) {
    const trimmed = String(row.videoVimeo).trim();
    if (trimmed.includes('videos.maradonamenotti.cloud') || /^(vid-|[0-9a-f]{8}-)/i.test(trimmed)) {
      const videoId = trimmed.split('/embed/').pop()?.split('?')[0] || trimmed;
      vimeoUrl = `https://videos.maradonamenotti.cloud/embed/${videoId}`;
    } else {
      vimeoUrl = `https://player.vimeo.com/video/${extractVimeoId(row.videoVimeo)}`;
    }
  } else {
    const fallback = row.videoDrive || row.links || '';
    if (fallback.includes('videos.maradonamenotti.cloud') || fallback.includes('drive.google.com') || fallback.includes('vimeo.com') || fallback.match(/\.(mp4|webm|ogg|mov)/i)) {
      vimeoUrl = fallback;
    }
  }

  // 2. Genially URL resolving
  let urlGenially = '';
  if (row.geniallyUrl) {
    urlGenially = row.geniallyUrl;
  } else if (row.formato === 'GENIALLY') {
    urlGenially = row.links || '';
  } else {
    const fallback = row.links || '';
    if (fallback.includes('genial.ly') || fallback.includes('geni.al') || fallback.includes('cloudinary.com')) {
      urlGenially = fallback;
    }
  }

  // 3. Enlaces Adjuntos resolving
  let urlEnlacesAdjuntos = row.links || '';
  if (urlEnlacesAdjuntos.includes('res.cloudinary.com') && urlEnlacesAdjuntos.includes('/raw/upload/')) {
    urlEnlacesAdjuntos = '';
  }

  let imageUrl = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';
  if (row.links && (row.links.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || row.links.includes('drive.google.com') || row.links.includes('unsplash.com'))) {
    imageUrl = row.links;
  }
  
  return text
    .replace(/\[URL_VIDEO_VIMEO\]/g, vimeoUrl)
    .replace(/\[URL_GENIALLY\]/g, urlGenially)
    .replace(/\[URL_ENLACES_ADJUNTOS\]/g, urlEnlacesAdjuntos)
    .replace(/\[URL_IMAGEN\]/g, imageUrl)
    .replace(/\[MODULO\]/g, row.modulo || '')
    .replace(/\[DESCRIPCION\]/g, row.descripcion || '')
    .replace(/\[MATERIA\]/g, row.materia || '')
    .replace(/\[LICENCIA\]/g, row.licencia || '')
    .replace(/\[NRO\]/g, row.nro || row.moduloNumero || (row.sortOrder !== undefined ? String(row.sortOrder + 1) : '1'))
    .replace(/\[COURSE_ID\]/g, row.courseId || '')
    .replace(/\[ROW_ID\]/g, row.id || '');
}

/**
 * Extrae el ID numérico de una URL de Vimeo.
 * Soporta player.vimeo.com/video/ID, vimeo.com/ID, manage/videos/ID, etc.
 */
function extractVimeoId(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;

  // 1. Match unlisted format: vimeo.com/1205650818/0c9f5bd3e7
  const unlistedMatch = trimmed.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|manage\/videos\/)?(\d+)\/([a-zA-Z0-9]+)/i);
  if (unlistedMatch) {
    return `${unlistedMatch[1]}?h=${unlistedMatch[2]}`;
  }

  // 2. Match standard format, preserving parameter ?h= if present
  const hParamMatch = trimmed.match(/[?&]h=([a-zA-Z0-9]+)/i);
  const match = trimmed.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/|manage\/videos\/)?(\d+)/i);
  if (match) {
    const videoId = match[1];
    return hParamMatch ? `${videoId}?h=${hParamMatch[1]}` : videoId;
  }

  // 3. Fallback digits search
  const fallback = trimmed.match(/(?:\/|^)(\d{8,12})(?:\/|\?|$)/);
  if (fallback) {
    const videoId = fallback[1];
    if (hParamMatch) return `${videoId}?h=${hParamMatch[1]}`;
    const postIdMatch = trimmed.match(new RegExp('\\/' + videoId + '\\/([a-zA-Z0-9]+)'));
    if (postIdMatch) return `${videoId}?h=${postIdMatch[1]}`;
    return videoId;
  }
  return '';
}

/**
 * Genera el script de carga dinámica para Google Fonts como fallback para Moodle.
 */
function getGoogleFontsScript(headlineFont: string, bodyFont: string): string {
  const fonts = [headlineFont, bodyFont].filter(Boolean);
  const cleanFonts = fonts.map(f => f.replace(/['"]/g, '').trim()).filter(Boolean);
  const uniqueFonts = Array.from(new Set(cleanFonts));

  if (uniqueFonts.length === 0) return '';

  const families: string[] = [];
  for (const font of uniqueFonts) {
    if (font === 'Bebas Neue') {
      families.push('family=Bebas+Neue');
    } else if (font === 'Roboto') {
      families.push('family=Roboto:wght@400;500;700');
    } else if (font === 'Plus Jakarta Sans') {
      families.push('family=Plus+Jakarta+Sans:wght@500;600;700;800');
    } else if (font === 'Manrope') {
      families.push('family=Manrope:wght@400;500;600;700');
    } else if (font === 'Inter') {
      families.push('family=Inter:wght@400;500;600;700;800');
    } else if (font === 'Outfit') {
      families.push('family=Outfit:wght@400;500;600;700;800');
    } else if (font === 'Open Sans') {
      families.push('family=Open+Sans:wght@400;500;600;700');
    } else if (font === 'Montserrat') {
      families.push('family=Montserrat:wght@400;500;600;700');
    } else if (font === 'Poppins') {
      families.push('family=Poppins:wght@400;500;600;700');
    } else if (font === 'Exo 2') {
      families.push('family=Exo+2:wght@300;400;500;600;700;800');
    } else {
      families.push(`family=${encodeURIComponent(font)}:wght@400;500;700`);
    }
  }

  return `\n<!-- Dynamic Google Fonts Loader for Moodle/CSP sanitization fallback -->\n<script>\n(function() {\n  var url = 'https://fonts.googleapis.com/css2?${families.join('&')}&display=swap';\n  var doc = window.document;\n  var docs = [doc];\n  try {\n    if (window.parent && window.parent.document && window.parent !== window) {\n      docs.push(window.parent.document);\n    }\n  } catch(e) {}\n  \n  for (var k = 0; k < docs.length; k++) {\n    var d = docs[k];\n    var links = d.querySelectorAll('link[href*="fonts.googleapis.com"]');\n    var loaded = false;\n    for (var j = 0; j < links.length; j++) {\n      if (links[j].href.indexOf(url) !== -1 || links[j].href.indexOf('Bebas+Neue') !== -1) {\n        loaded = true;\n        break;\n      }\n    }\n    if (!loaded) {\n      var p1 = d.createElement('link');\n      p1.rel = 'preconnect';\n      p1.href = 'https://fonts.googleapis.com';\n      (d.head || d.getElementsByTagName('head')[0] || d.body).appendChild(p1);\n      \n      var p2 = d.createElement('link');\n      p2.rel = 'preconnect';\n      p2.href = 'https://fonts.gstatic.com';\n      p2.crossOrigin = 'anonymous';\n      (d.head || d.getElementsByTagName('head')[0] || d.body).appendChild(p2);\n      \n      var l = d.createElement('link');\n      l.rel = 'stylesheet';\n      l.href = url;\n      (d.head || d.getElementsByTagName('head')[0] || d.body).appendChild(l);\n    }\n  }\n})();\n</script>\n`;
}

/**
 * Transforma URLs de Vimeo y de videos.maradonamenotti.cloud en iframes responsivos (16:9)
 */
function embedVimeoAndVideoLinks(html: string): string {
  if (!html) return '';

  // 0. Clean stray broken trailing query tags like ?share=copy&fl=sv&fe=cl">
  let processed = html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\?share=copy[^\s"'>]*["']?>/gi, '')
    .replace(/(\s|^)\?share=[^\s<]+/gi, '');

  // 1. Protect existing <iframe> tags
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

  // 2. Parse optional preceding title paragraph + video paragraph + optional download paragraph
  processed = processed.replace(
    /(?:(<p[^>]*>(?:(?!<\/p>)[\s\S])*?<\/p>)\s*)?(<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:vimeo\.com|mediadelivery\.net|videos\.maradonamenotti\.cloud)[\s\S]*?<\/p>)(?:\s*(<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:Descargar|\.mp4|\.mov|\.mkv|drive\.google\.com|docs\.google\.com)[\s\S]*?<\/p>))?/gi,
    (fullMatch, titleP, videoP, downloadP) => {
      if (!videoP) return fullMatch;

      const urlMatch = videoP.match(/href=["']([^"']+)["']/i) || videoP.match(VIDEO_URL_REGEX);
      if (!urlMatch) return fullMatch;

      const videoUrl = urlMatch[1] || urlMatch[0];
      const embedSrc = getEmbedSrc(videoUrl);

      // Extract Title
      let title = '';
      const cleanVideoP = videoP.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, '');
      const videoPParts = cleanVideoP.split(/<br\s*\/?>|<a\b|Ver:/i);
      const textInVideoP = videoPParts[0].replace(/<[^>]+>/g, '').trim();

      if (textInVideoP && textInVideoP.length > 2 && !textInVideoP.toLowerCase().startsWith('ver')) {
        title = textInVideoP;
      } else if (titleP) {
        const titleText = titleP.replace(/<[^>]+>/g, '').trim();
        if (titleText && !titleText.toLowerCase().includes('enlaces') && !titleText.toLowerCase().includes('importante') && !titleText.toLowerCase().startsWith('ver:')) {
          title = titleText;
        }
      }

      // Extract Download link
      let downloadHtml = '';
      const rawDownload = downloadP || (cleanVideoP.toLowerCase().includes('descargar') ? videoP : '');

      if (rawDownload) {
        const linkMatch = rawDownload.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (linkMatch) {
          const rawHref = linkMatch[1];
          let directHref = rawHref;
          const gIdMatch = rawHref.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (gIdMatch) {
            directHref = `https://drive.google.com/uc?export=download&id=${gIdMatch[1]}`;
          }
          const anchorText = linkMatch[2].replace(/<[^>]+>/g, '').trim();
          const cleanLabel = anchorText.replace(/^Descargar:\s*/i, '').trim() || 'Descargar Video';
          downloadHtml = `<a href="${directHref}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; background: #00968f; color: #ffffff; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; box-shadow: 0 2px 6px rgba(0,150,143,0.3); transition: all 0.2s;">📥 Descargar: ${cleanLabel}</a>`;
        } else {
          const plainText = rawDownload.replace(/<[^>]+>/g, '').trim();
          if (plainText) {
            downloadHtml = `<span style="font-weight: 600; font-size: 0.85rem; color: #475569;">📥 ${plainText}</span>`;
          }
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
          (downloadHtml ? `<div style="margin-top: 0.25rem; font-size: 0.85rem; color: #475569; word-break: break-all;">${downloadHtml}</div>` : '') +
        `</div>`;

      cardItems.push(cardHtml);
      return `___CF_CARD_ITEM_${cardIndex}___`;
    }
  );

  // 3. Match any remaining bare video URLs outside <p> tags
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

  // 4. Restore protected iframes
  processed = processed.replace(/___CF_IFRAME_PROTECTED_(\d+)___/g, (_, idx) => iframes[parseInt(idx, 10)] || '');

  // 5. Group consecutive card items into 2-column grid container
  const gridPlaceholderRegex = /(?:___CF_CARD_ITEM_\d+___\s*)+/gi;
  processed = processed.replace(gridPlaceholderRegex, (gridMatch) => {
    const indices = (gridMatch.match(/___CF_CARD_ITEM_(\d+)___/g) || []).map(m => parseInt(m.replace(/[^\d]/g, ''), 10));
    if (indices.length >= 2) {
      const cardsContent = indices.map(i => cardItems[i]).join('\n');
      return `<div class="cf-video-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin: 2rem 0; width: 100%; box-sizing: border-box; clear: both;">` +
        cardsContent +
      `</div>`;
    } else if (indices.length === 1) {
      return cardItems[indices[0]];
    }
    return gridMatch;
  });

  // Restore any remaining single card items
  processed = processed.replace(/___CF_CARD_ITEM_(\d+)___/g, (_, i) => cardItems[parseInt(i, 10)] || '');

  return processed;
}

export function stripVideoAndGeniallyCaptions(html: string): string {
  if (!html) return '';
  return html
    .replace(/(class=["'][^"']*(?:block-video|block-genially)[^"']*["'][^>]*>[\s\S]*?<iframe[\s\S]*?<\/iframe>\s*<\/div>)\s*<p[^>]*>[\s\S]*?<\/p>/gi, '$1')
    .replace(/(<div[^>]*style="[^"]*padding-bottom:\s*56\.25%[^"]*"[^>]*>\s*<iframe[\s\S]*?<\/iframe>\s*<\/div>)\s*<p[^>]*>[\s\S]*?<\/p>/gi, '$1');
}

export interface QuizOption {
  letter: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  num: number;
  question: string;
  options: QuizOption[];
  justification?: string;
}

/**
 * Parsea determinísticamente las preguntas y opciones de opción múltiple desde el HTML
 * o texto extraído de Word (.docx), identificando preguntas numeradas, opciones (A, B, C, D),
 * respuestas correctas marcadas con [CORRECT], ✓, ✅, asteriscos, negrita o estilos,
 * y justificaciones/explicaciones al pie de cada pregunta.
 */
export function parseDocxQuizQuestions(content: string): QuizQuestion[] {
  if (!content) return [];
  
  const text = content
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
    .replace(/<span\b[^>]*>(.*?)<\/span>/gi, '$1')
    .replace(/<\/?(h[1-6]|p|div|li|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const questions: QuizQuestion[] = [];
  let currentQ: QuizQuestion | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.replace(/<[^>]+>/g, '').trim();
    const cleanLine = stripped.replace(/\[CORRECT\]\s*✓?/gi, '').trim();

    const qMatch = cleanLine.match(/^(?:Pregunta\s+)?(\d+)[\.\)\:\-]\s*([\s\S]*)$/i);
    const optMatch = cleanLine.match(/^([A-E])[\.\)\:\-]\s*([\s\S]*)$/i);
    const answerMatch = cleanLine.match(/^(?:la\s+)?(?:respuesta|opci[oó]n|rta\.?)\s*(?:correcta)?\s*(?:es)?\s*[:\-]?\s*(?:la\s+)?(?:opci[oó]n\s+)?([A-E])\b/i) ||
                       cleanLine.match(/^(?:correcta|correct)\s*[:\-]?\s*([A-E])\b/i);

    if (qMatch && !optMatch) {
      if (currentQ && currentQ.options.length >= 2) {
        questions.push(currentQ);
      }
      const qTitle = qMatch[2].replace(/<\/?[a-z0-9]+[^>]*>/gi, ' ').trim();
      currentQ = {
        num: parseInt(qMatch[1], 10),
        question: qTitle,
        options: []
      };
    } else if (optMatch && currentQ) {
      const letter = optMatch[1].toUpperCase();
      const rawOpt = line;
      const isExplicitSymbol = /✅|✓|☑️|✔/i.test(rawOpt);
      const isBold = /<strong>/i.test(rawOpt) || /<b>/i.test(rawOpt);
      const isCorrectTag = /\[CORRECT\]|\(correcta\)|\[correcta\]/i.test(rawOpt);

      const isCorrect = isExplicitSymbol || isBold || isCorrectTag;
      const optText = optMatch[2]
        .replace(/<\/?[a-z0-9]+[^>]*>/gi, ' ')
        .replace(/✓|✅|☑️|✔|\*|\[CORRECT\]|\(correcta\)|\[correcta\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      currentQ.options.push({
        letter,
        text: optText,
        isCorrect
      });
      const lastOpt = currentQ.options[currentQ.options.length - 1] as any;
      lastOpt._explicit = isExplicitSymbol || isCorrectTag;
      lastOpt._bold = isBold;
    } else if (answerMatch && currentQ) {
      (currentQ as any)._targetLetter = answerMatch[1].toUpperCase();
    } else if (currentQ) {
      const extraText = stripped
        .replace(/\(cuando\s+se\s+elige\s+la\s+respuesta[^\)]*\)/gi, '')
        .replace(/^justificación\s*[:\-]?\s*/gi, '')
        .trim();
      if (extraText && !extraText.toLowerCase().includes('cuestionario') && !extraText.toLowerCase().includes('táctica y estrategia')) {
        if (currentQ.options.length === 0) {
          currentQ.question = (currentQ.question ? currentQ.question + ' ' : '') + extraText;
        } else if (currentQ.options.length >= 2) {
          currentQ.justification = (currentQ.justification ? currentQ.justification + ' ' : '') + extraText;
        }
      }
    }
  }

  if (currentQ && currentQ.options.length >= 2) {
    questions.push(currentQ);
  }

  for (let k = 0; k < questions.length; k++) {
    const qObj = questions[k];
    const opts = qObj.options as any[];
    const targetLetter = (qObj as any)._targetLetter;

    if (targetLetter) {
      const targetOptExists = opts.some(o => o.letter === targetLetter);
      if (targetOptExists) {
        opts.forEach(o => { o.isCorrect = (o.letter === targetLetter); });
      }
    } else {
      const explicitOpts = opts.filter(o => o._explicit);
      if (explicitOpts.length === 1) {
        opts.forEach(o => { o.isCorrect = !!o._explicit; });
      } else {
        const boldOpts = opts.filter(o => o._bold);
        if (boldOpts.length === 1) {
          opts.forEach(o => { o.isCorrect = !!o._bold; });
        } else {
          const correctCandidates = opts.filter(o => o.isCorrect);
          if (correctCandidates.length === 0 && opts.length > 0) {
            opts[0].isCorrect = true;
          } else if (correctCandidates.length > 1) {
            const bestIdx = opts.findIndex(o => o._bold) !== -1
              ? opts.findIndex(o => o._bold)
              : opts.findIndex(o => o._explicit) !== -1
              ? opts.findIndex(o => o._explicit)
              : opts.findIndex(o => o.isCorrect);
            
            opts.forEach((o, idx) => {
              o.isCorrect = (idx === bestIdx);
            });
          }
        }
      }
    }

    opts.forEach(o => {
      delete o._explicit;
      delete o._bold;
      delete o._correctTag;
    });
    delete (qObj as any)._targetLetter;
  }

  return questions;
}

/**
 * Genera el componente HTML/CSS/JS del Cuestionario interactivo de opción múltiple
 * 100% compatible con ES5 para Moodle, con barajado de opciones en el DOM,
 * registro de intentos en localStorage, feedback pedagógico según intento (Regla 13),
 * cálculo automático de puntaje y tracking global de progreso.
 */
export function renderInteractiveQuizHtml(
  row: any,
  questions: QuizQuestion[],
  template: any,
  classId: string,
  isStandalone: boolean = false
): string {
  const primaryColor = template?.design?.primaryColor || '#00968F';
  const secondaryColor = template?.design?.secondaryColor || '#51ACC0';
  let headlineFont = template?.design?.headlineFont || 'Plus Jakarta Sans';
  let bodyFont = template?.design?.bodyFont || 'Manrope';

  if (template?.design?.styleManualPdf?.url || !template?.design?.headlineFont) {
    headlineFont = 'Bebas Neue';
    bodyFont = 'Roboto';
  }

  const cleanClassId = String(classId || row.id || '1').replace(/[^a-zA-Z0-9_-]/g, '');
  const quizKey = 'q_' + cleanClassId;
  const totalQ = questions.length;
  const rowId = row.id || '';
  const courseId = row.courseId || '';
  const materia = row.materia || 'Materia';
  const modulo = row.modulo || 'Cuestionario';

  let html = '';
  html += `<div class="cf-quiz-wrapper" id="cf-quiz-${quizKey}" style="font-family: '${bodyFont}', Arial, sans-serif; max-width: 900px; width: 100%; margin: 0 auto; padding: 0.5rem 0; box-sizing: border-box;">\n`;

  // Encabezado del Cuestionario
  html += `  <div style="background: linear-gradient(135deg, #002d2b 0%, #14263d 100%); padding: 1.75rem 2rem; border-radius: 12px; color: #ffffff; margin-bottom: 2rem; border-left: 5px solid ${primaryColor}; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">\n`;
  html += `    <p style="margin: 0 0 0.4rem 0; color: #00fff4; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-family: '${bodyFont}', sans-serif;">${materia} — CUESTIONARIO DE AUTOEVALUACIÓN</p>\n`;
  html += `    <h2 style="margin: 0 0 0.75rem 0; font-family: '${headlineFont}', sans-serif; font-size: 2.2rem; letter-spacing: 0.04em; color: #ffffff; text-transform: uppercase; line-height: 1.1;">${modulo}</h2>\n`;
  html += `    <p style="margin: 0; color: #e2e8f0; font-size: 0.95rem; line-height: 1.5; font-family: '${bodyFont}', sans-serif;">Responde las siguientes <strong>${totalQ} preguntas</strong> para poner a prueba tus conocimientos. Se requiere un <strong>70%</strong> de respuestas correctas para aprobar.</p>\n`;
  html += `    <div style="display: flex; gap: 12px; margin-top: 1rem; flex-wrap: wrap;">\n`;
  html += `      <span style="background: rgba(255,255,255,0.12); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">📝 ${totalQ} Preguntas</span>\n`;
  html += `      <span style="background: rgba(255,255,255,0.12); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">🎯 Mínimo 70%</span>\n`;
  html += `      <span style="background: rgba(255,255,255,0.12); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">🔄 Intentos Múltiples</span>\n`;
  html += `    </div>\n`;
  html += `  </div>\n\n`;

  // Banner de resultados (inicialmente oculto)
  html += `  <div id="cf-result-banner-${quizKey}" style="display: none; margin-bottom: 2rem; padding: 1.5rem 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transition: all 0.3s;"></div>\n\n`;

  // Tarjetas de preguntas
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    html += `  <div class="cf-quiz-card" id="cf-q-card-${quizKey}-${i}" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 5px rgba(0,0,0,0.02); transition: border-color 0.2s;">\n`;
    html += `    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">\n`;
    html += `      <span style="font-size: 0.8rem; font-weight: 700; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.05em;">Pregunta ${i + 1} de ${totalQ}</span>\n`;
    html += `    </div>\n`;
    html += `    <h4 style="margin: 0 0 1.25rem 0; font-size: 1.05rem; font-weight: 600; color: #1e293b; line-height: 1.5; font-family: '${bodyFont}', sans-serif;">${q.question}</h4>\n`;
    html += `    <div class="cf-options-container" id="cf-opts-${quizKey}-${i}" style="display: flex; flex-direction: column; gap: 0.65rem;">\n`;

    for (let j = 0; j < q.options.length; j++) {
      const opt = q.options[j];
      const optId = `cf-opt-${quizKey}-${i}-${j}`;
      html += `      <label class="cf-option-label" id="lbl-${optId}" data-correct="${opt.isCorrect ? 'true' : 'false'}" onclick="cfSelectOption(this, '${quizKey}', ${i})" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border: 1.5px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.15s; background: #ffffff; user-select: none;">\n`;
      html += `        <input type="radio" name="cf-radio-${quizKey}-${i}" value="${j}" data-correct="${opt.isCorrect ? 'true' : 'false'}" style="display: none !important;">\n`;
      html += `        <span class="cf-opt-letter" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: #f1f5f9; color: #475569; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; transition: all 0.15s;">${opt.letter}</span>\n`;
      html += `        <span class="cf-opt-text" style="font-size: 0.95rem; color: #334155; line-height: 1.45; flex-grow: 1; padding-top: 2px;">${opt.text}</span>\n`;
      html += `        <span class="cf-opt-status" style="display: none; margin-left: auto; font-size: 0.8rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;"></span>\n`;
      html += `      </label>\n`;
    }
    html += `    </div>\n`;
    if (q.justification) {
      html += `    <div class="cf-justification" id="cf-just-${quizKey}-${i}" style="display: none; margin-top: 1rem; padding: 12px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ${primaryColor}; border-radius: 8px; font-size: 0.95rem; color: #334155; line-height: 1.5;">\n`;
      html += `      <div style="font-weight: 700; color: ${primaryColor}; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">💡 Justificación</div>\n`;
      html += `      <div>${q.justification}</div>\n`;
      html += `    </div>\n`;
    }
    html += `  </div>\n\n`;
  }

  // Advertencia y Acciones
  html += `  <div id="cf-warning-${quizKey}" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.95rem; font-weight: 600; text-align: center;">⚠️ Aún tienes preguntas sin responder. Por favor selecciona una respuesta para cada una antes de enviar.</div>\n\n`;
  html += `  <div style="display: flex; gap: 1rem; align-items: center; justify-content: space-between; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; flex-wrap: wrap;">\n`;
  html += `    <button type="button" id="cf-submit-${quizKey}" onclick="cfSubmitQuiz('${quizKey}', ${totalQ}, '${materia.replace(/'/g, "\\'")}', '${modulo.replace(/'/g, "\\'")}', '${rowId}', '${courseId}')" style="background: ${primaryColor}; color: #ffffff; border: none; border-radius: 8px; padding: 14px 32px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); font-family: '${bodyFont}', sans-serif;">📤 Enviar Respuestas</button>\n`;
  html += `    <button type="button" id="cf-retry-${quizKey}" onclick="cfRetryQuiz('${quizKey}', ${totalQ})" style="display: none; background: ${secondaryColor}; color: #ffffff; border: none; border-radius: 8px; padding: 14px 32px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); font-family: '${bodyFont}', sans-serif;">🔄 Reintentar Cuestionario</button>\n`;
  html += `  </div>\n`;
  html += `</div>\n`;

  // Script interactivo compatible con ES5
  html += `
<script>
(function() {
  if (!window.cfSelectOption) {
    window.cfSelectOption = function(labelEl, quizKey, qIdx) {
      var parent = labelEl.parentElement;
      if (!parent) return;
      var wrapper = document.getElementById('cf-quiz-' + quizKey);
      if (wrapper && wrapper.getAttribute('data-submitted') === 'true') {
        return;
      }
      var labels = parent.querySelectorAll('.cf-option-label');
      for (var i = 0; i < labels.length; i++) {
        var lbl = labels[i];
        lbl.style.borderColor = '#e2e8f0';
        lbl.style.backgroundColor = '#ffffff';
        lbl.style.boxShadow = 'none';
        var inp = lbl.querySelector('input[type="radio"]');
        if (inp) inp.checked = false;
        var letter = lbl.querySelector('.cf-opt-letter');
        if (letter) {
          letter.style.backgroundColor = '#f1f5f9';
          letter.style.color = '#475569';
        }
      }
      labelEl.style.borderColor = '${primaryColor}';
      labelEl.style.backgroundColor = '#f0fdfa';
      labelEl.style.boxShadow = '0 0 0 1px ${primaryColor}';
      var thisInp = labelEl.querySelector('input[type="radio"]');
      if (thisInp) thisInp.checked = true;
      var thisLetter = labelEl.querySelector('.cf-opt-letter');
      if (thisLetter) {
        thisLetter.style.backgroundColor = '${primaryColor}';
        thisLetter.style.color = '#ffffff';
      }
      var warnEl = document.getElementById('cf-warning-' + quizKey);
      if (warnEl) warnEl.style.display = 'none';
    };

    window.cfShuffleOptions = function(quizKey, totalQ) {
      for (var i = 0; i < totalQ; i++) {
        var container = document.getElementById('cf-opts-' + quizKey + '-' + i);
        if (!container) continue;
        var items = container.children;
        var arr = Array.prototype.slice.call(items);
        for (var j = arr.length - 1; j > 0; j--) {
          var k = Math.floor(Math.random() * (j + 1));
          var temp = arr[j];
          arr[j] = arr[k];
          arr[k] = temp;
        }
        for (var m = 0; m < arr.length; m++) {
          container.appendChild(arr[m]);
          var letterSpan = arr[m].querySelector('.cf-opt-letter');
          if (letterSpan) {
            letterSpan.innerText = String.fromCharCode(65 + m);
          }
        }
      }
    };

    window.cfSubmitQuiz = function(quizKey, totalQ, materia, modulo, rowId, courseId) {
      var wrapper = document.getElementById('cf-quiz-' + quizKey);
      var answered = 0;
      var unansweredIndex = -1;
      for (var i = 0; i < totalQ; i++) {
        var checkedInp = document.querySelector('input[name="cf-radio-' + quizKey + '-' + i + '"]:checked');
        if (checkedInp) {
          answered++;
        } else if (unansweredIndex === -1) {
          unansweredIndex = i;
        }
      }
      var warnEl = document.getElementById('cf-warning-' + quizKey);
      if (answered < totalQ) {
        if (warnEl) {
          warnEl.style.display = 'block';
          warnEl.innerHTML = '⚠️ Aún te faltan responder <strong>' + (totalQ - answered) + '</strong> preguntas. Por favor complétalas antes de enviar.';
        }
        var firstUnanswered = document.getElementById('cf-q-card-' + quizKey + '-' + unansweredIndex);
        if (firstUnanswered && firstUnanswered.scrollIntoView) {
          firstUnanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      if (warnEl) warnEl.style.display = 'none';

      if (wrapper) wrapper.setAttribute('data-submitted', 'true');

      var correctCount = 0;
      for (var i = 0; i < totalQ; i++) {
        var checkedInp = document.querySelector('input[name="cf-radio-' + quizKey + '-' + i + '"]:checked');
        var isCorrect = checkedInp && checkedInp.getAttribute('data-correct') === 'true';
        if (isCorrect) {
          correctCount++;
        }
      }

      var percentage = Math.round((correctCount / totalQ) * 100);
      var passed = percentage >= 70;

      var storageKey = 'cf_quiz_attempt_' + quizKey;
      var attemptNum = 1;
      try {
        var stored = localStorage.getItem(storageKey);
        if (stored) attemptNum = parseInt(stored, 10) + 1;
        localStorage.setItem(storageKey, attemptNum);
      } catch(e) {}

      var bannerEl = document.getElementById('cf-result-banner-' + quizKey);
      if (bannerEl) {
        bannerEl.style.display = 'block';
        if (passed) {
          bannerEl.style.backgroundColor = '#ecfdf5';
          bannerEl.style.border = '2px solid #10b981';
          bannerEl.style.color = '#065f46';
          bannerEl.innerHTML = '<div style="display: flex; align-items: center; gap: 16px;">' +
            '<div style="font-size: 2.5rem;">🎉</div>' +
            '<div>' +
              '<h3 style="margin: 0 0 4px 0; font-size: 1.4rem; color: #047857; font-weight: 700;">¡Felicitaciones! Cuestionario Aprobado</h3>' +
              '<p style="margin: 0; font-size: 1rem; color: #065f46;">Obtuviste <strong>' + correctCount + ' de ' + totalQ + '</strong> respuestas correctas (<strong>' + percentage + '%</strong>). Has superado el mínimo del 70% requerido.</p>' +
            '</div>' +
          '</div>';
        } else if (attemptNum < 4) {
          bannerEl.style.backgroundColor = '#fffbeb';
          bannerEl.style.border = '2px solid #f59e0b';
          bannerEl.style.color = '#92400e';
          bannerEl.innerHTML = '<div style="display: flex; align-items: center; gap: 16px;">' +
            '<div style="font-size: 2.5rem;">✍️</div>' +
            '<div>' +
              '<h3 style="margin: 0 0 4px 0; font-size: 1.4rem; color: #b45309; font-weight: 700;">Cuestionario No Aprobado</h3>' +
              '<p style="margin: 0; font-size: 1rem; color: #92400e;">Obtuviste <strong>' + correctCount + ' de ' + totalQ + '</strong> respuestas correctas (<strong>' + percentage + '%</strong>). Se requiere al menos un <strong>70%</strong> para aprobar.</p>' +
              '<p style="margin: 6px 0 0 0; font-size: 0.9rem; color: #b45309; font-style: italic;">Intento ' + attemptNum + ' de 3 antes de la revelación de respuestas. Repasa los conceptos de la clase e inténtalo nuevamente.</p>' +
            '</div>' +
          '</div>';
        } else {
          bannerEl.style.backgroundColor = '#fef2f2';
          bannerEl.style.border = '2px solid #ef4444';
          bannerEl.style.color = '#991b1b';
          bannerEl.innerHTML = '<div style="display: flex; align-items: center; gap: 16px;">' +
            '<div style="font-size: 2.5rem;">ℹ️</div>' +
            '<div>' +
              '<h3 style="margin: 0 0 4px 0; font-size: 1.4rem; color: #b91c1c; font-weight: 700;">Revisión de Respuestas (Intento ' + attemptNum + ')</h3>' +
              '<p style="margin: 0; font-size: 1rem; color: #991b1b;">Obtuviste <strong>' + correctCount + ' de ' + totalQ + '</strong> respuestas correctas (<strong>' + percentage + '%</strong>). A continuación puedes revisar en verde las respuestas correctas de cada pregunta para reforzar tu aprendizaje.</p>' +
            '</div>' +
          '</div>';
        }
        if (bannerEl.scrollIntoView) {
          bannerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      for (var i = 0; i < totalQ; i++) {
        var justEl = document.getElementById('cf-just-' + quizKey + '-' + i);
        if (justEl && (passed || attemptNum >= 4)) {
          justEl.style.display = 'block';
        }

        var container = document.getElementById('cf-opts-' + quizKey + '-' + i);
        if (!container) continue;
        var labels = container.querySelectorAll('.cf-option-label');
        for (var k = 0; k < labels.length; k++) {
          var lbl = labels[k];
          var isOptCorrect = lbl.getAttribute('data-correct') === 'true';
          var inp = lbl.querySelector('input[type="radio"]');
          var isChecked = inp && inp.checked;
          var statusSpan = lbl.querySelector('.cf-opt-status');

          if (passed || attemptNum >= 4) {
            if (isOptCorrect) {
              lbl.style.borderColor = '#10b981';
              lbl.style.backgroundColor = '#ecfdf5';
              if (statusSpan) {
                statusSpan.style.display = 'inline-block';
                statusSpan.style.backgroundColor = '#10b981';
                statusSpan.style.color = '#ffffff';
                statusSpan.innerText = 'Correcta ✓';
              }
            } else if (isChecked && !isOptCorrect) {
              lbl.style.borderColor = '#ef4444';
              lbl.style.backgroundColor = '#fef2f2';
              if (statusSpan) {
                statusSpan.style.display = 'inline-block';
                statusSpan.style.backgroundColor = '#ef4444';
                statusSpan.style.color = '#ffffff';
                statusSpan.innerText = 'Incorrecta ✗';
              }
            }
          } else {
            if (statusSpan) statusSpan.style.display = 'none';
          }
        }
      }

      var submitBtn = document.getElementById('cf-submit-' + quizKey);
      var retryBtn = document.getElementById('cf-retry-' + quizKey);
      if (submitBtn) submitBtn.style.display = 'none';
      if (retryBtn) retryBtn.style.display = 'inline-block';

      try {
        if (window.CourseFactory && typeof window.CourseFactory.recordEvent === 'function') {
          window.CourseFactory.recordEvent('quiz_submit', percentage, correctCount, totalQ);
        } else {
          fetch('/api/reports/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              licencia: 'Licencia',
              materia: materia || 'Materia',
              modulo: modulo || 'Modulo',
              accion: 'quiz_submit',
              score: percentage,
              correctAnswers: correctCount,
              totalQuestions: totalQ,
              rowId: rowId || '',
              courseId: courseId || ''
            })
          });
        }
      } catch(e) {}
    };

    window.cfRetryQuiz = function(quizKey, totalQ) {
      var wrapper = document.getElementById('cf-quiz-' + quizKey);
      if (wrapper) wrapper.removeAttribute('data-submitted');

      for (var i = 0; i < totalQ; i++) {
        var justEl = document.getElementById('cf-just-' + quizKey + '-' + i);
        if (justEl) justEl.style.display = 'none';

        var container = document.getElementById('cf-opts-' + quizKey + '-' + i);
        if (!container) continue;
        var labels = container.querySelectorAll('.cf-option-label');
        for (var k = 0; k < labels.length; k++) {
          var lbl = labels[k];
          lbl.style.borderColor = '#e2e8f0';
          lbl.style.backgroundColor = '#ffffff';
          lbl.style.boxShadow = 'none';
          var inp = lbl.querySelector('input[type="radio"]');
          if (inp) inp.checked = false;
          var letter = lbl.querySelector('.cf-opt-letter');
          if (letter) {
            letter.style.backgroundColor = '#f1f5f9';
            letter.style.color = '#475569';
          }
          var statusSpan = lbl.querySelector('.cf-opt-status');
          if (statusSpan) statusSpan.style.display = 'none';
        }
      }

      cfShuffleOptions(quizKey, totalQ);

      var bannerEl = document.getElementById('cf-result-banner-' + quizKey);
      if (bannerEl) bannerEl.style.display = 'none';
      var warnEl = document.getElementById('cf-warning-' + quizKey);
      if (warnEl) warnEl.style.display = 'none';

      var submitBtn = document.getElementById('cf-submit-' + quizKey);
      var retryBtn = document.getElementById('cf-retry-' + quizKey);
      if (submitBtn) submitBtn.style.display = 'inline-block';
      if (retryBtn) retryBtn.style.display = 'none';

      if (wrapper && wrapper.scrollIntoView) {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  }

  try {
    window.cfShuffleOptions('${quizKey}', ${totalQ});
  } catch(e) {}
})();
</script>`;

  return html;
}

/**
 * Genera un visor interactivo de PDF con navegación horizontal página a página (flipbook/slider),
 * contador de páginas (Página X de Y), botones de navegación, descarga de PDF y fallback a Google Docs.
 */
export function renderHorizontalPdfViewerHtml(
  row: any,
  template: any,
  classId: string
): string {
  const primaryColor = template?.design?.primaryColor || '#00968F';
  let headlineFont = template?.design?.headlineFont || 'Plus Jakarta Sans';
  let bodyFont = template?.design?.bodyFont || 'Manrope';

  if (template?.design?.styleManualPdf?.url || !template?.design?.headlineFont) {
    headlineFont = 'Bebas Neue';
    bodyFont = 'Roboto';
  }

  let pdfUrl = row.links || row.fileUrl || '';
  const baseUrl = process.env.FRONTEND_URL || 'https://cf.maradonamenotti.cloud';
  if (pdfUrl) {
    if (pdfUrl.startsWith('/')) {
      pdfUrl = baseUrl + pdfUrl;
    } else if (!pdfUrl.startsWith('http://') && !pdfUrl.startsWith('https://')) {
      pdfUrl = baseUrl + '/api/files/download/' + encodeURIComponent(pdfUrl);
    }
  }

  const pdfTitle = row.descripcion || row.fileName || 'Documento PDF';
  const cleanId = 'pdf_' + String(row.id || classId || '1').replace(/[^a-zA-Z0-9_-]/g, '');
  const downloadUrl = pdfUrl.includes('?') ? `${pdfUrl}&download=1` : `${pdfUrl}?download=1`;

  let html = '';
  html += `<div class="cf-pdf-viewer-wrapper" id="cf-pdf-wrap-${cleanId}" style="font-family: '${bodyFont}', Arial, sans-serif; max-width: 950px; width: 100%; margin: 0 auto 2rem auto; box-sizing: border-box;">\n`;

  // Barra Superior de Control
  html += `  <div style="background: linear-gradient(135deg, #002d2b 0%, #14263d 100%); padding: 1rem 1.5rem; border-radius: 12px 12px 0 0; color: #ffffff; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border-left: 5px solid ${primaryColor};">\n`;
  html += `    <div style="display: flex; align-items: center; gap: 10px; min-width: 200px;">\n`;
  html += `      <span style="font-size: 1.4rem;">📄</span>\n`;
  html += `      <h4 style="margin: 0; font-family: '${headlineFont}', sans-serif; font-size: 1.1rem; color: #ffffff; text-transform: uppercase; letter-spacing: 0.03em;">${pdfTitle}</h4>\n`;
  html += `    </div>\n`;

  html += `    <div style="display: flex; align-items: center; gap: 10px;">\n`;
  if (pdfUrl) {
    html += `      <a href="${pdfUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.18); color: #ffffff; text-decoration: none; padding: 7px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; border: 1px solid rgba(255,255,255,0.3); transition: all 0.2s;">↗️ Ver Pantalla Completa</a>\n`;
    html += `      <a href="${downloadUrl}" target="_blank" download style="display: inline-flex; align-items: center; gap: 6px; background: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 7px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; transition: all 0.2s;">📥 Descargar PDF</a>\n`;
  }
  html += `    </div>\n`;
  html += `  </div>\n\n`;

  // Visor Nativo Nivel Producción
  html += `  <div style="background: #1e293b; border-radius: 0 0 12px 12px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.15);">\n`;
  if (pdfUrl.includes('drive.google.com')) {
    const drivePreview = pdfUrl.replace(/\/view(\?.*)?$/, '/preview');
    html += `    <iframe src="${drivePreview}" class="cf-pdf-iframe" width="100%" height="650px" style="border: none; border-radius: 0 0 12px 12px; display: block;" allow="autoplay"></iframe>\n`;
  } else {
    html += `    <iframe src="${pdfUrl}" class="cf-pdf-iframe" width="100%" height="650px" style="border: none; border-radius: 0 0 12px 12px; display: block;"></iframe>\n`;
  }
  html += `  </div>\n`;

  html += `</div>\n`;
  return html;
}

function formatMeetDate(dt: string | null): string {
  if (!dt) return '';
  try {
    const parts = dt.split('T');
    const dateParts = parts[0].split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    const formattedTime = parts[1] || '';
    return `${formattedDate} ${formattedTime ? formattedTime + ' hs' : ''}`.trim();
  } catch (e) {
    return dt || '';
  }
}

/**
 * Ensambla de forma determinista y programática el HTML completo y paginado de una clase,
 * garantizando el 100% de preservación del texto, compatibilidad con Moodle,
 * lightboxes en imágenes, reproductores responsivos y detención de medios al cambiar de página.
 */
export function assembleClassHtml(moduleName: string, rows: any[], template: any, nro?: string): string {
  const primaryColor = template?.design?.primaryColor || '#00968F';
  const secondaryColor = template?.design?.secondaryColor || '#51ACC0';
  const backgroundColor = template?.design?.backgroundColor || '#F9FAFB';
  const surfaceColor = template?.design?.surfaceColor || '#FFFFFF';
  const textColor = template?.design?.textColor || '#111827';

  let headlineFont = template?.design?.headlineFont || 'Plus Jakarta Sans';
  let bodyFont = template?.design?.bodyFont || 'Manrope';

  if (template?.design?.styleManualPdf?.url || !template?.design?.headlineFont) {
    headlineFont = 'Bebas Neue';
    bodyFont = 'Roboto';
  }

  const count = rows.length;
  const classId = nro || rows[0]?.nro || rows[0]?.moduloNumero || (rows[0]?.sortOrder !== undefined ? String(rows[0].sortOrder + 1) : '1');

  let radioInputs = '';
  let pageStyleRules = '';
  let progressBarRules = '';

  if (count >= 2) {
    radioInputs = rows.map((_, i) =>
      `<input type="radio" id="step-radio-${i + 1}-${classId}" name="class-steps-${classId}" ${i === 0 ? 'checked' : ''} style="display: none !important;">`
    ).join('\n');

    pageStyleRules = rows.map((_, i) =>
      `#step-radio-${i + 1}-${classId}:checked ~ .class-page-${i + 1}-${classId},
#step-radio-${i + 1}-${classId}:checked ~ .lang-content-${classId} .class-page-${i + 1}-${classId},
#step-radio-${i + 1}-${classId}:checked ~ .lang-content-es-${classId} .class-page-${i + 1}-${classId},
#step-radio-${i + 1}-${classId}:checked ~ .lang-content-pt-${classId} .class-page-${i + 1}-${classId},
#step-radio-${i + 1}-${classId}:checked ~ .lang-content-en-${classId} .class-page-${i + 1}-${classId} { display: block !important; }`
    ).join('\n');

    progressBarRules = rows.map((_, i) =>
      `#step-radio-${i + 1}-${classId}:checked ~ .progress-bar-container-${classId} .progress-bar-fill-${classId},
#step-radio-${i + 1}-${classId}:checked ~ .lang-content-${classId} .progress-bar-container-${classId} .progress-bar-fill-${classId},
#step-radio-${i + 1}-${classId}:checked ~ .lang-content-es-${classId} .progress-bar-container-${classId} .progress-bar-fill-${classId},
#step-radio-${i + 1}-${classId}:checked ~ .lang-content-pt-${classId} .progress-bar-container-${classId} .progress-bar-fill-${classId},
#step-radio-${i + 1}-${classId}:checked ~ .lang-content-en-${classId} .progress-bar-container-${classId} .progress-bar-fill-${classId} { width: ${((i + 1) / count) * 100}%; }`
    ).join('\n');
  }

  const pagesHtml = rows.map((r, idx) => {
    const x = idx + 1;
    const isFirst = x === 1;
    const isLast = x === count;

    let contentHtml = '';
    const fmt = (r.formato || '').toUpperCase();

    if (fmt === 'VIDEO') {
      const vUrl = r.videoVimeo || r.videoDrive || r.links || r.htmlContent || '';
      contentHtml = `<div class="block-video" style="max-width: 100%; width: 100%; margin-bottom: 2rem;">` +
        embedVimeoAndVideoLinks(vUrl) +
      `</div>`;
    } else if (fmt === 'GENIALLY' && (r.geniallyUrl || r.links)) {
      const gUrl = r.geniallyUrl || r.links || '';
      contentHtml = `<div class="block-genially" style="max-width: 100%; width: 100%; margin-bottom: 2rem;">` +
        `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000;margin:1.5rem 0;">` +
          `<iframe src="${gUrl}" loading="lazy" width="100%" height="100%" frameborder="0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` +
        `</div>` +
      `</div>`;
    } else if (fmt === 'PDF' || (r.fileType && r.fileType.includes('pdf')) || (r.links && r.links.toLowerCase().includes('.pdf'))) {
      contentHtml = renderHorizontalPdfViewerHtml(r, template, classId);
    } else if (fmt === 'CUESTIONARIO' || fmt === 'QUIZ') {
      const docxContent = r.htmlContent || r.descripcion || '';
      const questions = parseDocxQuizQuestions(docxContent);
      if (questions.length > 0) {
        contentHtml = renderInteractiveQuizHtml(r, questions, template, classId, false);
      } else if (r.htmlContent && r.htmlContent.trim().length > 0) {
        let raw = docxContent;
        raw = embedVimeoAndVideoLinks(raw);
        const descHeader = r.descripcion && count > 1
          ? `<h3 style="font-family: '${headlineFont}', sans-serif; font-size: 1.5rem; font-weight: 700; color: ${primaryColor}; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.6rem; margin-top: 0.5rem; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.03em;">${r.descripcion}</h3>`
          : '';
        contentHtml = `<div class="block-text" style="max-width: 100%; width: 100%; box-sizing: border-box;">` +
          descHeader +
          raw +
        `</div>`;
      } else {
        contentHtml = `<div class="block-cuestionario-empty" style="max-width: 900px; width: 100%; margin: 2rem auto; padding: 2.5rem 2rem; background: #1e293b; border-radius: 12px; border-left: 5px solid ${primaryColor}; color: #ffffff; text-align: center; font-family: '${bodyFont}', sans-serif; box-shadow: 0 8px 25px rgba(0,0,0,0.15);">` +
          `<div style="font-size: 2.5rem; margin-bottom: 0.8rem;">📝</div>` +
          `<h4 style="margin: 0 0 0.6rem 0; font-family: '${headlineFont}', sans-serif; font-size: 1.3rem; text-transform: uppercase; letter-spacing: 0.03em; color: #ffffff;">${r.descripcion || 'Cuestionario'}</h4>` +
          `<p style="margin: 0 0 1.2rem 0; color: #94a3b8; font-size: 0.95rem; line-height: 1.6; max-width: 600px; margin-left: auto; margin-right: auto;">Este cuestionario aún no tiene las preguntas procesadas. Por favor vuelva a subir el archivo <strong>.docx</strong> del cuestionario desde el <strong>Panel 1 (Contenido)</strong> usando el botón de subir (📤) para activar la trivia interactiva.</p>` +
          (r.links ? `<a href="${r.links}" target="_blank" download style="display: inline-flex; align-items: center; gap: 6px; background: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 8px 18px; border-radius: 6px; font-size: 0.85rem; font-weight: 700;">📥 Descargar archivo Word subido</a>` : '') +
        `</div>`;
      }
    } else if (fmt === 'MEET') {
      const vUrl = r.videoVimeo || (r.videoDrive && !r.videoDrive.includes('meet.google.com') ? r.videoDrive : '') || '';
      const hasRecording = Boolean(vUrl && vUrl.trim().length > 0);
      const meetDateFormatted = r.meetDateTime ? formatMeetDate(r.meetDateTime) : (r.fechaDisponibilidad ? `Fecha: ${r.fechaDisponibilidad}` : '');

      if (hasRecording) {
        contentHtml = `<div class="block-video block-meet-recording" style="max-width: 100%; width: 100%; margin-bottom: 2rem; font-family: '${bodyFont}', sans-serif;">` +
          `<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: rgba(0, 150, 143, 0.08); border-left: 4px solid ${primaryColor}; padding: 12px 18px; border-radius: 8px; margin-bottom: 1.5rem;">` +
            `<div style="display: flex; align-items: center; gap: 10px;">` +
              `<span style="background: #10b981; color: #ffffff; font-size: 0.72rem; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Grabación de la clase</span>` +
              `<span style="font-family: '${headlineFont}', sans-serif; font-weight: 700; font-size: 1.05rem; color: ${textColor};">${r.descripcion || 'Encuentro en vivo'}</span>` +
            `</div>` +
            (meetDateFormatted ? `<span style="font-size: 0.88rem; color: #64748b; font-weight: 600;">📅 ${meetDateFormatted}</span>` : '') +
          `</div>` +
          embedVimeoAndVideoLinks(vUrl) +
          (r.meetDescripcion ? `<p style="font-family: '${bodyFont}', sans-serif; color: ${textColor}; line-height: 1.6; margin-top: 1rem; font-size: 0.95rem;">${r.meetDescripcion}</p>` : '') +
        `</div>`;
      } else {
        const meetUrl = r.meetLink || r.links || '#';
        contentHtml = `<div class="block-meet-card" style="max-width: 800px; width: 100%; margin: 2rem auto; background: ${surfaceColor}; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); overflow: hidden; font-family: '${bodyFont}', sans-serif;">` +
          `<div style="background: linear-gradient(135deg, ${primaryColor} 0%, #004D40 100%); padding: 2.5rem 2rem; color: #ffffff; text-align: center;">` +
            `<div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: rgba(255, 255, 255, 0.15); border-radius: 50%; margin-bottom: 1.2rem; backdrop-filter: blur(4px);">` +
              `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>` +
            `</div>` +
            `<div style="display: inline-block; background: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 0.75rem; font-weight: 700; padding: 4px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.8rem;">` +
              `Videoconferencia en Vivo • Google Meet` +
            `</div>` +
            `<h2 style="font-family: '${headlineFont}', sans-serif; font-size: 1.8rem; margin: 0 0 0.5rem 0; font-weight: 700; color: #ffffff;">` +
              `${r.descripcion || 'Encuentro en Vivo'}` +
            `</h2>` +
            (r.modulo ? `<p style="margin: 0; opacity: 0.9; font-size: 0.95rem;">${r.modulo}</p>` : '') +
          `</div>` +
          `<div style="padding: 2.2rem; text-align: center;">` +
            (meetDateFormatted ? `<div style="display: inline-flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 12px; margin-bottom: 1.8rem;"><span style="font-size: 1.2rem;">📅</span><span style="font-size: 1.05rem; font-weight: 700; color: #1e293b;">${meetDateFormatted}</span></div>` : '') +
            (r.meetDescripcion ? `<p style="color: #475569; font-size: 0.95rem; line-height: 1.6; margin: 0 auto 1.8rem auto; max-width: 550px;">${r.meetDescripcion}</p>` : '') +
            `<div style="margin-bottom: 1.5rem;">` +
              `<a href="${meetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; justify-content: center; gap: 10px; background: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 1.05rem; box-shadow: 0 4px 14px rgba(0, 150, 143, 0.35); transition: all 0.2s ease;">` +
                `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>` +
                `Unirse a la Conferencia (Google Meet)` +
              `</a>` +
            `</div>` +
            `<div style="display: flex; align-items: center; justify-content: center; gap: 6px; color: #94a3b8; font-size: 0.82rem; max-width: 520px; margin: 0 auto;">` +
              `<span>💡 Recordá ingresar unos minutos antes del inicio de la sesión. Una vez finalizado el vivo, la grabación estará disponible en este mismo espacio.</span>` +
            `</div>` +
          `</div>` +
        `</div>`;
      }
    } else {
      let raw = r.htmlContent || r.descripcion || '';
      raw = raw
        .replace(/<p>\s*<strong>\s*Metodolog[ií]a\s+de\s+la\s+enseñanza(?:\s+II)?\s*<\/strong>\s*<\/p>/gi, '')
        .replace(/<p>\s*<strong>\s*PROCESOS\s+DE\s+(?:<br\s*\/?>\s*)?ENSEÑANZA\s*[–\-]\s*APRENDIZAJE[\s\S]*?<\/strong>\s*<\/p>/gi, '');

      const hasEmbeddedVideosInBody = Boolean(
        raw.includes('vimeo.com') ||
        raw.includes('mediadelivery.net') ||
        raw.includes('videos.maradonamenotti.cloud')
      );

      raw = embedVimeoAndVideoLinks(raw);

      const topVideo = (r.videoVimeo && !hasEmbeddedVideosInBody)
        ? `<div class="block-video" style="max-width: 100%; width: 100%; margin-bottom: 2rem;">` +
            embedVimeoAndVideoLinks(r.videoVimeo) +
          `</div>`
        : '';

      const baseUrl = process.env.FRONTEND_URL || 'https://cf.maradonamenotti.cloud';
      raw = raw.replace(/(["'])\/api\/files\/download\//gi, `$1${baseUrl}/api/files/download/`);

      raw = raw.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (m: string, before: string, src: string, after: string) => {
        const absoluteSrc = src.startsWith('/') ? `${baseUrl}${src}` : src;
        const cleanBefore = before.replace(/\s*\/\s*$/, '').trim();
        const cleanAfter = after.replace(/^\s*\/\s*/, '').replace(/\s*\/\s*$/, '').trim();
        const prefix = cleanBefore ? `${cleanBefore} ` : '';
        const suffix = cleanAfter ? ` ${cleanAfter}` : '';
        return `<img ${prefix}src="${absoluteSrc}"${suffix} onclick="cfZoom(this.src)" style="cursor:zoom-in;max-width:100%;height:auto;border-radius:8px;display:block;margin:1.5rem auto;box-shadow:0 4px 15px rgba(0,0,0,0.08);" loading="eager">`;
      });

      const descHeader = r.descripcion && count > 1
        ? `<h3 style="font-family: '${headlineFont}', sans-serif; font-size: 1.5rem; font-weight: 700; color: ${primaryColor}; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.6rem; margin-top: 0.5rem; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.03em;">${r.descripcion}</h3>`
        : '';

      contentHtml = `<div class="block-text" style="max-width: 100%; width: 100%; box-sizing: border-box;">` +
        descHeader +
        topVideo +
        raw +
      `</div>`;
    }

    const nextLabelFor = `step-radio-${x + 1}-${classId}`;
    const prevLabelFor = `step-radio-${x - 1}-${classId}`;

    const backButtonHtml = !isFirst
      ? `<label for="${prevLabelFor}" class="nav-btn-${classId} nav-btn-prev-${classId}" style="display: inline-block; padding: 10px 24px; background-color: ${secondaryColor}; color: #ffffff; border-radius: 8px; font-family: '${headlineFont}', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; user-select: none; margin-right: 8px;">Volver</label>`
      : `<span style="display: inline-block; width: 1px; height: 1px;"></span>`;

    const nextButtonHtml = !isLast
      ? `<label for="${nextLabelFor}" class="nav-btn-${classId} nav-btn-next-${classId}" style="display: inline-block; padding: 10px 24px; background-color: ${primaryColor}; color: #ffffff; border-radius: 8px; font-family: '${headlineFont}', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; user-select: none;">Continuar</label>`
      : `<label class="nav-btn-${classId} nav-btn-finish-${classId}" style="display: inline-block; padding: 10px 24px; background-color: #10b981; color: #ffffff; border-radius: 8px; font-family: '${headlineFont}', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; user-select: none;">Fin de la clase</label>`;

    const buttonsHtml = `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 24px;">` +
      `<div style="text-align: left;">${backButtonHtml}</div>` +
      `<div style="text-align: right;">${nextButtonHtml}</div>` +
    `</div>`;

    if (count >= 2) {
      return `<div class="class-page-${classId} class-page-${x}-${classId}" style="display: ${isFirst ? 'block' : 'none'};">` +
        contentHtml +
        buttonsHtml +
      `</div>`;
    } else {
      return `<div>` + contentHtml + buttonsHtml + `</div>`;
    }
  }).join('\n');

  const progressBar = count >= 2 ? (
    `<div class="progress-bar-container-${classId}" style="position: sticky; top: 0; left: 0; width: 100%; background-color: ${backgroundColor}EE; backdrop-filter: blur(8px); height: 8px; z-index: 1000; margin-bottom: 24px; border-radius: 0 0 4px 4px; border-bottom: 1px solid rgba(0,0,0,0.04);">` +
      `<div class="progress-bar-fill-${classId}" style="height: 100%; background-color: ${primaryColor}; width: ${(1 / count) * 100}%; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 4px;"></div>` +
    `</div>`
  ) : '';

  const mediaStopScript = `
<script>
(function() {
  function stopMediaInContainer(el) {
    if (!el) return;
    try {
      var media = el.querySelectorAll('video, audio');
      for (var m = 0; m < media.length; m++) {
        try { media[m].pause(); } catch(e) {}
      }
      var iframes = el.querySelectorAll('iframe');
      for (var f = 0; f < iframes.length; f++) {
        var ifr = iframes[f];
        if (ifr.className && ifr.className.indexOf('cf-pdf-iframe') !== -1) continue;
        try {
          ifr.contentWindow.postMessage('{"method":"pause"}', '*');
          ifr.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
          ifr.contentWindow.postMessage('pause', '*');
        } catch(e) {}
        try {
          var currentSrc = ifr.getAttribute('src');
          if (currentSrc && currentSrc !== 'about:blank') {
            ifr.setAttribute('data-original-src', currentSrc);
            ifr.src = 'about:blank';
          }
        } catch(e) {}
      }
    } catch(e) {}
  }

  function restoreMediaInContainer(el) {
    if (!el) return;
    try {
      var iframes = el.querySelectorAll('iframe');
      for (var f = 0; f < iframes.length; f++) {
        var ifr = iframes[f];
        if (ifr.className && ifr.className.indexOf('cf-pdf-iframe') !== -1) continue;
        var orig = ifr.getAttribute('data-original-src');
        if (orig && (!ifr.src || ifr.src === 'about:blank' || ifr.src !== orig)) {
          ifr.src = orig;
        }
      }
    } catch(e) {}
  }

  function switchStep(nextStep, container, isInitial) {
    if (!container) container = document;
    var allPages = container.querySelectorAll('[class*="class-page-"]');
    var maxStep = 0;
    for (var i = 0; i < allPages.length; i++) {
      var pEl = allPages[i];
      var pMatch = pEl.className.match(/class-page-([0-9]+)-/);
      if (pMatch) {
        var pNum = parseInt(pMatch[1], 10);
        if (pNum > maxStep) maxStep = pNum;
        if (pNum === nextStep) {
          restoreMediaInContainer(pEl);
          pEl.style.setProperty('display', 'block', 'important');
        } else {
          stopMediaInContainer(pEl);
          pEl.style.setProperty('display', 'none', 'important');
        }
      }
    }
    var fill = container.querySelector('.progress-bar-fill-${classId}') || container.querySelector('[class*="progress-bar-fill-"]');
    if (fill && maxStep > 0) {
      fill.style.width = ((nextStep / maxStep) * 100) + '%';
    }
    if (!isInitial) {
      try {
        var rect = container.getBoundingClientRect();
        if (rect.top < 0 || rect.top > 150) {
          container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch(e) {}
    }
  }

  document.addEventListener('change', function(e) {
    var target = e.target;
    if (target && target.type === 'radio' && target.id && target.id.indexOf('step-radio-') === 0) {
      var match = target.id.match(/^step-radio-([0-9]+)-(.*)$/);
      if (match) {
        var currentStep = parseInt(match[1], 10);
        var container = target.closest('.coursefactory-content') || document;
        switchStep(currentStep, container, false);
      }
    }
  });

  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target !== document.body) {
      var forAttr = target.getAttribute && target.getAttribute('for');
      if (forAttr && forAttr.indexOf('step-radio-') === 0) {
        var match = forAttr.match(/^step-radio-([0-9]+)-(.*)$/);
        if (match) {
          var nextStep = parseInt(match[1], 10);
          var container = target.closest('.coursefactory-content') || document;
          switchStep(nextStep, container, false);
        }
        break;
      }
      target = target.parentElement;
    }
  });

  try {
    var initialRadio = document.querySelector('input[type="radio"][id^="step-radio-"]:checked') ||
                       document.querySelector('input[type="radio"][id^="step-radio-"]');
    if (initialRadio) {
      var mInit = initialRadio.id.match(/^step-radio-([0-9]+)-(.*)$/);
      if (mInit) {
        var initStep = parseInt(mInit[1], 10);
        var initContainer = initialRadio.closest('.coursefactory-content') || document;
        switchStep(initStep, initContainer, true);
      }
    }
  } catch(e) {}
})();
</script>`;

  const lightboxHtml = `
<div id="cf-lightbox" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;">
  <img id="cf-lightbox-img" src="" style="max-width:95%;max-height:95vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.8);" alt="Vista ampliada">
</div>
<script>
(function() {
  var lb = document.getElementById('cf-lightbox');
  if (!lb) return;
  lb.addEventListener('click', function() { lb.style.display = 'none'; });
})();
function cfZoom(src) {
  var lb = document.getElementById('cf-lightbox');
  var img = document.getElementById('cf-lightbox-img');
  if (lb && img) { img.src = src; lb.style.display = 'flex'; }
}
</script>`;

  const fontScript = getGoogleFontsScript(headlineFont, bodyFont);

  return '<div class="coursefactory-content class-container-' + classId + '" style="background-color: ' + backgroundColor + '; color: ' + textColor + '; font-family: \'' + bodyFont + '\', sans-serif; padding: 0; border-radius: 16px; overflow: hidden;">\n' +
    '<style>\n' +
      '@import url(\'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto:wght@400;500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap\');\n' +
      ':root {\n' +
        '--theme-primary: ' + primaryColor + ';\n' +
        '--theme-secondary: ' + secondaryColor + ';\n' +
        '--theme-background: ' + backgroundColor + ';\n' +
        '--theme-surface: ' + surfaceColor + ';\n' +
        '--theme-text: ' + textColor + ';\n' +
        '--font-headline: \'' + headlineFont + '\', sans-serif;\n' +
        '--font-body: \'' + bodyFont + '\', sans-serif;\n' +
      '}\n' +
      '.class-container-' + classId + ' .block-text {\n' +
        'margin-bottom: 2rem;\n' +
        'padding: 1.5rem;\n' +
        'background: var(--theme-surface);\n' +
        'border-radius: 16px;\n' +
        'border-left: 5px solid var(--theme-primary);\n' +
        'box-shadow: 0 4px 20px rgba(0,0,0,0.04);\n' +
      '}\n' +
      '.class-container-' + classId + ' h1, .class-container-' + classId + ' h2, .class-container-' + classId + ' h3, .class-container-' + classId + ' h4, .class-container-' + classId + ' h5, .class-container-' + classId + ' h6 {\n' +
        'font-family: var(--font-headline);\n' +
        'color: var(--theme-primary);\n' +
        'margin-top: 1.5rem;\n' +
        'margin-bottom: 1rem;\n' +
        'letter-spacing: -0.5px;\n' +
        'line-height: 1.2;\n' +
      '}\n' +
      '.class-container-' + classId + ' p, .class-container-' + classId + ' li, .class-container-' + classId + ' span, .class-container-' + classId + ' a, .class-container-' + classId + ' td {\n' +
        'font-family: var(--font-body);\n' +
        'color: var(--theme-text);\n' +
        'line-height: 1.6;\n' +
        'margin-bottom: 1rem;\n' +
      '}\n' +
      '.class-container-' + classId + ' table {\n' +
        'width: 100%;\n' +
        'border-collapse: collapse;\n' +
        'margin: 1.5rem 0;\n' +
        'box-shadow: 0 4px 15px rgba(0,0,0,0.04);\n' +
        'border-radius: 8px;\n' +
        'overflow: hidden;\n' +
      '}\n' +
      '.class-container-' + classId + ' th, .class-container-' + classId + ' td {\n' +
        'border: 1px solid #E5E7EB;\n' +
        'padding: 12px 15px;\n' +
        'text-align: left;\n' +
        'font-family: var(--font-body);\n' +
        'color: var(--theme-text);\n' +
        'line-height: 1.6;\n' +
      '}\n' +
      '.class-container-' + classId + ' th {\n' +
        'background-color: #F3F4F6;\n' +
        'font-weight: 700;\n' +
        'color: var(--theme-primary);\n' +
        'font-family: var(--font-headline);\n' +
      '}\n' +
      '.class-container-' + classId + ' tr:nth-child(even) {\n' +
        'background-color: #F9FAFB;\n' +
      '}\n' +
      '.class-container-' + classId + ' blockquote {\n' +
        'border-left: 4px solid var(--theme-secondary);\n' +
        'padding: 1rem 1.5rem;\n' +
        'margin: 1.5rem 0;\n' +
        'background-color: #F3F4F6;\n' +
        'border-radius: 8px;\n' +
        'font-style: italic;\n' +
        'color: #4B5563;\n' +
        'font-family: var(--font-body);\n' +
      '}\n' +
      '.class-container-' + classId + ' img {\n' +
        'width: 100%;\n' +
        'max-width: 800px;\n' +
        'height: auto;\n' +
        'display: block;\n' +
        'margin: 1.5rem auto;\n' +
        'border-radius: 8px;\n' +
        'box-shadow: 0 4px 15px rgba(0,0,0,0.08);\n' +
      '}\n' +
      '.class-container-' + classId + ' .class-page-' + classId + ' { display: none; }\n' +
      pageStyleRules + '\n' +
      progressBarRules + '\n' +
      '.nav-btn-' + classId + ':hover { opacity: 0.9; }\n' +
      '@media (max-width: 640px) { .cf-video-grid { grid-template-columns: 1fr !important; } }\n' +
    '</style>\n' +
    '<div class="content-body" style="padding: 2rem;">\n' +
      radioInputs + '\n' +
      progressBar + '\n' +
      stripVideoAndGeniallyCaptions(pagesHtml) + '\n' +
    '</div>\n' +
    lightboxHtml + '\n' +
    mediaStopScript + '\n' +
    fontScript + '\n' +
  '</div>';
}

// Helper to sync individual generatedHtml for any child CUESTIONARIO rows
export const syncChildQuestionnaires = async (classRows: any[], template?: any): Promise<Record<string, string>> => {
  const childMap: Record<string, string> = {};
  const rowRepo = AppDataSource.getRepository(CourseRow);
  for (const r of classRows) {
    const rFmt = (r.formato || '').toUpperCase();
    if ((rFmt === 'CUESTIONARIO' || rFmt === 'QUIZ') && r.id) {
      try {
        const docxContent = r.htmlContent || r.descripcion || '';
        const qs = parseDocxQuizQuestions(docxContent);
        if (qs.length > 0) {
          const individualQuizHtml = renderInteractiveQuizHtml(r, qs, template, r.id, true);
          await rowRepo.update(r.id, { generatedHtml: individualQuizHtml, estado: '5-LISTO' });
          childMap[r.id] = individualQuizHtml;
        }
      } catch (err) {
        console.error('[syncChildQuestionnaires] Error syncing child questionnaire row ' + r.id, err);
      }
    }
  }
  return childMap;
};

// POST /api/systems/generate-html
export const generateHtml = async (req: Request, res: Response): Promise<void> => {
  const { row, template } = req.body;
  let rows = req.body.rows;

  if (!rows && row) {
    rows = [row];
  }

  if ((!rows || rows.length === 0) || !template) {
    res.status(400).json({ message: 'Se requieren los datos del contenido (rows) y la plantilla' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ message: 'GEMINI_API_KEY no configurada en el servidor' });
    return;
  }

  const rowRepo = AppDataSource.getRepository(CourseRow);
  const examRow = (rows || []).find((r: any) => (r.formato || '').toUpperCase() === 'EXAMEN') || row;
  const dbRow = examRow && examRow.id ? await rowRepo.findOne({ where: { id: examRow.id } }) : null;

  if (dbRow && dbRow.formato === 'EXAMEN') {
    const docxContent = dbRow.htmlContent || dbRow.descripcion || '';
    if (!docxContent) {
      res.status(400).json({ message: 'No hay contenido cargado en la clase para extraer las preguntas del examen.' });
      return;
    }

    const examPrompt = `
      Analiza el siguiente texto que contiene preguntas de un examen y extrae todas las preguntas de opción múltiple con sus opciones correspondientes y la respuesta correcta.
      Debes identificar de manera precisa cuál es la respuesta correcta para cada pregunta basándote en marcas como negrita, asteriscos (*), checkmarks (✓) o textos explícitos de respuesta.

      Responde únicamente con un array JSON válido, sin bloques de código, sin etiquetas markdown \`\`\`json, ni explicaciones adicionales.
      Cada objeto del array debe tener exactamente la siguiente estructura:
      {
        "id": "string único para la pregunta (ej: q1, q2, q3)",
        "question": "texto de la pregunta",
        "options": ["opción A", "opción B", "opción C", "opción D"],
        "correctAnswerIndex": 0 // número entero de 0 a 3 que represente el índice de la opción correcta en la lista 'options'
      }

      Texto del examen:
      """
      ${docxContent}
      """
    `;

    let responseText = '';
    const MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
    for (const modelName of MODELS) {
      try {
        console.log(`[Gemini Exam Parser] Intentando con modelo: ${modelName}`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: examPrompt }] }],
              generationConfig: { temperature: 0.1 },
            }),
          }
        );
        if (response.ok) {
          const data = await response.json() as any;
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;
        }
      } catch (err) {
        console.error(`[Gemini Exam Parser] Error con modelo ${modelName}:`, err);
      }
    }

    if (!responseText) {
      res.status(500).json({ message: 'No se pudo parsear el examen con la IA. Inténtalo de nuevo.' });
      return;
    }

    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    }

    try {
      const parsedPool = JSON.parse(cleanJson);
      if (!Array.isArray(parsedPool)) {
        throw new Error('El resultado de la IA no es un array');
      }

      await rowRepo.update(dbRow.id, { questionsPool: parsedPool });

      let previewHtml = `
        <div style="font-family: 'Roboto', sans-serif; padding: 2rem; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 900px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #002d2b 0%, #14263d 100%); padding: 1.5rem; border-radius: 8px; color: #ffffff; margin-bottom: 1.5rem; border-left: 5px solid #00968f;">
            <h2 style="margin: 0; font-family: 'Bebas Neue', sans-serif; font-size: 2rem; letter-spacing: 1px; color: #ffffff;">📝 VISTA PREVIA DEL EXAMEN (Pool de Preguntas)</h2>
            <p style="margin: 5px 0 0 0; color: #00fff4; font-size: 0.9rem; font-weight: 700; text-transform: uppercase;">Materia: ${dbRow.materia} | Módulo: ${dbRow.modulo}</p>
          </div>
          <p style="color: #4b5563; font-size: 1rem; line-height: 1.5; margin-bottom: 1.5rem;">
            Se han extraído con éxito <strong>${parsedPool.length} preguntas</strong> del documento cargado. 
            El alumno verá una selección aleatoria de <strong>10 preguntas</strong> en cada uno de sus 3 intentos disponibles.
          </p>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      `;

      parsedPool.forEach((q: any, idx: number) => {
        previewHtml += `
          <div style="border: 1px solid #f3f4f6; background-color: #f9fafb; padding: 1.25rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <h4 style="margin: 0 0 0.75rem 0; color: #1f2937; font-family: 'Roboto', sans-serif; font-size: 1.05rem;">Pregunta ${idx + 1}: ${q.question}</h4>
            <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem; padding-left: 0.5rem;">
        `;
        if (Array.isArray(q.options)) {
          q.options.forEach((opt: string, optIdx: number) => {
            const isCorrect = optIdx === q.correctAnswerIndex;
            previewHtml += `
              <div style="padding: 8px 12px; border-radius: 6px; font-size: 0.95rem; border: 1px solid ${isCorrect ? '#10b981' : '#e5e7eb'}; background-color: ${isCorrect ? '#ecfdf5' : '#ffffff'}; color: ${isCorrect ? '#065f46' : '#374151'}; font-weight: ${isCorrect ? '600' : '400'}; display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; color: ${isCorrect ? '#10b981' : '#9ca3af'};">${String.fromCharCode(65 + optIdx)})</span>
                <span>${opt}</span>
                ${isCorrect ? '<span style="margin-left: auto; background-color: #10b981; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase;">Correcta ✓</span>' : ''}
              </div>
            `;
          });
        }
        previewHtml += `
            </div>
          </div>
        `;
      });

      previewHtml += `
          </div>
        </div>
      `;

      await rowRepo.update(dbRow.id, { generatedHtml: previewHtml, estado: '5-LISTO' });
      res.json({ html: previewHtml });
      return;
    } catch (parseErr) {
      console.error('[Gemini Exam Parser] JSON Parsing error:', parseErr, '\nRaw text was:', cleanJson);
      res.status(500).json({ message: 'La IA no devolvió un JSON con el formato esperado o el formato fue inválido. Inténtalo de nuevo.' });
      return;
    }
  }


  // Standalone Cuestionario row generation
  const questRow = (rows || []).find((r: any) => {
    const f = (r.formato || '').toUpperCase();
    return f === 'CUESTIONARIO' || f === 'QUIZ';
  }) || (row && ['CUESTIONARIO', 'QUIZ'].includes((row.formato || '').toUpperCase()) ? row : null);

  if (rows.length === 1 && questRow && questRow.id) {
    const dbQuest = await rowRepo.findOne({ where: { id: questRow.id } });
    if (dbQuest) {
      const docxContent = dbQuest.htmlContent || dbQuest.descripcion || '';
      if (!docxContent) {
        res.status(400).json({ message: 'No hay contenido cargado en la clase para extraer las preguntas del cuestionario.' });
        return;
      }
      const questions = parseDocxQuizQuestions(docxContent);
      if (questions.length > 0) {
        const quizHtml = renderInteractiveQuizHtml(dbQuest, questions, template, dbQuest.id, true);
        await rowRepo.update(dbQuest.id, { generatedHtml: quizHtml, estado: '5-LISTO' });
        res.json({ html: quizHtml, childQuestionnaires: { [dbQuest.id]: quizHtml } });
        return;
      }
    }
  }

  // Determine module name
  const moduleName = req.body.moduleName || (rows[0] ? rows[0].modulo : '');
  const effectiveClassId = rows?.[0]?.nro || rows?.[0]?.moduloNumero || (rows?.[0]?.sortOrder !== undefined ? String(rows[0].sortOrder + 1) : '1');

  // Check if class has multiple resources with mixed media (Video, Genially, Docx, Quiz, Meet) or massive content
  const totalContentLength = rows.reduce((acc: number, r: any) => acc + (r.htmlContent?.length || 0) + (r.descripcion?.length || 0), 0);
  const hasMixedResources = rows.length >= 2 && rows.some((r: any) => {
    const f = (r.formato || '').toUpperCase();
    return ['VIDEO', 'GENIALLY', 'CUESTIONARIO', 'QUIZ', 'MEET'].includes(f);
  });

  // Si la clase es de 1 sola fila y de tipo MEET, ensamblar directamente el diseño de conferencia / grabación
  if (rows.length === 1 && (rows[0].formato || '').toUpperCase() === 'MEET') {
    const assembledHtml = assembleClassHtml(moduleName, rows, template, effectiveClassId);
    const targetRow = rows[0];
    if (targetRow && targetRow.id) {
      await rowRepo.update(targetRow.id, { generatedHtml: assembledHtml, estado: '5-LISTO', aprobacionDiseno: 'PENDIENTE' });
    }
    res.json({ html: assembledHtml, childQuestionnaires: {} });
    return;
  }

  if (hasMixedResources || (rows.length >= 2 && totalContentLength > 25000)) {
    const assembledHtml = assembleClassHtml(moduleName, rows, template, effectiveClassId);
    const targetRow = (rows && rows.length > 0) ? (rows.find((r: any) => r.id === (row?.id || rows[0].id)) || rows[0]) : row;
    if (targetRow && targetRow.id) {
      await rowRepo.update(targetRow.id, { generatedHtml: assembledHtml, estado: '5-LISTO', aprobacionDiseno: 'PENDIENTE' });
    }
    const childQuestionnaires = await syncChildQuestionnaires(rows, template);
    res.json({ html: assembledHtml, childQuestionnaires });
    return;
  }
 
  // Determine course languages
  const courseId = rows?.[0]?.courseId;
  let languagesList = ['ES'];
  if (courseId) {
    try {
      const course = await AppDataSource.getRepository(Course).findOne({ where: { id: courseId } });
      if (course && course.languages) {
        languagesList = course.languages.split(',').map(l => l.trim()).filter(Boolean);
      }
    } catch (e) {
      console.error('Error fetching course for languages:', e);
    }
  }
 
  const primaryColor = template.design?.primaryColor || '#14b8a6';
  const secondaryColor = template.design?.secondaryColor || '#9ca3af';
  const textColor = template.design?.textColor || '#111827';
  
  let headlineFont = template.design?.headlineFont || 'Inter';
  let bodyFont = template.design?.bodyFont || 'Roboto';

  // Si existe manual de marca (como el de Maradona Menotti), forzamos las tipografías institucionales
  if (template.design?.styleManualPdf?.url) {
    headlineFont = 'Bebas Neue';
    bodyFont = 'Roboto';
  }

  let sequentialPaginationRules = '';
  if (rows.length >= 2) {
    const radioInputs = Array.from({ length: rows.length }, (_, i) =>
      `<input type="radio" id="step-radio-${i + 1}-[NRO]" name="class-steps-[NRO]" ${i === 0 ? 'checked' : ''} style="display: none !important;">`
    ).join('\n');

    const pageStyleRules = Array.from({ length: rows.length }, (_, i) =>
      `#step-radio-${i + 1}-[NRO]:checked ~ .class-page-${i + 1}-[NRO],
#step-radio-${i + 1}-[NRO]:checked ~ .lang-content-[NRO] .class-page-${i + 1}-[NRO],
#step-radio-${i + 1}-[NRO]:checked ~ .lang-content-es-[NRO] .class-page-${i + 1}-[NRO],
#step-radio-${i + 1}-[NRO]:checked ~ .lang-content-pt-[NRO] .class-page-${i + 1}-[NRO],
#step-radio-${i + 1}-[NRO]:checked ~ .lang-content-en-[NRO] .class-page-${i + 1}-[NRO] { display: block !important; }`
    ).join('\n');

    const progressBarRules = Array.from({ length: rows.length }, (_, i) =>
      `#step-radio-${i + 1}-[NRO]:checked ~ .progress-bar-container-[NRO] .progress-bar-fill-[NRO],
#step-radio-${i + 1}-[NRO]:checked ~ .lang-content-[NRO] .progress-bar-container-[NRO] .progress-bar-fill-[NRO],
#step-radio-${i + 1}-[NRO]:checked ~ .lang-content-es-[NRO] .progress-bar-container-[NRO] .progress-bar-fill-[NRO],
#step-radio-${i + 1}-[NRO]:checked ~ .lang-content-pt-[NRO] .progress-bar-container-[NRO] .progress-bar-fill-[NRO],
#step-radio-${i + 1}-[NRO]:checked ~ .lang-content-en-[NRO] .progress-bar-container-[NRO] .progress-bar-fill-[NRO] { width: ${((i + 1) / rows.length) * 100}%; }`
    ).join('\n');

    const paginationInstructions = rows.map((r: any, idx: number) => {
      const x = idx + 1;
      const isFirst = x === 1;
      const isLast = x === rows.length;
      const nextLabelFor = `step-radio-${x + 1}-[NRO]`;
      const prevLabelFor = `step-radio-${x - 1}-[NRO]`;

      const backButtonHtml = !isFirst
        ? `<label for="${prevLabelFor}" class="nav-btn-[NRO] nav-btn-prev-[NRO]" style="display: inline-block; padding: 10px 24px; background-color: ${secondaryColor}; color: #ffffff; border-radius: 8px; font-family: '${headlineFont}', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; user-select: none; margin-right: 8px;">Volver</label>`
        : `<span style="display: inline-block; width: 1px; height: 1px;"></span>`;

      const nextButtonHtml = !isLast
        ? `<label for="${nextLabelFor}" class="nav-btn-[NRO] nav-btn-next-[NRO]" style="display: inline-block; padding: 10px 24px; background-color: ${primaryColor}; color: #ffffff; border-radius: 8px; font-family: '${headlineFont}', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; user-select: none;">Continuar</label>`
        : `<label class="nav-btn-[NRO] nav-btn-finish-[NRO]" style="display: inline-block; padding: 10px 24px; background-color: #10b981; color: #ffffff; border-radius: 8px; font-family: '${headlineFont}', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; user-select: none;">Fin de la clase</label>`;

      const buttonHtml = `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 24px;">
        <div style="text-align: left;">
          ${backButtonHtml}
        </div>
        <div style="text-align: right;">
          ${nextButtonHtml}
        </div>
      </div>`;

      return `    - Para el recurso/bloque número ${x} (Tipo: ${r.formato}, Descripción: ${r.descripcion || ''}):
      Envuelve este bloque/recurso completo en un contenedor:
      <div class="class-page-[NRO] class-page-${x}-[NRO]" style="display: ${isFirst ? 'block' : 'none'};">
        [CONTENIDO_DEL_BLOQUE_${x}]
        <!-- Botones de navegación al final de este bloque -->
        ${buttonHtml}
      </div>`;
    }).join('\n');

    sequentialPaginationRules = `
12. **PAGINACIÓN SECUENCIAL DE CONTENIDOS (Múltiples recursos/contenidos en la misma clase)**:
    Dado que esta clase contiene ${rows.length} recursos/contenidos secuenciales:
    - Debes estructurar la visualización del contenido para que el alumno los recorra paso a paso (paginados), mostrando solo un recurso a la vez.
    - **INSERCIÓN OBLIGATORIA DE INPUTS DE PASO (NUNCA DENTRO DE <style>)**: Justo al inicio del contenedor \`<div class="content-body" ...>\`, ANTES de cualquier página o bloque, debes insertar obligatoriamente las siguientes etiquetas HTML de tipo radio para controlar la paginación:
      ${radioInputs}
    - Debes insertar una barra de progreso a continuación de los inputs de radio:
      \`\`\`html
      <div class="progress-bar-container-[NRO]" style="position: sticky; top: 0; left: 0; width: 100%; background-color: ${template.design?.backgroundColor || '#F9FAFB'}EE; backdrop-filter: blur(8px); height: 8px; z-index: 1000; margin-bottom: 24px; border-radius: 0 0 4px 4px; border-bottom: 1px solid rgba(0,0,0,0.04);">
        <div class="progress-bar-fill-[NRO]" style="height: 100%; background-color: ${primaryColor}; width: 0%; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 4px;"></div>
      </div>
      \`\`\`
${paginationInstructions}
      *(Nota: Para otros idiomas habilitados en el selector multilingüe, traduce los textos de los botones correspondientemente de forma nativa: 'Continuar' / 'Volver' / 'Fin de la clase' para Español, 'Continuar' / 'Voltar' / 'Fim da aula' para Portugués, 'Continue' / 'Back' / 'End of class' para Inglés).*
    - Agrega a la etiqueta <style> las siguientes reglas CSS:
      .class-container-[NRO] .class-page-[NRO] { display: none; }
      ${pageStyleRules}
      ${progressBarRules}
      .nav-btn-[NRO]:hover { opacity: 0.9; }
    - Agrega al final del documento (como último elemento del script, o en un script separado) el siguiente código de fallback para Moodle:
      <script>
        (function() {
          function stopMedia(el) {
            if (!el) return;
            try {
              var media = el.querySelectorAll('video, audio');
              for (var m = 0; m < media.length; m++) {
                try { media[m].pause(); } catch(e) {}
              }
              var iframes = el.querySelectorAll('iframe');
              for (var f = 0; f < iframes.length; f++) {
                var ifr = iframes[f];
                if (ifr.className && ifr.className.indexOf('cf-pdf-iframe') !== -1) continue;
                try {
                  ifr.contentWindow.postMessage('{"method":"pause"}', '*');
                  ifr.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                  ifr.contentWindow.postMessage('pause', '*');
                } catch(e) {}
                try {
                  var s = ifr.getAttribute('src');
                  if (s && s !== 'about:blank') {
                    ifr.setAttribute('data-original-src', s);
                    ifr.src = 'about:blank';
                  }
                } catch(e) {}
              }
            } catch(e) {}
          }

          function restoreMedia(el) {
            if (!el) return;
            try {
              var ifrs = el.querySelectorAll('iframe');
              for (var fi = 0; fi < ifrs.length; fi++) {
                var ifrActive = ifrs[fi];
                if (ifrActive.className && ifrActive.className.indexOf('cf-pdf-iframe') !== -1) continue;
                var orig = ifrActive.getAttribute('data-original-src');
                if (orig && (!ifrActive.src || ifrActive.src === 'about:blank' || ifrActive.src !== orig)) {
                  ifrActive.src = orig;
                }
              }
            } catch(e) {}
          }

          var inputs = document.querySelectorAll('input[name="class-steps-[NRO]"]');
          inputs.forEach(function(input) {
            input.addEventListener('change', function() {
              var activeStep = input.id.replace('step-radio-', '').replace('-[NRO]', '');
              document.querySelectorAll('.class-page-[NRO]').forEach(function(el) {
                var isCurrent = el.classList.contains('class-page-' + activeStep + '-[NRO]');
                if (!isCurrent) {
                  stopMedia(el);
                  el.style.display = 'none';
                } else {
                  restoreMedia(el);
                  el.style.display = 'block';
                }
              });
              // update progress bar fallback
              var fill = document.querySelector('.progress-bar-fill-[NRO]');
              if (fill) {
                fill.style.width = ((activeStep / ${rows.length}) * 100) + '%';
              }
            });
          });

          document.addEventListener('click', function(e) {
            var target = e.target;
            while (target && target !== document.body) {
              var forAttr = target.getAttribute && target.getAttribute('for');
              if (forAttr && forAttr.indexOf('step-radio-') === 0) {
                var match = forAttr.match(/^step-radio-(\\d+)-(.*)$/);
                if (match) {
                  var nextStep = match[1];
                  document.querySelectorAll('.class-page-[NRO]').forEach(function(el) {
                    if (!el.classList.contains('class-page-' + nextStep + '-[NRO]')) {
                      stopMedia(el);
                    } else {
                      restoreMedia(el);
                    }
                  });
                }
                break;
              }
              target = target.parentElement;
            }
          });
        })();
      </script>

`;
  } else {
    sequentialPaginationRules = `
12. **BOTONES DE NAVEGACIÓN Y FIN DE LA CLASE (CRÍTICO - OBLIGATORIO)**:
    Dado que esta clase contiene 1 solo recurso/contenido:
    - **Debes insertar obligatoriamente al final de la página de la clase** (justo antes de cerrar el contenedor principal, pero después de todo el contenido didáctico/multimedia de la clase) un botón "Fin de la clase" centrado o a la derecha, envuelto en la siguiente estructura HTML:
      \`\`\`html
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 24px;">
        <div style="text-align: left;">
          <span style="display: inline-block; width: 1px; height: 1px;"></span>
        </div>
        <div style="text-align: right;">
          <label class="nav-btn-[NRO] nav-btn-finish-[NRO]" style="display: inline-block; padding: 10px 24px; background-color: #10b981; color: #ffffff; border-radius: 8px; font-family: '${headlineFont}', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; user-select: none;">Fin de la clase</label>
        </div>
      </div>
      \`\`\`
      *(Nota: Para otros idiomas habilitados en el selector multilingüe, traduce el texto del botón correspondientemente de forma nativa: 'Fin de la clase' para Español, 'Fim da aula' para Portugués, 'End of class' para Inglés).*
    - Agrega a la etiqueta <style> las siguientes reglas CSS:
      .nav-btn-[NRO]:hover { opacity: 0.9; }
`;
  }

  let multilangPromptRule = '';
  if (languagesList.length > 1) {
    const styleRules = languagesList.map((lang) => `
    .multilang-container-[NRO] #lang-select-${lang.toLowerCase()}-[NRO]:checked ~ .lang-content-${lang.toLowerCase()}-[NRO] {
      display: block !important;
    }
    .multilang-container-[NRO] #lang-select-${lang.toLowerCase()}-[NRO]:checked ~ .lang-selector-[NRO] .lang-btn-${lang.toLowerCase()}-[NRO] {
      background: ${primaryColor} !important;
      color: #ffffff !important;
      border-color: ${primaryColor} !important;
    }
    `).join('\n');

    const radioInputs = languagesList.map((lang, index) => `
  <input type="radio" id="lang-select-${lang.toLowerCase()}-[NRO]" name="lang-group-[NRO]" ${index === 0 ? 'checked' : ''} style="display: none !important;">
    `).join('');

    const labelsHtml = languagesList.map((lang) => `
    <label for="lang-select-${lang.toLowerCase()}-[NRO]" class="lang-btn-[NRO] lang-btn-${lang.toLowerCase()}-[NRO]" style="padding: 6px 12px; border-radius: 6px; border: 1.5px solid ${secondaryColor}; background: transparent; color: ${textColor}; cursor: pointer; font-family: '${headlineFont}', sans-serif; font-size: 0.8rem; font-weight: 700; transition: all 0.2s; display: inline-block;">${lang}</label>
    `).join('');

    const templateContainers = languagesList.map((lang, index) => `
  <div class="lang-content-[NRO] lang-content-${lang.toLowerCase()}-[NRO]" data-lang="${lang}" style="display: ${index === 0 ? 'block' : 'none'};">
    <!-- Encabezado del Módulo y todo el Contenido traducido al ${lang === 'ES' ? 'Español' : lang === 'PT' ? 'Portugués' : lang === 'EN' ? 'Inglés' : lang} -->
  </div>
    `).join('\n');

    const jsFallback = `
  <script>
    (function() {
      var inputs = document.querySelectorAll('input[name="lang-group-[NRO]"]');
      inputs.forEach(function(input) {
        input.addEventListener('change', function() {
          var activeLang = input.id.replace('lang-select-', '').replace('-[NRO]', '');
          document.querySelectorAll('.lang-content-[NRO]').forEach(function(el) {
            var isCurrent = el.classList.contains('lang-content-' + activeLang + '-[NRO]');
            el.style.display = isCurrent ? 'block' : 'none';
          });
          document.querySelectorAll('.lang-btn-[NRO]').forEach(function(label) {
            var isCurrent = label.classList.contains('lang-btn-' + activeLang + '-[NRO]');
            label.style.background = isCurrent ? '${primaryColor}' : 'transparent';
            label.style.color = isCurrent ? '#ffffff' : '${textColor}';
            label.style.borderColor = isCurrent ? '${primaryColor}' : '${secondaryColor}';
          });
        });
      });
    })();
  </script>
    `;

    multilangPromptRule = `
12. **SOPORTE MULTILINGÜE (Idiomas activos: ${languagesList.join(', ')})**:
El curso requiere soporte para múltiples idiomas: ${languagesList.join(', ')}.
- Envuelve TODO el HTML generado (todas las clases, libros interactivos y recursos) en un único contenedor principal \`<div class="multilang-container-[NRO]" style="position: relative;">\`.
- Inserta una etiqueta \`<style>\` autocontenida al principio de este contenedor con las siguientes reglas CSS para controlar el cambio de idioma y los estilos de los botones sin necesidad de JavaScript. Es CRÍTICO y OBLIGATORIO que copies exactamente todas las reglas y selectores detallados a continuación, sin omitir, resumir ni recortar ninguno de ellos:
  \`\`\`html
  <style>
    .multilang-container-[NRO] .lang-content-[NRO] {
      display: none;
    }
    ${styleRules}
  </style>
  \`\`\`
- Como primer hijo directo del contenedor principal (inmediatamente después de la etiqueta \`<style>\`), inserta los inputs de tipo radio ocultos:
  ${radioInputs}
- A continuación, inserta la barra de selección de idioma usando etiquetas \`<label>\` asociadas a los inputs mediante el atributo \`for\`. Esta barra debe quedar flotante y fija a la derecha al hacer scroll, posicionándose de forma pegajosa debajo de la barra de progreso (ej: \`position: sticky; top: 24px; float: right; display: flex; gap: 8px; z-index: 1010; margin-bottom: -40px; margin-right: 24px;\`) para que quede visible y accesible en todo momento. Debe tener el siguiente formato:
  \`\`\`html
  <div class="lang-selector-[NRO]" style="position: sticky; top: 24px; float: right; display: flex; gap: 8px; z-index: 1010; margin-bottom: -40px; margin-right: 24px;">
    ${labelsHtml}
  </div>
  \`\`\`
- Genera el contenido completo traducido (todos los bloques y contenidos de forma independiente para cada uno de los idiomas habilitados, envolviendo cada versión en un contenedor con clase \`lang-content-[NRO] lang-content-[IDIOMA_LOWER]-[NRO]\` (ej. \`lang-content-[NRO] lang-content-es-[NRO]\`) y el atributo \`data-lang="IDIOMA"\`). El primer idioma debe tener \`style="display: block;"\`, y los otros \`style="display: none;"\`.
  Por ejemplo:
  \`\`\`html
  ${templateContainers}
  \`\`\`
- Agrega al final del bloque de contenido la etiqueta \`<script>\` autocontenida como plan de contingencia (fallback por si acaso Moodle limpia los tags de estilo pero conserva los scripts):
  \`\`\`html
  ${jsFallback}
  \`\`\`
- Asegúrate de que las traducciones sean fieles, de calidad profesional y bien formateadas utilizando los mismos estilos de la plantilla. No uses ningún atributo \`onclick\` inline en las etiquetas \`<label>\` ni en ningún otro elemento.
- CRÍTICO: No mezcles idiomas en el contenido. Si el idioma actual de generación es Español (ES), todo el texto de ese bloque debe conservarse estrictamente en Español. No traduzcas palabras sueltas ni frases al inglés dentro del bloque de español (por ejemplo, nunca traduzcas "Pero" a "But", ni "Clase" a "Class"). La traducción al inglés (EN) debe realizarse únicamente en el contenedor de inglés correspondiente.
`;
  } else if (languagesList.length === 1 && languagesList[0] !== 'ES') {
    multilangPromptRule = `
12. **IDIOMA DE SALIDA (Idioma: ${languagesList[0]})**:
El curso actual debe ser generado COMPLETAMENTE en el idioma: ${languagesList[0]}.
Debes traducir de forma nativa y fluida todo el contenido redactado, títulos, explicaciones, metáforas, ilustraciones y cuadros al idioma ${languagesList[0]}. No incluyas selectores de idioma ni scripts de pestañas. Asegúrate de respetar y mantener exactamente las mismas estructuras HTML, clases y propiedades estéticas de la plantilla al realizar la traducción.
`;
  }

  const themeStyle = template.design?.themeStyle || 'modern';
  let stylePromptRules = '';
  if (themeStyle === 'modern') {
    stylePromptRules = `
- Estilo: Moderno / Minimalista.
- Reglas estéticas:
  * Las tarjetas de clases o bloques deben usar bordes redondeados amplios (\`border-radius: 16px\`), fondo plano suave (\`${template.design?.surfaceColor}\`) y sombras muy tenues y elegantes (\`box-shadow: 0 4px 20px rgba(0,0,0,0.04)\`).
  * Los títulos y subtítulos deben ser limpios y con un espaciado amplio (\`letter-spacing: -0.5px\`).
  * Los elementos interactivos o informativos deben lucir pulidos, minimalistas y limpios.
  * Si hay tablas, usa bordes colapsados simples y elegantes, con filas intercaladas ligeras.
`;
  } else if (themeStyle === 'classic') {
    stylePromptRules = `
- Estilo: Clásico / Editorial Académico.
- Reglas estéticas:
  * Las tarjetas o separadores de secciones deben usar bordes sólidos y definidos (\`border: 1px solid rgba(0,0,0,0.12)\` o \`border-top: 4px solid ${template.design?.primaryColor}\`), esquinas apenas redondeadas (\`border-radius: 8px\`) y sin sombras o sombras muy sutiles.
  * Títulos y subtítulos formales estructurados con líneas de división delgadas y elegantes por debajo (\`border-bottom: 1px solid rgba(0,0,0,0.08)\`).
  * Estructuras de contenido claras y alineadas, simulando el estilo de libros de texto formales o journals.
  * Tablas con bordes negros o grises delgados (\`border: 1px solid rgba(0,0,0,0.2)\`) y encabezados con fondos de color primario con texto blanco.
`;
  } else if (themeStyle === 'futuristic') {
    stylePromptRules = `
- Estilo: Futurista / Cyber-Tech.
- Reglas estéticas:
  * Las tarjetas de clases o bloques deben tener un diseño tipo cristal o translúcido (glassmorphism) con un borde delgado brillante de color secundario (\`border: 1px solid rgba(255,255,255,0.1)\` o \`rgba(20, 184, 166, 0.2)\`) y sombras con resplandor o glow sutil utilizando el color primario (\`box-shadow: 0 0 15px rgba(20, 184, 166, 0.15)\`).
  * Elementos destacados con bordes neón y esquinas con ángulos marcados o \`border-radius: 8px\`.
  * Los títulos e iconos del contenido deben usar colores vibrantes y detalles tipo consola o dashboard tecnológico.
  * Listas y tablas usando bordes transparentes y celdas destacadas con colores eléctricos de acento.
`;
  } else if (themeStyle === 'creative') {
    stylePromptRules = `
- Estilo: Creativo / Dinámico.
- Reglas estéticas:
  * Las tarjetas de clases o bloques deben tener formas asimétricas o detalles juguetones (\`border-radius: 24px 8px 24px 8px\`), o bordes coloridos gruesos.
  * Los títulos principales y contenedores destacados deben usar gradientes suaves y modernos en los fondos o bordes (\`background: linear-gradient(135deg, ${template.design?.primaryColor}, ${template.design?.secondaryColor || '#8B5CF6'})\` con texto blanco).
  * Tablas y viñetas con iconos amigables y decoraciones divertidas pero profesionales.
  * Divisiones visuales audaces y diseño asimétrico para mantener el dinamismo visual.
`;
  }

  // ── Reemplazar placeholders en el customCode de cada bloque ANTES de enviarlo a Gemini ──
  // Filtramos y reemplazamos los bloques que corresponden a las filas de este módulo
  const blocksWithRealData = (template.blocks || [])
    .filter((b: any) => rows.some((r: any) => r.id === b.id))
    .map((b: any) => {
      const correspondingRow = rows.find((r: any) => r.id === b.id);
      let cleanedCode = b.customCode;
      if (cleanedCode) {
        cleanedCode = cleanedCode.replace(/\s*-\s*(Presentaci\u00f3n\s+Interactiva|Video\s+Clase|Cuestionario|Examen|Articulate|Libro\s+Interactivo|PDF)/gi, '');
      }
      return {
        ...b,
        customCode: cleanedCode && correspondingRow ? replacePlaceholders(cleanedCode, correspondingRow) : undefined,
      };
    });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const apiEndpointUrl = frontendUrl.includes('localhost') 
    ? 'http://localhost:3000/api/reports/event' 
    : `${frontendUrl}/api/reports/event`;

  const trackingScriptInstruction = `
12. **SCRIPT DE SEGUIMIENTO Y ANALÍTICA DE MOODLE (OBLIGATORIO)**:
    Debes incluir obligatoriamente al final del HTML (justo antes de cerrar el contenedor principal de la clase, es decir, el primer div principal con clase "coursefactory-content") el siguiente bloque script para registrar la actividad de los alumnos en CourseFactory:
    \`\`\`html
    <script>
      (function() {
        var apiEndpoint = '${apiEndpointUrl}';
        var trackingInfo = {
          licencia: '[LICENCIA]' || window.location.hostname || 'Licencia General',
          materia: '[MATERIA]' || 'Materia General',
          modulo: '[MODULO]' || 'Clase General',
          courseId: '[COURSE_ID]',
          rowId: '[ROW_ID]'
        };

        // Identificar alumno
        var alumnoId = 'alumno_anonimo';
        var alumnoNombre = 'Alumno de Moodle';

        try {
          var moodleCfg = (window.M && window.M.cfg) || (window.parent && window.parent.M && window.parent.M.cfg);
          if (moodleCfg && moodleCfg.userId) {
            alumnoId = 'moodle_user_' + moodleCfg.userId;
          }
          
          var nameElem = (window.parent && window.parent.document && window.parent.document.querySelector('.usermenu .userbutton .usertext')) 
                       || document.querySelector('.usermenu .userbutton .usertext')
                       || (window.parent && window.parent.document && window.parent.document.querySelector('.usermenu .usertext'))
                       || document.querySelector('.usermenu .usertext');
          if (nameElem && nameElem.textContent) {
            alumnoNombre = nameElem.textContent.trim();
            if (alumnoId === 'alumno_anonimo') {
              alumnoId = alumnoNombre.toLowerCase().replace(/[^a-z0-9]/g, '_');
            }
          }
        } catch (e) {
          console.log('[CF Tracking] Contexto Moodle restringido, usando valores por defecto');
        }

        function registerEvent(accion, score, correctAnswers, totalQuestions) {
          fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              licencia: trackingInfo.licencia,
              materia: trackingInfo.materia,
              modulo: trackingInfo.modulo,
              courseId: trackingInfo.courseId,
              rowId: trackingInfo.rowId,
              accion: accion,
              alumnoMoodleId: alumnoId,
              alumnoNombre: alumnoNombre,
              score: score !== undefined ? score : null,
              correctAnswers: correctAnswers !== undefined ? correctAnswers : null,
              totalQuestions: totalQuestions !== undefined ? totalQuestions : null
            })
          }).catch(function(e) {
            console.log('[CF Tracking] Error al reportar evento:', e);
          });
        }

        // Exponer globalmente para iframes o scripts internos
        window.registerEvent = registerEvent;

        // 1. Reportar apertura al cargar
        registerEvent('open');

        // 2. Reportar clicks en continuar (bucle tradicional ES5 compatible)
        var btns = document.querySelectorAll('.nav-btn-next-[NRO]');
        if (btns) {
          for (var i = 0; i < btns.length; i++) {
            btns[i].addEventListener('click', function() {
              registerEvent('click_continuar');
            });
          }
        }

        // 3. Reportar finalización (cuando se completa la clase)
        var steps = document.querySelectorAll('input[name="class-steps-[NRO]"]');
        if (steps && steps.length > 0) {
          var lastStep = steps[steps.length - 1];
          lastStep.addEventListener('change', function() {
            if (lastStep.checked) {
              registerEvent('finish');
            }
          });
        } else {
          // Si no tiene paginación, reportar finalización a los 20 segundos
          setTimeout(function() {
            registerEvent('finish');
          }, 20000);
        }

        // 4. Heartbeat Activity Tracker (Dedicación Total)
        if (alumnoId && trackingInfo.courseId) {
          var isUserActive = true;
          var lastActivityTime = Date.now();
          var resetActivity = function() {
            isUserActive = true;
            lastActivityTime = Date.now();
          };
          window.addEventListener('mousemove', resetActivity);
          window.addEventListener('keydown', resetActivity);
          window.addEventListener('click', resetActivity);
          window.addEventListener('touchstart', resetActivity);
          
          setInterval(function() {
            if (isUserActive && (Date.now() - lastActivityTime < 120000)) {
              fetch(apiEndpoint.replace('/event', '/heartbeat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  alumnoMoodleId: alumnoId,
                  courseId: trackingInfo.courseId,
                  seconds: 60
                })
              }).catch(function(e) {
                console.log('[CF Heartbeat] Error sending heartbeat:', e);
              });
            } else {
              isUserActive = false;
            }
          }, 60000);
        }
      })();
    </script>
    \`\`\`
  `;

  const prompt = `
Eres un experto desarrollador web creando contenido HTML estructurado para Moodle.
Tu objetivo es generar el HTML final del módulo "${moduleName}" basándote en la información del contenido, los documentos Word (.docx) cargados y la plantilla de diseño proporcionada.

**MÓDULO DEL CURSO**
- Nombre del Módulo: ${moduleName}

**PLANTILLA DE DISEÑO: ${template.name || 'Base'}**
- Color Principal: ${template.design?.primaryColor}
- Color Secundario: ${template.design?.secondaryColor}
- Fondo: ${template.design?.backgroundColor}
- Color de Superficie (Tarjetas): ${template.design?.surfaceColor}
- Color de Texto: ${template.design?.textColor}
- Fuente para Títulos: ${template.design?.headlineFont}
- Fuente para Cuerpo: ${template.design?.bodyFont}
- Estilo Visual Seleccionado: ${themeStyle}

**REGLAS ESTÉTICAS DEL TEMA:**
${stylePromptRules}

**ESTRUCTURA DE BLOQUES ESPERADA (en este orden estricto, uno por cada clase/recurso del módulo)**
${blocksWithRealData.map((b: any, i: number) => {
  const r = rows.find((row: any) => row.id === b.id);
  const docxHtml = r && r.htmlContent ? `\n   - Contenido de Word (.docx) Extraído para esta Clase:\n     """\n     ${r.htmlContent}\n     """` : '';
  return `${i + 1}. Tipo: ${b.type}${b.customCode ? ` | Código Base:\n${b.customCode}` : ''}${docxHtml}`;
}).join('\n')}

**INSTRUCCIONES CRÍTICAS**
1. Genera SOLO código HTML válido y semántico.
2. NO devuelvas markdown, NO uses \\\`\\\`\\\`html, NO devuelvas explicaciones. Solo el HTML raw.
3. El HTML debe estar envuelto en un <div class="coursefactory-content class-container-[NRO]" style="background-color: ${template.design?.backgroundColor}; color: ${template.design?.textColor}; font-family: '${template.design?.bodyFont}', sans-serif; padding: 0; border-radius: 16px; overflow: hidden;">.
4. **NO generes un encabezado de módulo al inicio del HTML ni al inicio de ningún bloque de texto.** El sistema ya muestra el nombre de la clase, la materia y los contenidos en un cabezal propio antes del bloque HTML. El contenido debe comenzar directamente con el primer párrafo, imagen o sección del documento Word, sin ningún título introductorio que repita el número, nombre, materia o tipo del módulo/clase.
   ⚠️ **CRÍTICO - OMITIR NÚMERO Y NOMBRE DE CLASE AL INICIO**: Si el documento Word cargado contiene al inicio un título que repita el número de clase y el nombre (ej: "58. Introducción", "Clase 58 - Introducción", "58. INTRODUCCIÓN", etc.), debés OMITIRLO por completo. El contenido maquetado en el HTML debe comenzar a partir del texto que sigue a ese título introductorio, para evitar que se duplique con el cabezal del sistema.


5. **CONTENEDOR DE CONTENIDOS (OBLIGATORIO)**: Todo el contenido de la clase (los bloques de clases, texto, videos, etc.) debe estar envuelto en un contenedor principal:
   \`<div class="content-body" style="padding: 2rem;">\`
   Esto garantiza que los bloques mantengan un margen elegante y limpio respecto a los bordes laterales y no toquen los extremos de la tarjeta principal.

6. Aplica los estilos en línea (inline CSS) usando las variables de diseño o colores directos proporcionados. Es CRÍTICO y OBLIGATORIO que todas las propiedades de tipografía (ej: \`font-family: '${headlineFont}', sans-serif;\` o \`font-family: '${bodyFont}', sans-serif;\`) sean escritas en línea (inline CSS) en el atributo \`style\` de cada etiqueta HTML relevante (como \`h1\`, \`h2\`, \`h3\`, \`h4\`, \`p\`, \`span\`, \`li\`, \`a\`, \`td\`, etc.), además de definirse en el bloque \`<style>\`. Esto previene de forma definitiva que Moodle elimine la familia tipográfica si se sanitizan las clases del bloque de estilos.
7. Usa los Códigos Base de los bloques exactamente como se proporcionan (los cuales ya tienen sus placeholders reemplazados con los datos reales), ordenados secuencialmente.
7. Si se incluye "Contenido de Word (.docx) Extraído" para una clase, debes integrar, estructurar y maquetar TODO ese contenido detalladamente dentro del bloque correspondiente (usando los estilos de fuente y colores de la plantilla de diseño de acuerdo con el tema visual seleccionado: ${themeStyle}), en lugar de usar textos de ejemplo o descripciones cortas.
   ⚠️ **PROHIBICIÓN ABSOLUTA DE RESUMEN — DERECHOS DE AUTOR Y CURADURÍA**: Queda TERMINANTEMENTE PROHIBIDO omitir, resumir, recortar, condensar o parafrasear cualquier parte del texto del documento Word. El contenido provisto tiene derechos de autor y obligaciones de curaduría que exigen fidelidad total. Debes incluir CADA párrafo, CADA oración y CADA palabra exactamente como aparece en el Word, sin excepciones. Esto aplica especialmente al formato FLIP: si el Word tiene 26 páginas, el flipbook debe tener tantas páginas como sean necesarias para incluir todo el texto completo. NO existe un límite de páginas. Además, queda ESTRICTAMENTE PROHIBIDO inventar o agregar palabras, frases, introducciones, conclusiones o explicaciones adicionales que no formen parte del documento Word original. Debes ser 100% fiel al contenido provisto.
8. Asegúrate de que todos los iframes (videos o geniallys) se rendericen correctamente. Si la URL de un Genially ([URL_GENIALLY]) o de un Video ([URL_VIDEO_VIMEO]) está vacía o no es un enlace válido (es decir, no contiene genial.ly / geni.al / cloudinary.com para Genially, o no contiene videos.maradonamenotti.cloud / drive.google.com / vimeo.com / youtube.com para video), NO intentes renderizar un iframe vacío. En su lugar, genera un contenedor premium y elegante que informe que el recurso multimedia interactivo está "En proceso de edición y diseño" o similar, decorado con un estilo y colores que encajen con la plantilla.
8b. **ENLACES Y REPRODUCTORES DE VIDEO (REGLA CRÍTICA)**: Si el bloque es de tipo VIDEO o si en el texto del documento Word (.docx) detectas enlaces a videos (urls de videos.maradonamenotti.cloud/embed/ID, Vimeo o YouTube), debes transformarlos e incrustarlos en un reproductor responsivo (16:9) utilizando exactamente esta estructura HTML oficial en una sola línea limpia:
\`<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000;margin:1.5rem 0;"><iframe src="[URL_DEL_VIDEO]" loading="lazy" width="100%" height="100%" frameborder="0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\`
9. Transforma todas las tablas, listas y textos simples del documento Word en componentes web hermosos con CSS inline alineados al estilo estético "${themeStyle}".
10. **MARCADORES INTELIGENTES IA — SOLO SI ESTÁN EN EL CÓDIGO BASE**: Los siguientes marcadores solo deben procesarse si aparecen EXPLÍCITAMENTE en el Código Base del bloque. **QUEDA TERMINANTEMENTE PROHIBIDO agregar analogías, cuadros sinópticos, tablas comparativas, metáforas, citas o cualquier elemento didáctico inventado que NO esté en el documento Word original y NO figure como marcador en el Código Base.** El objetivo es respetar el contenido original, no enriquecerlo con contenido propio.
    - **[CUADRO_CONCEPTUAL]**: Genera un mapa o cuadro sinóptico/conceptual didáctico interactivo estructurado con cajas conectadas mediante flexbox o grid, colores de acento coherentes, bordes finos, etc.
    - **[TABLA_COMPARATIVA]**: Genera una tabla comparativa HTML bien diagramada que confronte de 2 a 4 conceptos clave descritos en el contenido de la clase.
    - **[METAFORA]**: Genera una tarjeta de metáfora didáctica destacada, utilizando un emoji grande y una explicación poética/visual que ayuede a memorizar o entender un concepto abstracto del tema.
    - **[ANALOGIA]**: Genera un recuadro explicativo con una analogía práctica de la vida real que aclare el concepto clave de la clase.
    - **[ILUSTRACION]**: Dibuja un gráfico explicativo o diagrama conceptual representativo en formato SVG nativo en línea, o crea un diseño visual geométrico/infografía enriquecida con CSS e iconos/emojis.
    - **[CITA_AUTORIA]**: Genera un blockquote de cita sumamente premium y estilizado que resalte una frase célebre relevante del tema junto con el nombre del autor correspondiente.
10b. **TÍTULOS DE SECCIÓN (OBLIGATORIO donde el Word cambia de tema)**: Cuando el texto del documento Word cambia claramente de tema o sección (aunque no tenga un título explícito), debés agregar un título de sección en el color de acento de la plantilla (por ejemplo, \`<h3 style="color: ${template.design?.primaryColor}; font-family: '${template.design?.headlineFont}', sans-serif;">Título derivado del contenido</h3>\`). El título debe derivarse literalmente del contenido que le sigue (como "La construcción del rol docente", "Nos presentamos", etc.), sin inventar frases que no surjan del propio texto.
11. **PAGINACIÓN PARA FLIPBOOK (formato FLIP)**: Si el Código Base de un bloque es de tipo \`flip\` o contiene el marcador \`[FLIPBOOK_PAGES]\`, debes estructurar el contenido del documento Word (.docx) cargado para esa clase dividiéndolo de forma lógica en múltiples páginas consecutivas.
    ⚠️ **SIN TÍTULO EN EL BLOQUE FLIP**: NO incluyas ningún \`<h3>\` ni encabezado con el nombre del módulo o "Libro interactivo" dentro del HTML generado. El cabezal del sistema ya muestra el título de la clase. El bloque debe comenzar directamente con el contenedor del libro (\`<div class="block-flipbook"...>\`), sin ningún encabezado previo.

    ⚠️ **CANTIDAD DE PÁGINAS — SIN LÍMITE**: Genera la cantidad de páginas que sea necesaria para incluir TODO el contenido del Word sin omitir ni resumir nada. Si el Word tiene 26 páginas, el flipbook puede tener 15, 20 o 25 páginas — las que sean necesarias. NO existe un máximo de páginas. Distribuir el contenido correctamente es más importante que tener pocas páginas. Cada página debe ser devuelta como un elemento HTML con el siguiente formato y estilos en línea obligatorios:
    \`<div class="flip-page" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; display: flex; flex-direction: column; justify-content: flex-start; box-sizing: border-box; background: ${template.design?.surfaceColor || '#ffffff'}; padding: 2rem; transition: transform 0.6s, opacity 0.3s; backface-visibility: hidden; transform-style: preserve-3d; border-radius: 8px; border: 1px solid rgba(0,0,0,0.06); overflow-y: auto;">\`
      <!-- Contenido maquetado de la página (títulos, párrafos, listas, etc.) -->
    \`</div>\`
    Reemplaza por completo el marcador \`[FLIPBOOK_PAGES]\` con todas las páginas generadas de forma consecutiva dentro del contenedor del libro. Asegúrate de estructurar el texto de manera que se lea cómodamente por páginas individuales, sin cortar párrafos a la mitad.
    ⚠️ **CONTINUIDAD OBLIGATORIA ENTRE PÁGINAS**: El último párrafo de la página N debe ser el inmediatamente anterior al primer párrafo de la página N+1, sin saltear ningún párrafo, oración ni frase. Si verificás que entre la página 4 y la página 5 falta contenido del Word, es un error grave. Todo el texto del documento Word debe aparecer exactamente una vez, en el orden original, sin omisiones entre páginas.
13. **BLOQUES DE CUESTIONARIO (CUESTIONARIO / QUIZ)**: Si el bloque es de tipo \`cuestionario\`, debes parsear las preguntas y opciones del "Contenido de Word (.docx) Extraído" para esta clase y generar un cuestionario interactivo de opción múltiple completo con HTML, CSS y Javascript integrado:
    - **Compatibilidad Absoluta ES5 (CRÍTICO - OBLIGATORIO)**: Todo el código JavaScript generado para el cuestionario interactivo DEBE ser compatible con ES5. Queda TERMINANTEMENTE PROHIBIDO el uso de sintaxis moderna como optional chaining (\`?.\`), nullish coalescing (\`??\`), variables \`const\` o \`let\`, funciones flecha (\`=>\`), o \`Array.from\`. Usa únicamente var.
    - **Detección, Asignación de Atributo data-correct y Ocultamiento de Marcas**: El documento Word tiene las respuestas correctas marcadas (resaltadas en color, sombreadas, en negrita, o con checkmarks ✓ / asteriscos *). Debes identificar de manera impecable cuál es la opción correcta para cada pregunta. En el elemento HTML de cada opción (o en su etiqueta wrapper / input), debes asignar obligatoriamente el atributo \`data-correct="true"\` para la respuesta correcta y \`data-correct="false"\` para las incorrectas. **Al evaluar el cuestionario en JavaScript, la corrección DEBE realizarse obligatoriamente comprobando si el elemento seleccionado posee \`getAttribute('data-correct') === 'true'\` (o \`data-correct === 'true'\`), y NUNCA basándose en el índice de posición en el array ni en el orden en pantalla, para asegurar que la calificación sea 100% precisa incluso al barajar las opciones.** Debes eliminar cualquier marca visual visible inicial (negritas, colores de fondo, checkmarks ✓, asteriscos, etc.) de modo que al cargarse todas las opciones luzcan idénticas en formato neutro.
      ⚠️ **ANÁLISIS PEDAGÓGICO DE RESPUESTAS CORRECTAS**: Si una pregunta posee la marca \`[CORRECT]\` o \`✓\`, esa opción DEBE llevar \`data-correct="true"\`. Si alguna pregunta no llegara a tener la marca \`[CORRECT]\` explícita en su texto, QUIDA ESTRICTAMENTE PROHIBIDO asignar por defecto la opción A. Debes analizar el texto conceptual y pedagógico de la pregunta para determinar con precisión cuál es la opción (A, B, C o D) contextualmente correcta y asignarle \`data-correct="true"\`.
    - **Visualización y Botón de Envío**: Diseña el cuestionario con un estilo sumamente premium y moderno (uso de tarjetas con hover interactivo, transiciones suaves, fuentes e iconos llamativos). Debe haber un botón destacado y visible al final del cuestionario rotulado como "Enviar Respuestas" que el alumno debe presionar para iniciar el proceso de corrección y registrar su calificación.
    - **Registro de Intentos en LocalStorage**: En el código JavaScript integrado, debes gestionar y persistir el número de intentos que realiza el alumno para este cuestionario específico utilizando \`localStorage\` (generando una clave única basada en el nombre del módulo o clase para que no interfiera con otros cuestionarios).
    - **Lógica de Envío y Reglas de Visualización de Respuestas Correctas**: Al hacer clic en "Enviar Respuestas", el código JS debe:
      1. Incrementar el contador de intentos en \`localStorage\` para este cuestionario.
      2. Calcular la calificación final (porcentaje de respuestas correctas de 0 a 100%).
      3. Reportar obligatoriamente la calificación al tracking global utilizando sintaxis ES5 compatible (evita optional chaining):
         \`\`\`javascript
         var registerFn = window.registerEvent || (window.parent && window.parent.registerEvent);
         if (typeof registerFn === 'function') {
           registerFn('quiz_submit', percentageScore, correctCount, totalQuestionsCount);
         }
         \`\`\`
      4. Validar el resultado de la evaluación:
         - **Si la calificación es aprobada (>= 70%)**: Muestra feedback de aprobación (por ejemplo, cartel verde, emojis festivos) y puedes destacar visualmente las opciones que el alumno respondió correctamente o incorrectamente (con resaltado de la correcta en verde y su selección en rojo si falló).
         - **Si la calificación es reprobada (< 70%)**:
            - **Intentos 1, 2 y 3 (intentos < 4)**: **ESTÁ TOTALMENTE PROHIBIDO revelar las respuestas correctas o incorrectas**. No apliques ningún color verde o rojo (ni en fondo, ni en bordes, ni en texto), ni checkmarks \`✓\` ni marcas \`✗\` a ninguna de las opciones de las preguntas. Solo debes mostrar el mensaje de desaprobado ("No alcanzaste el puntaje mínimo (70%). Nota obtenida: X%. Te invitamos a reintentar.") y el botón para reintentar. Las preguntas y sus opciones deben permanecer con su estilo visual neutro e intacto, exactamente igual a como estaban antes de presionar Enviar.
            - **Intento 4 en adelante (intentos >= 4)**: **SÍ debes revelar las respuestas correctas** para que el alumno pueda aprender (resaltando en verde la opción correcta con una marca \`✓\` y en rojo la opción seleccionada incorrecta si la hubo con \`✗\`), junto con el feedback de reprobación y el botón de reintento.
    - **Detección y Visualización de Justificaciones/Explicaciones**: Si en el archivo Word una pregunta contiene texto de justificación o explicación debajo de las opciones (por ejemplo, después de aclaraciones como "(Cuando se elige la respuesta, aparece la justificación)" o párrafos explicativos), debes extraer ese texto e incluirlo en un contenedor de justificación para la pregunta (\`<div class="quiz-justification" style="display: none; margin-top: 1rem; padding: 12px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #00968f; border-radius: 8px; font-size: 0.95rem; color: #334155; line-height: 1.5;">💡 <strong>Justificación:</strong> [Texto extraído...]</div>\`). Al hacer clic en "Enviar Respuestas" (o al evaluar/revelar respuestas correctas), el código JS del cuestionario DEBE mostrar los contenedores de justificación cambiando su propiedad a \`style.display = 'block'\` para que el alumno pueda leer la explicación pedagógica de cada respuesta.
    - **Shuffling/Barajado de Opciones al Cargar y Reintentar**: Añade código JavaScript que, al cargarse el cuestionario por primera vez y cada vez que el alumno haga clic en "Reintentar Cuestionario", mezcle de forma completamente aleatoria (shuffling) los nodos/elementos DOM de las opciones (A, B, C, D) para cada pregunta. Esto asegura que las opciones cambien de posición y que la opción correcta no quede siempre en el mismo lugar. Para convertir las colecciones HTML a arrays para barajado, usa bucles \`for\` tradicionales o \`Array.prototype.slice.call()\` en lugar de \`Array.from()\`. Al reintentar, limpia todas las selecciones y devuelve las opciones a su estado neutro original (sin colores ni marcas), ocultando nuevamente los contenedores de justificación (\`style.display = 'none'\`).


14. **FIDELIDAD ABSOLUTA AL TEXTO ORIGINAL (PROHIBIDO INSERTAR TEXTO PROPIO/CONVERSACIONAL)**:
    Queda TERMINANTEMENTE PROHIBIDO que agregues o inventes palabras, oraciones, introducciones, resúmenes, conclusiones o comentarios de relleno que no provengan literalmente del documento Word (.docx) o del texto provisto. No agregues saludos ("¡Bienvenidos a la clase!", etc.), ni introducciones a los temas ni conclusiones sintetizadas por ti. Maqueta e integra de manera exacta, literal e íntegra el texto proporcionado, estructurando visualmente los elementos del contenido (tablas, metáforas, cuadros sinópticos) a partir del texto y sin desviar o parafrasear las ideas originales. **Especialmente ante cartas de despedida, manifiestos históricos, testimonios personales o citas de figuras públicas (como el Dr. René Favaloro), debes copiar el texto 100% de forma literal y completa, absteniéndote estrictamente de agregar resúmenes, explicaciones introductorias, análisis posteriores, notas al pie de la IA o comentarios interpretativos.** Si una clase o recurso no posee un documento Word (.docx) cargado o su contenido extraído está vacío, queda ESTRICTAMENTE PROHIBIDO que inventes o agregues párrafos de texto, explicaciones conceptuales, analogías, listas, citas, cuadros o cualquier otro tipo de contenido didáctico o informativo por tu cuenta. En su lugar, debes procesar y renderizar ÚNICAMENTE el bloque o recurso solicitado en el Código Base de la clase (por ejemplo, si es de tipo VIDEO, renderiza exclusivamente la tarjeta con el reproductor de video Vimeo; si es de tipo GENIALLY, renderiza exclusivamente el iframe de Genially; etc.), utilizando únicamente el título y descripción provistos en el Código Base, sin añadir ningún otro contenido de tu propia cosecha.

14b. **TÍTULOS DE SECCIÓN Y CABECERAS LIMPIOS (CRÍTICO - OBLIGATORIO)**:
     Queda TERMINANTEMENTE PROHIBIDO que agregues palabras de relleno, sufijos, subtítulos o descripciones técnicas al nombre de la clase en las etiquetas "\<h3>" o "\<h4>" de los títulos del bloque (por ejemplo: agregar " - Video Clase", " - Presentación Interactiva", " - PDF", " - Cuestionario", " - Recurso", etc., al título de la tarjeta del bloque). El título del bloque debe ser EXACTAMENTE el nombre de la clase o módulo provisto en la variable [MODULO], limpio y sin añadidos adicionales.

14c. **PROHIBICIÓN DE DESTACADOS Y RESALTADOS ARBITRARIOS (CERO INTERVENCIÓN DE DISEÑO DE CONTENIDO)**:
     Queda TERMINANTEMENTE PROHIBIDO que resaltes oraciones o frases por tu cuenta aplicando estilos arbitrarios como negritas ('<strong>'), cursivas ('<em>'), colores llamativos (verdes, rojos, azules), tamaños de letra ampliados, o que estructures párrafos comunes dentro de cajas de llamada (callouts, blockquotes, contenedores de alerta, tarjetas de cita, etc.), a menos que estén explícitamente diseñados de ese modo en el archivo original.
     - Todo texto continuo, cartas, manifiestos y documentos de lectura deben ser renderizados como párrafos simples ('<p>') limpios y ordenados, respetando el peso visual, color de texto y formato estandarizado de la plantilla, sin añadir ningún tipo de énfasis editorial o decorativo propio de la IA.
     - Queda estrictamente prohibido que la IA elija de forma unilateral resaltar partes del texto en bloques de colores llamativos o con estilos HTML que cambien el color del texto o de fondo, buscando una maquetación 100% fiel al formato de texto plano/párrafo original.


15. **FORMATO DE MAYÚSCULAS/MINÚSCULAS EN TÍTULOS (SENTENCE CASE - OBLIGATORIO)**:
    Todos los títulos principales, subtítulos y encabezados generados por la IA deben usar obligatoriamente "Sentence Case" (mayúscula únicamente en la primera letra de la primera palabra de la oración, y minúsculas en el resto de palabras, salvo nombres propios). Queda estrictamente prohibido usar "Title Case" (mayúsculas al inicio de cada palabra) en los textos generados.
    - **Acrónimos, Siglas y Números Romanos**: Debes mantener siempre en mayúsculas todas las siglas, acrónimos o abreviaciones (ej: "TTyE", "PF", "BDD", "LMS", etc.) y los números romanos (ej: "I", "II", "III", "IV", etc.), respetando su formato de mayúsculas original sin forzarlos a minúscula bajo ninguna circunstancia.
    - EJEMPLO CORRECTO: "1. Introducción general" / "Metodología de la enseñanza I" / "Intro TTyE I" / "El preparador físico (PF) en el fútbol"
    - EJEMPLO INCORRECTO: "1. Introducción General" / "Metodología De La Enseñanza I" / "Intro ttye i" / "El preparador físico (pf) en el fútbol"

16. **TAMAÑO DE IMÁGENES Y RECURSOS MULTIMEDIA — LIGHTBOX AL CLICK**:
    Todas las fotos, imágenes y videos (iframes de Vimeo, Youtube, etc.) que se inserten o maqueten en la clase deben renderizarse a un tamaño amplio y destacado. Queda estrictamente prohibido usar miniaturas o elementos pequeños y angostos dentro del contenido.
    - Las imágenes deben ocupar todo el ancho disponible del contenedor de la tarjeta, usando estilos inline como \`width: 100%; max-width: 800px; height: auto; display: block; margin: 1.5rem auto; border-radius: 8px;\`.
    - Los videos y Geniallys deben ocupar un tamaño prominente y el mayor espacio posible. Utiliza un ancho de \`100%\` y una altura proporcional amplia (por ejemplo, envueltos en un contenedor de relación de aspecto 16:9 con \`padding-bottom: 56.25%;\`). Asegúrate de que las tarjetas y contenedores de video o Genially (como \`.block-video\`, \`.cinema-video\`, \`.block-genially\`) no tengan ninguna limitación de ancho (\`max-width\`) que restrinja su tamaño y siempre ocupen el \`100%\` del ancho del contenedor principal.
    - **LIGHTBOX AL CLICK (OBLIGATORIO para todas las imágenes)**: Cada imagen \`<img>\` debe estar envuelta en un \`<span>\` con \`cursor: zoom-in\` y tener un atributo \`onclick\` que abra un overlay de pantalla completa mostrando la imagen ampliada. Implementá el lightbox con un \`<div id="cf-lightbox">\` único al final del HTML, con el siguiente código ES5 integrado en un bloque \`<script>\`:
    \`\`\`
    // Lightbox ES5
    (function() {
      var lb = document.getElementById('cf-lightbox');
      if (!lb) return;
      lb.addEventListener('click', function() { lb.style.display = 'none'; });
    })();
    function cfZoom(src) {
      var lb = document.getElementById('cf-lightbox');
      var img = document.getElementById('cf-lightbox-img');
      if (lb && img) { img.src = src; lb.style.display = 'flex'; }
    }
    \`\`\`
    El HTML del lightbox a incluir al final del bloque principal es:
    \`<div id="cf-lightbox" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;"><img id="cf-lightbox-img" src="" style="max-width:95%;max-height:95vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.8);" alt="Vista ampliada"></div>\`
    Cada imagen debe tener: \`onclick="cfZoom(this.src)"\` y \`style="cursor:zoom-in;..."\`.

${sequentialPaginationRules}
${multilangPromptRule}
${trackingScriptInstruction}
   `;

  const parts: any[] = [];
  let enrichedPrompt = prompt;

  if (template.design?.styleManualPdf?.url) {
    enrichedPrompt += `

**DIRECTRICES ESPECÍFICAS DEL MANUAL DE ESTILO (MARADONA MENOTTI)**:
Para garantizar la coherencia con el manual de estilos oficial en PDF ("${template.design.styleManualPdf.fileName}"):
1. **Tipografía Oficial**:
   - Debes importar e incorporar estas fuentes en el bloque \`<style>\` al inicio del HTML:
     \`\`\`css
     @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto:wght@400;500;700&display=swap');
     \`\`\`
   - **Títulos principales, encabezados de módulo y secciones**: Deben usar la fuente \`'Bebas Neue', sans-serif\` con un estilo destacado (ej: \`font-size: 2.25rem; font-weight: bold; letter-spacing: 1px; color: #14263D;\`). Para evitar que Moodle elimine la fuente, debes escribir OBLIGATORIAMENTE el estilo inline \`font-family: 'Bebas Neue', sans-serif;\` directamente en el atributo \`style\` de cada etiqueta de título (\`h1\`, \`h2\`, \`h3\`, \`h4\`, etc.).
   - **Cuerpo de texto, párrafos y listas**: Deben usar la fuente \`'Roboto', sans-serif\` para garantizar legibilidad óptima. Para evitar que Moodle elimine la fuente, debes escribir OBLIGATORIAMENTE el estilo inline \`font-family: 'Roboto', sans-serif;\` directamente en el atributo \`style\` de cada etiqueta de texto (\`p\`, \`span\`, \`li\`, \`a\`, \`td\`, etc.).
2. **Paleta Cromática Oficial**:
   - Utiliza exactamente estos códigos de color para la maquetación y diseño de los componentes:
     * Verde azulado principal (Teal): \`#00968F\`
     * Azul/Teal claro: \`#51ACC0\`
     * Turquesa brillante (Acento/Neon): \`#00FFF4\`
     * Verde oscuro profundo: \`#002D2B\`
     * Azul marino oscuro: \`#14263D\`
     * Blanco: \`#FFFFFF\`
     * Negro: \`#000000\`
3. **Estructura Visual Premium**:
   - NO debes generar ningún encabezado de módulo al inicio de cada idioma. El cabezal ya es inyectado por el sistema de forma estática en la parte superior. Comienza el contenido directamente con el primer bloque, libro interactivo o recurso.
   - Las tarjetas de clases o bloques deben tener un espaciado amplio, bordes redondeados limpios y contrastar perfectamente con el color de fondo. El texto debe ser de color oscuro (\`#14263D\` o \`#002D2B\`) sobre fondo blanco, o de color blanco sobre tarjetas oscuras.
`;
  }

  if (template.design?.examplePdfs && template.design.examplePdfs.length > 0) {
    const exampleNames = template.design.examplePdfs.map((p: any) => `"${p.fileName}"`).join(', ');
    enrichedPrompt += `\n\n[PDFs DE EJEMPLO DE MAQUETADO ADJUNTOS]: Se han adjuntado los siguientes PDFs de ejemplo: ${exampleNames}. Analiza visualmente y estructuralmente estos ejemplos de clases/documentos de la escuela y copia o imita su diseño, distribución de celdas, estilos de listas y acabado estético premium en el HTML final.`;
  }

  parts.push({ text: enrichedPrompt });

  // Descargar y adjuntar el manual de estilo PDF
  if (template.design?.styleManualPdf?.url) {
    try {
      console.log(`[Gemini Prompt] Descargando Manual de Estilo: ${template.design.styleManualPdf.url}`);
      const pdfRes = await fetch(template.design.styleManualPdf.url);
      if (pdfRes.ok) {
        const arrayBuffer = await pdfRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        parts.push({ text: `A continuación se adjunta el MANUAL DE ESTILO oficial de la Escuela Maradona Menotti en formato PDF:` });
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data
          }
        });
        console.log(`[Gemini Prompt] Manual de Estilo adjuntado con éxito (${arrayBuffer.byteLength} bytes).`);
      } else {
        console.error(`[Gemini Prompt] Error al descargar Manual de Estilo PDF: ${pdfRes.status} ${pdfRes.statusText}`);
      }
    } catch (err) {
      console.error('[Gemini Prompt] Error procesando Manual de Estilo PDF:', err);
    }
  }

  // Descargar y adjuntar los PDFs de ejemplo
  if (template.design?.examplePdfs && Array.isArray(template.design.examplePdfs)) {
    for (let idx = 0; idx < template.design.examplePdfs.length; idx++) {
      const pdf = template.design.examplePdfs[idx];
      if (pdf && pdf.url) {
        try {
          console.log(`[Gemini Prompt] Descargando PDF de ejemplo ${idx + 1}: ${pdf.url}`);
          const pdfRes = await fetch(pdf.url);
          if (pdfRes.ok) {
            const arrayBuffer = await pdfRes.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString('base64');
            parts.push({ text: `A continuación se adjunta el PDF de EJEMPLO DE MAQUETACIÓN #${idx + 1} ("${pdf.fileName || 'Ejemplo'}"):` });
            parts.push({
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data
              }
            });
            console.log(`[Gemini Prompt] PDF de ejemplo #${idx + 1} adjuntado con éxito (${arrayBuffer.byteLength} bytes).`);
          } else {
            console.error(`[Gemini Prompt] Error al descargar PDF de ejemplo ${idx + 1}: ${pdfRes.status} ${pdfRes.statusText}`);
          }
        } catch (err) {
          console.error(`[Gemini Prompt] Error procesando PDF de ejemplo #${idx + 1}:`, err);
        }
      }
    }
  }

  // ── Helper: espera N ms ──────────────────────────────────────────────────
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ── Modelos a intentar en orden (primary → fallback) ────────────────────
  const MODELS = [
    'gemini-2.5-flash',             // Modelo principal — súper rápido y disponible
    'gemini-2.0-flash',             // Fallback 1 — alta disponibilidad
    'gemini-1.5-flash',             // Fallback 2
    'gemini-flash-latest',          // Fallback 3 — compatibilidad
  ];
  const RETRY_DELAYS_MS = [5_000, 15_000, 30_000]; // esperas entre intentos del mismo modelo

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let response: any = null;
  let lastErrorBody = '';
  let lastStatus = 0;

  modelLoop:
  for (const modelName of MODELS) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        const waitMs = RETRY_DELAYS_MS[attempt - 1];
        console.log(`[Gemini] Modelo ${modelName} — intento ${attempt + 1} en ${waitMs / 1000}s...`);
        await sleep(waitMs);
      }

      console.log(`[Gemini] Llamando a modelo: ${modelName} (intento ${attempt + 1})`);
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 65536,
            },
          }),
        }
      );

      if (response.ok) {
        console.log(`[Gemini] ✅ Éxito con modelo ${modelName} (intento ${attempt + 1})`);
        break modelLoop; // ← salir de ambos loops
      }

      lastStatus = response.status;
      lastErrorBody = await response.text();
      console.error(`[Gemini] ❌ Modelo ${modelName} intento ${attempt + 1} → HTTP ${lastStatus}:`, lastErrorBody.slice(0, 200));

      // Si el error NO es transitorio (429 o 503), no tiene sentido reintentar
      const isTransient = lastStatus === 503 || lastStatus === 429 ||
        /UNAVAILABLE|high demand|quota/i.test(lastErrorBody);
      if (!isTransient) {
        break modelLoop;
      }
    }
  }

  if (!response || !response.ok) {
    console.warn(`[Gemini] No se pudo obtener respuesta de la API (${lastStatus}: ${lastErrorBody.slice(0, 100)}). Aplicando ensamblado determinista de respaldo.`);
    const fallbackHtml = assembleClassHtml(moduleName, rows, template, effectiveClassId);
    await syncChildQuestionnaires(rows);
    res.json({ html: fallbackHtml });
    return;
  }

  try {
    const data = await response.json() as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const candidate = data.candidates?.[0];
    let html = candidate?.content?.parts?.[0]?.text || '';

    // Check for token truncation or broken HTML from Gemini
    const isTruncated =
      candidate?.finishReason === 'MAX_TOKENS' ||
      (html.includes('<style>') && !html.includes('</style>')) ||
      (rows.length >= 2 && !html.includes('class-page-')) ||
      html.trim().length < 300;

    if (isTruncated) {
      console.warn(`[generateHtml] Gemini output was incomplete or truncated (finishReason: ${candidate?.finishReason}, length: ${html.length}). Falling back to assembleClassHtml.`);
      const assembledHtml = assembleClassHtml(moduleName, rows, template, effectiveClassId);
      await syncChildQuestionnaires(rows);
      res.json({ html: assembledHtml });
      return;
    }

    // Limpiar markdown por si Gemini lo agrega igual
    html = html.replace(/^```html\n?/, '').replace(/```$/, '').trim();

    // ── Seguridad extra: reemplazar cualquier placeholder que Gemini haya dejado ──
    if (rows && rows.length > 0) {
      for (const r of rows) {
        html = replacePlaceholders(html, r);
      }
    }

    // ── Sanitizar / Reestructurar iframes de VMM a formato único e inline de 1 línea ──
    // Step 1: Protect already-correct VMM blocks
    const vmmProtected: string[] = [];
    html = html.replace(
      /<div[^>]*style="[^"]*position:\s*relative[^"]*padding-bottom:\s*56\.25%[^"]*"[^>]*>\s*<iframe[^>]*src=["']https?:\/\/videos\.maradonamenotti\.cloud\/embed\/[a-zA-Z0-9-]+["'][^>]*>\s*<\/iframe>\s*<\/div>/gi,
      (match) => {
        const idx = vmmProtected.length;
        vmmProtected.push(match);
        return `__VMM_PROTECTED_${idx}__`;
      }
    );
    // Step 2: Replace bare VMM iframes
    html = html.replace(
      /<iframe[^>]*src=["']https?:\/\/videos\.maradonamenotti\.cloud\/embed\/([a-zA-Z0-9-]+)["'][^>]*>\s*<\/iframe>/gi,
      (match, videoId) => {
        if (!videoId) return match;
        return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000;margin:1.5rem 0;"><iframe src="https://videos.maradonamenotti.cloud/embed/${videoId}" loading="lazy" width="100%" height="100%" frameborder="0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
      }
    );
    // Step 3: Restore protected blocks
    html = html.replace(/__VMM_PROTECTED_(\d+)__/g, (_, idx) => vmmProtected[parseInt(idx, 10)] || '');

    // Dynamic Google Fonts Loader fallback injection
    const fontScript = getGoogleFontsScript(headlineFont, bodyFont);
    html += fontScript;

    // Universal Media Stopper Script (stops videos/iframes when changing slides in Moodle or previews)
    const mediaStopScript = `
<script>
(function() {
  function stopMediaInContainer(el) {
    if (!el) return;
    try {
      var media = el.querySelectorAll('video, audio');
      for (var m = 0; m < media.length; m++) {
        try { media[m].pause(); } catch(e) {}
      }
      var iframes = el.querySelectorAll('iframe');
      for (var f = 0; f < iframes.length; f++) {
        var ifr = iframes[f];
        if (ifr.className && ifr.className.indexOf('cf-pdf-iframe') !== -1) continue;
        try {
          ifr.contentWindow.postMessage('{"method":"pause"}', '*');
          ifr.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
          ifr.contentWindow.postMessage('pause', '*');
        } catch(e) {}
        try {
          var currentSrc = ifr.getAttribute('src');
          if (currentSrc && currentSrc !== 'about:blank') {
            ifr.setAttribute('data-original-src', currentSrc);
            ifr.src = 'about:blank';
          }
        } catch(e) {}
      }
    } catch(e) {}
  }

  function restoreMediaInContainer(el) {
    if (!el) return;
    try {
      var iframes = el.querySelectorAll('iframe');
      for (var f = 0; f < iframes.length; f++) {
        var ifr = iframes[f];
        if (ifr.className && ifr.className.indexOf('cf-pdf-iframe') !== -1) continue;
        var orig = ifr.getAttribute('data-original-src');
        if (orig && (!ifr.src || ifr.src === 'about:blank' || ifr.src !== orig)) {
          ifr.src = orig;
        }
      }
    } catch(e) {}
  }

  function switchStep(nextStep, container) {
    if (!container) container = document;
    var allPages = container.querySelectorAll('[class*="class-page-"]');
    for (var i = 0; i < allPages.length; i++) {
      var pEl = allPages[i];
      var pMatch = pEl.className.match(/class-page-([0-9]+)-/);
      if (pMatch) {
        var pNum = parseInt(pMatch[1], 10);
        if (pNum === nextStep) {
          restoreMediaInContainer(pEl);
          pEl.style.setProperty('display', 'block', 'important');
        } else {
          stopMediaInContainer(pEl);
          pEl.style.setProperty('display', 'none', 'important');
        }
      }
    }
  }

  document.addEventListener('change', function(e) {
    var target = e.target;
    if (target && target.type === 'radio' && target.id && target.id.indexOf('step-radio-') === 0) {
      var match = target.id.match(/^step-radio-([0-9]+)-(.*)$/);
      if (match) {
        var currentStep = parseInt(match[1], 10);
        var container = target.closest('.coursefactory-content') || document;
        switchStep(currentStep, container);
      }
    }
  });

  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target !== document.body) {
      var forAttr = target.getAttribute && target.getAttribute('for');
      if (forAttr && forAttr.indexOf('step-radio-') === 0) {
        var match = forAttr.match(/^step-radio-([0-9]+)-(.*)$/);
        if (match) {
          var nextStep = parseInt(match[1], 10);
          var container = target.closest('.coursefactory-content') || document;
          switchStep(nextStep, container);
        }
        break;
      }
      target = target.parentElement;
    }
  });

  // Auto-inicializar visibilidad estricta
  try {
    var initialRadio = document.querySelector('input[type="radio"][id^="step-radio-"]:checked') ||
                       document.querySelector('input[type="radio"][id^="step-radio-"]');
    if (initialRadio) {
      var mInit = initialRadio.id.match(/^step-radio-([0-9]+)-(.*)$/);
      if (mInit) {
        var initStep = parseInt(mInit[1], 10);
        var initContainer = initialRadio.closest('.coursefactory-content') || document;
        switchStep(initStep, initContainer);
      }
    }
  } catch(e) {}
})();
</script>`;
    html += mediaStopScript;

    html = stripVideoAndGeniallyCaptions(html);
    await syncChildQuestionnaires(rows);
    res.json({ html });
  } catch (error) {
    console.error('Error llamando a Gemini:', error);
    try {
      const fallbackHtml = assembleClassHtml(moduleName, rows, template, effectiveClassId);
      await syncChildQuestionnaires(rows);
      res.json({ html: fallbackHtml });
      return;
    } catch (fallbackErr) {
      console.error('Error in fallback assembleClassHtml:', fallbackErr);
      res.status(500).json({ message: 'Error al generar el HTML con IA. Verificá la configuración del servidor.' });
    }
  }
};

// POST /api/systems/publish-moodle
export const publishMoodle = async (req: Request, res: Response): Promise<void> => {
  const { html, courseName, courseCode } = req.body;

  if (!html || !courseName || !courseCode) {
    res.status(400).json({ message: 'html, courseName y courseCode son requeridos' });
    return;
  }

  const moodleUrl = process.env.MOODLE_URL;
  const moodleToken = process.env.MOODLE_TOKEN;

  if (!moodleUrl || !moodleToken) {
    res.status(500).json({ message: 'Credenciales de Moodle no configuradas en el servidor' });
    return;
  }

  try {
    // Llamada a Moodle REST API
    const cleanUrl = moodleUrl.endsWith('/') ? moodleUrl.slice(0, -1) : moodleUrl;
    const endpoint = `${cleanUrl}/webservice/rest/server.php`;
    const params = new URLSearchParams({
      wstoken: moodleToken,
      wsfunction: 'core_course_update_courses',
      moodlewsrestformat: 'json',
      'courses[0][shortname]': courseCode,
      'courses[0][fullname]': courseName,
      'courses[0][summary]': html,
      'courses[0][summaryformat]': '1', // 1 = HTML
    });

    const moodleRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const text = await moodleRes.text();
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error('Error parseando JSON de Moodle. Respuesta recibida:', text);
      throw new Error('La respuesta de Moodle no es un JSON válido');
    }

    res.json({ success: true, moodleResponse: result });
  } catch (error) {
    console.error('Error conectando a Moodle:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error al publicar en Moodle' });
  }
};
