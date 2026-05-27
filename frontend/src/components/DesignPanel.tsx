import React, { useState } from 'react';
import { type CourseDesign, type CourseTemplate, type TemplateBlockType, type CourseRow, defaultDesign, initialBlockCodes, mapFormatoToBlockType } from '../types';
import { Palette, Type, Plus, Trash2, LayoutTemplate, Layers, Pencil } from 'lucide-react';
import './DesignPanel.css';

interface DesignPanelProps {
  templates: CourseTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<CourseTemplate[]>>;
  rows: CourseRow[];
}

const fonts = [
  'Bebas Neue',
  'Roboto',
  'Plus Jakarta Sans',
  'Manrope',
  'Inter',
  'Outfit',
  'Open Sans',
  'Montserrat',
  'Poppins'
];

/*
const replacePreviewPlaceholders = (code: string, row?: CourseRow) => {
  if (!code) return '';
  if (!row) {
    return code
      .replace(/\[NRO\]/g, '1')
      .replace(/\[MODULO\]/g, 'Introducción al Desarrollo Web')
      .replace(/\[DESCRIPCION\]/g, 'En esta clase aprenderás los conceptos fundamentales de HTML, CSS y JavaScript para dar tus primeros pasos en la programación.')
      .replace(/\[URL_VIDEO_VIMEO\]/g, 'https://player.vimeo.com/video/76979871')
      .replace(/\[URL_ENLACES_ADJUNTOS\]/g, '#')
      .replace(/\[URL_GENIALLY\]/g, 'https://view.genial.ly/609a87d00f7c220d9d4bfde7')
      .replace(/\[URL_IMAGEN\]/g, 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80');
  }

  const nro = row.nro || '';
  const modulo = row.modulo || '';
  const descripcion = row.descripcion || '';
  const urlVideoVimeo = row.videoVimeo || row.videoDrive || row.links || '';
  const urlGenially = row.geniallyUrl || row.links || '';
  const urlEnlacesAdjuntos = row.links || '';
  let urlImagen = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';
  if (row.links && (row.links.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || row.links.includes('drive.google.com') || row.links.includes('unsplash.com'))) {
    urlImagen = row.links;
  }

  return code
    .replace(/\[NRO\]/g, nro)
    .replace(/\[MODULO\]/g, modulo)
    .replace(/\[DESCRIPCION\]/g, descripcion)
    .replace(/\[URL_VIDEO_VIMEO\]/g, urlVideoVimeo)
    .replace(/\[URL_ENLACES_ADJUNTOS\]/g, urlEnlacesAdjuntos)
    .replace(/\[URL_GENIALLY\]/g, urlGenially)
    .replace(/\[URL_IMAGEN\]/g, urlImagen);
};
*/

const getBlockTypeLabel = (type: string) => {
  switch (type) {
    case 'text': return 'Texto';
    case 'video': return 'Video';
    case 'pdf': return 'Genially';
    case 'cuestionario': return 'Cuestionario';
    case 'custom': return 'Custom';
    default: return type;
  }
};

const LAYOUT_PRESETS: Record<TemplateBlockType, { name: string; description: string; code: string }[]> = {
  text: [
    {
      name: 'Rise Standard',
      description: 'Bloque tipo Rise con barra lateral y sombra suave',
      code: `<div class="block-text" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; border-left: 5px solid var(--theme-primary); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <h3 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0;">[NRO]. [MODULO]</h3>
  <div style="font-family: var(--font-body); color: var(--theme-text); line-height: 1.6;">
    <p>[DESCRIPCION]</p>
  </div>
</div>`
    },
    {
      name: 'Rise con Imagen',
      description: 'Bloque con imagen ilustrativa arriba y texto debajo',
      code: `<div class="block-text-image" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <img src="[URL_IMAGEN]" alt="[MODULO]" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;" />
  <h3 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0;">[NRO]. [MODULO]</h3>
  <div style="font-family: var(--font-body); color: var(--theme-text); line-height: 1.6;">
    <p>[DESCRIPCION]</p>
  </div>
</div>`
    },
    {
      name: 'Card Minimalista',
      description: 'Tarjeta flotante con borde sutil y diseño moderno',
      code: `<div class="card-text" style="margin-bottom: 2rem; padding: 2rem; background: var(--theme-surface); border-radius: 16px; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
  <span style="font-size: 0.8rem; font-weight: 700; color: var(--theme-primary); text-transform: uppercase; letter-spacing: 1px;">Clase [NRO]</span>
  <h3 style="font-family: var(--font-headline); color: var(--theme-text); margin: 0.5rem 0 1rem 0; font-size: 1.5rem;">[MODULO]</h3>
  <div style="font-family: var(--font-body); color: var(--theme-secondary); line-height: 1.7;">
    <p>[DESCRIPCION]</p>
  </div>
</div>`
    },
    {
      name: 'Frase / Destacado',
      description: 'Ideal para citas, conceptos clave o definiciones',
      code: `<div class="quote-text" style="margin-bottom: 2rem; padding: 2rem; background: color-mix(in srgb, var(--theme-primary) 5%, transparent); border-left: 8px solid var(--theme-primary); border-radius: 12px; position: relative;">
  <span style="position: absolute; top: 10px; right: 20px; font-size: 4rem; color: color-mix(in srgb, var(--theme-primary) 15%, transparent); font-family: Georgia, serif; line-height: 1;">“</span>
  <h4 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1.5px;">Concepto Clave - [MODULO]</h4>
  <p style="font-family: var(--font-body); color: var(--theme-text); font-size: 1.1rem; font-style: italic; line-height: 1.6; margin: 0;">
    [DESCRIPCION]
  </p>
</div>`
    }
  ],
  video: [
    {
      name: 'Reproductor Rise',
      description: 'Video embebido con información debajo',
      code: `<div class="block-video" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <h3 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
    <span>🎥</span> [MODULO] - Video Clase
  </h3>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; margin-bottom: 1rem; background: #000;">
    <iframe src="[URL_VIDEO_VIMEO]" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
  </div>
  <p style="font-family: var(--font-body); color: var(--theme-secondary); font-size: 0.9rem; line-height: 1.5; margin: 0;">
    [DESCRIPCION]
  </p>
</div>`
    },
    {
      name: 'Video Cinematográfico',
      description: 'Tarjeta con cabecera oscura y reproductor grande',
      code: `<div class="cinema-video" style="margin-bottom: 2rem; background: #0f172a; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15);">
  <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
    <span style="font-family: var(--font-headline); color: #f8fafc; font-size: 0.95rem; font-weight: 700; text-transform: uppercase;">[MODULO]</span>
    <span style="background: var(--theme-primary); color: #fff; font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; font-weight: 700;">VIDEO</span>
  </div>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; background: #000;">
    <iframe src="[URL_VIDEO_VIMEO]" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>
  </div>
  <div style="padding: 1.5rem; background: rgba(255,255,255,0.02);">
    <p style="font-family: var(--font-body); color: #94a3b8; font-size: 0.85rem; line-height: 1.6; margin: 0;">[DESCRIPCION]</p>
  </div>
</div>`
    }
  ],
  pdf: [
    {
      name: 'Iframe Completo',
      description: 'Presentación de Genially embebida con reproductor interactivo',
      code: `<div class="block-genially" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <h3 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
    <span>📊</span> [MODULO] - Presentación Interactiva
  </h3>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; margin-bottom: 1rem; background: transparent;">
    <iframe src="[URL_GENIALLY]" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe>
  </div>
  <p style="font-family: var(--font-body); color: var(--theme-text); line-height: 1.6; margin: 0;">
    [DESCRIPCION]
  </p>
</div>`
    },
    {
      name: 'Botón de Enlace Directo',
      description: 'Ideal para descargas de PDF o accesos externos directos',
      code: `<div class="download-pdf" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; border: 1px solid rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <div style="display: flex; gap: 1rem; align-items: center;">
    <div style="background: color-mix(in srgb, var(--theme-primary) 10%, transparent); width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--theme-primary);">📖</div>
    <div>
      <h4 style="font-family: var(--font-headline); margin: 0; color: var(--theme-text);">Material Complementario: [MODULO]</h4>
      <p style="font-family: var(--font-body); margin: 4px 0 0 0; font-size: 0.8rem; color: var(--theme-secondary);">[DESCRIPCION]</p>
    </div>
  </div>
  <a href="[URL_GENIALLY]" target="_blank" style="font-family: var(--font-headline); background: var(--theme-primary); color: #fff; text-decoration: none; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.5rem; transition: opacity 0.2s;">
    <span>Ver recurso</span> ➔
  </a>
</div>`
    }
  ],
  cuestionario: [
    {
      name: 'Cuestionario Moderno',
      description: 'Tarjeta con fondo destacado y botón grande de acción',
      code: `<div class="block-quiz" style="margin-bottom: 2rem; padding: 2rem; background: var(--theme-surface); border-radius: 16px; border: 2px solid rgba(139, 92, 246, 0.15); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); text-align: center;">
  <span style="font-size: 2.5rem; display: block; margin-bottom: 1rem;">📝</span>
  <h3 style="font-family: var(--font-headline); color: #8b5cf6; margin: 0 0 0.5rem 0; font-size: 1.5rem;">Cuestionario de Evaluación</h3>
  <p style="font-family: var(--font-body); color: var(--theme-secondary); line-height: 1.6; margin: 0 auto 1.5rem auto; max-width: 500px;">
    [DESCRIPCION]
  </p>
  <button style="font-family: var(--font-headline); background: #8b5cf6; color: #ffffff; border: none; padding: 0.85rem 2rem; border-radius: 10px; font-weight: 700; font-size: 1rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 14px 0 rgba(139, 92, 246, 0.4); transition: all 0.2s;">
    Comenzar Cuestionario 🚀
  </button>
</div>`
    }
  ],
  custom: [
    {
      name: 'Caja Alerta de Destacado',
      description: 'Llama la atención de los estudiantes con un aviso/información importante',
      code: `<div class="custom-alert" style="margin-bottom: 2rem; padding: 1.25rem 1.5rem; background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; border-radius: 8px; display: flex; gap: 1rem; align-items: flex-start;">
  <div style="font-size: 1.25rem; color: #d97706; line-height: 1;">⚠️</div>
  <div>
    <h5 style="font-family: var(--font-headline); margin: 0 0 4px 0; color: #92400e; font-weight: 700; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Atención Importante</h5>
    <p style="font-family: var(--font-body); margin: 0; font-size: 0.85rem; color: #b45309; line-height: 1.5;">[DESCRIPCION]</p>
  </div>
</div>`
    }
  ]
};

interface VisualElement {
  id: string;
  tag: string;
  label: string;
  description: string;
}

const PARSABLE_TAGS = [
  { tag: '[NRO]', label: 'Clase #', description: 'Número identificador de la clase' },
  { tag: '[MODULO]', label: 'Título de la Clase', description: 'Nombre de la materia/clase' },
  { tag: '[DESCRIPCION]', label: 'Cuerpo de Texto', description: 'Descripción o contenido principal' },
  { tag: '[URL_VIDEO_VIMEO]', label: 'Video Clase', description: 'Reproductor de video embebido' },
  { tag: '[URL_GENIALLY]', label: 'Presentación', description: 'Diapositivas interactivas' },
  { tag: '[URL_ENLACES_ADJUNTOS]', label: 'Enlaces Adjuntos', description: 'Acceso a descargas' },
  { tag: '[URL_IMAGEN]', label: 'Imagen Ilustrativa', description: 'Foto o recurso visual' },
  { tag: '[CUADRO_CONCEPTUAL]', label: 'Cuadro Conceptual', description: 'Cuadro sinóptico o conceptual generado por IA' },
  { tag: '[TABLA_COMPARATIVA]', label: 'Tabla Comparativa', description: 'Tabla comparativa de conceptos clave generada por IA' },
  { tag: '[METAFORA]', label: 'Metáfora', description: 'Tarjeta explicativa con una metáfora didáctica por IA' },
  { tag: '[ANALOGIA]', description: 'Tarjeta explicativa con una analogía clara por IA', label: 'Analogía' },
  { tag: '[ILUSTRACION]', label: 'Ilustración', description: 'Gráfico, diagrama SVG o recuadro visual por IA' },
  { tag: '[CITA_AUTORIA]', label: 'Cita de Autoría', description: 'Cita destacada con autor relacionado generada por IA' }
];

const parseHtmlToVisualElements = (html: string): VisualElement[] => {
  if (!html) return [];
  const occurrences: { tag: string; index: number }[] = [];
  PARSABLE_TAGS.forEach(t => {
    let pos = html.indexOf(t.tag);
    while (pos !== -1) {
      occurrences.push({ tag: t.tag, index: pos });
      pos = html.indexOf(t.tag, pos + 1);
    }
  });
  occurrences.sort((a, b) => a.index - b.index);
  
  return occurrences.map((occ, i) => {
    const info = PARSABLE_TAGS.find(t => t.tag === occ.tag)!;
    return {
      id: `${occ.tag}-${i}-${Math.random().toString(36).substr(2, 9)}`,
      tag: occ.tag,
      label: info.label,
      description: info.description
    };
  });
};

const compileVisualElementsToHtml = (elements: VisualElement[]): string => {
  let contentHtml = elements.map(el => {
    switch (el.tag) {
      case '[NRO]':
        return `  <span style="font-size: 0.8rem; font-weight: 700; color: var(--theme-primary); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Clase [NRO]</span>`;
      case '[MODULO]':
        return `  <h3 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0; font-size: 1.5rem; font-weight: 800;">[MODULO]</h3>`;
      case '[DESCRIPCION]':
        return `  <div style="font-family: var(--font-body); color: var(--theme-text); line-height: 1.6; margin: 12px 0;">\n    <p>[DESCRIPCION]</p>\n  </div>`;
      case '[URL_VIDEO_VIMEO]':
        return `  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin: 16px 0; background: #000; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">\n    <iframe src="[URL_VIDEO_VIMEO]" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>\n  </div>`;
      case '[URL_GENIALLY]':
        return `  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin: 16px 0; background: transparent; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">\n    <iframe src="[URL_GENIALLY]" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>\n  </div>`;
      case '[URL_ENLACES_ADJUNTOS]':
        return `  <div style="margin: 16px 0;">\n    <a href="[URL_ENLACES_ADJUNTOS]" target="_blank" style="font-family: var(--font-headline); display: inline-flex; align-items: center; gap: 6px; background: var(--theme-primary); color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 0.85rem;"><span>Ver recursos de la clase</span> ➔</a>\n  </div>`;
      case '[URL_IMAGEN]':
        return `  <div style="margin: 16px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">\n    <img src="[URL_IMAGEN]" alt="Imagen de Clase" style="width: 100%; height: 240px; object-fit: cover; display: block;" />\n  </div>`;
      case '[CUADRO_CONCEPTUAL]':
        return `  <div class="block-conceptual-chart" style="margin: 20px 0;">\n    [CUADRO_CONCEPTUAL]\n  </div>`;
      case '[TABLA_COMPARATIVA]':
        return `  <div class="block-comparative-table" style="margin: 20px 0;">\n    [TABLA_COMPARATIVA]\n  </div>`;
      case '[METAFORA]':
        return `  <div class="block-metaphor" style="margin: 20px 0;">\n    [METAFORA]\n  </div>`;
      case '[ANALOGIA]':
        return `  <div class="block-analogy" style="margin: 20px 0;">\n    [ANALOGIA]\n  </div>`;
      case '[ILUSTRACION]':
        return `  <div class="block-illustration" style="margin: 20px 0;">\n    [ILUSTRACION]\n  </div>`;
      case '[CITA_AUTORIA]':
        return `  <div class="block-citation" style="margin: 20px 0;">\n    [CITA_AUTORIA]\n  </div>`;
      default:
        return '';
    }
  }).join('\n');
  
  return `<div class="visual-block-card" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 16px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">\n${contentHtml}\n</div>`;
};

const DesignPanel: React.FC<DesignPanelProps> = ({ templates, setTemplates, rows }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [selectedBaseCodeType] = useState<TemplateBlockType>('text');
  // const [lastFocusedTextareaId, setLastFocusedTextareaId] = useState<string | null>(null);
  // const [editorMode, setEditorMode] = useState<'visual' | 'code'>('visual');
  const [draggedTag, setDraggedTag] = useState<string | null>(null);
  const [draggedElementIndex, setDraggedElementIndex] = useState<number | null>(null);

  /*
  const insertPlaceholder = (tag: string) => {
    if (!lastFocusedTextareaId) return;
    const el = document.getElementById(lastFocusedTextareaId) as HTMLTextAreaElement | null;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newText = before + tag + after;

    if (lastFocusedTextareaId === 'base-code-editor-textarea') {
      updateBaseBlockCode(selectedBaseCodeType, newText);
    } else if (lastFocusedTextareaId.startsWith('block-textarea-')) {
      const blockId = lastFocusedTextareaId.replace('block-textarea-', '');
      updateBlockCode(blockId, newText);
    }

    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + tag.length;
    }, 0);
  };
  */

  const handleDropOnCanvas = (targetBlockId?: string) => {
    if (!draggedTag) return;
    const info = PARSABLE_TAGS.find(t => t.tag === draggedTag);
    if (!info) return;

    const currentHtml = targetBlockId
      ? (activeTemplate.blocks.find(b => b.id === targetBlockId)?.customCode || activeTemplate.customBlockCodes?.[activeTemplate.blocks.find(b => b.id === targetBlockId)?.type || 'text'] || '')
      : (activeTemplate.customBlockCodes?.[selectedBaseCodeType] ?? initialBlockCodes[selectedBaseCodeType] ?? '');

    const currentElements = parseHtmlToVisualElements(currentHtml);
    const newElements = [...currentElements, {
      id: `${draggedTag}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      tag: draggedTag,
      label: info.label,
      description: info.description
    }];
    const compiled = compileVisualElementsToHtml(newElements);

    if (targetBlockId) {
      updateBlockCode(targetBlockId, compiled);
    } else {
      updateBaseBlockCode(selectedBaseCodeType, compiled);
    }
    setDraggedTag(null);
  };

  const handleReorderElements = (fromIndex: number, toIndex: number, targetBlockId?: string) => {
    const currentHtml = targetBlockId
      ? (activeTemplate.blocks.find(b => b.id === targetBlockId)?.customCode || activeTemplate.customBlockCodes?.[activeTemplate.blocks.find(b => b.id === targetBlockId)?.type || 'text'] || '')
      : (activeTemplate.customBlockCodes?.[selectedBaseCodeType] ?? initialBlockCodes[selectedBaseCodeType] ?? '');

    const currentElements = parseHtmlToVisualElements(currentHtml);
    const updated = [...currentElements];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    const compiled = compileVisualElementsToHtml(updated);

    if (targetBlockId) {
      updateBlockCode(targetBlockId, compiled);
    } else {
      updateBaseBlockCode(selectedBaseCodeType, compiled);
    }
  };

  const handleDeleteElement = (index: number, targetBlockId?: string) => {
    const currentHtml = targetBlockId
      ? (activeTemplate.blocks.find(b => b.id === targetBlockId)?.customCode || activeTemplate.customBlockCodes?.[activeTemplate.blocks.find(b => b.id === targetBlockId)?.type || 'text'] || '')
      : (activeTemplate.customBlockCodes?.[selectedBaseCodeType] ?? initialBlockCodes[selectedBaseCodeType] ?? '');

    const currentElements = parseHtmlToVisualElements(currentHtml);
    const updated = [...currentElements];
    updated.splice(index, 1);
    const compiled = compileVisualElementsToHtml(updated);

    if (targetBlockId) {
      updateBlockCode(targetBlockId, compiled);
    } else {
      updateBaseBlockCode(selectedBaseCodeType, compiled);
    }
  };

  const renderVisualCanvas = (currentHtml: string, targetBlockId?: string) => {
    const visualElements = parseHtmlToVisualElements(currentHtml);

    return (
      <div className="visual-canvas-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
        {/* Draggable Markers list */}
        <div className="draggable-markers-palette" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed rgba(255, 255, 255, 0.1)',
          borderRadius: '8px'
        }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🫳 Marcadores Arrastrables (Arrastra y suelta en la hoja en blanco):
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PARSABLE_TAGS.map(t => (
              <div
                key={t.tag}
                draggable
                onDragStart={(e) => {
                  setDraggedTag(t.tag);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  setDraggedTag(t.tag);
                  setTimeout(() => {
                    setDraggedTag(t.tag);
                    const info = PARSABLE_TAGS.find(item => item.tag === t.tag);
                    if (info) {
                      const newElements = [...visualElements, {
                        id: `${t.tag}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        tag: t.tag,
                        label: info.label,
                        description: info.description
                      }];
                      const compiled = compileVisualElementsToHtml(newElements);
                      if (targetBlockId) {
                        updateBlockCode(targetBlockId, compiled);
                      } else {
                        updateBaseBlockCode(selectedBaseCodeType, compiled);
                      }
                    }
                    setDraggedTag(null);
                  }, 0);
                }}
                style={{
                  background: 'rgba(20, 184, 166, 0.08)',
                  border: '1px solid rgba(20, 184, 166, 0.25)',
                  borderRadius: '6px',
                  color: '#14b8a6',
                  fontSize: '0.7rem',
                  padding: '4px 8px',
                  cursor: 'grab',
                  fontWeight: 600,
                  transition: 'transform 0.1s'
                }}
                className="draggable-token"
                title={`${t.label}: ${t.description}`}
              >
                {t.tag} {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Blank Sheet / Visual Canvas dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDropOnCanvas(targetBlockId)}
          style={{
            background: '#ffffff',
            border: '2px dashed rgba(20, 184, 166, 0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            minHeight: '220px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative'
          }}
          className="blank-sheet-canvas"
        >
          {visualElements.length === 0 ? (
            <div style={{
              margin: 'auto',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'none',
              padding: '2rem 0'
            }}>
              <span style={{ fontSize: '2rem' }}>📄</span>
              <strong style={{ color: '#000' }}>Hoja de Maquetado en Blanco</strong>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Arrastra aquí los marcadores para armar tu diseño o haz click en ellos.</span>
            </div>
          ) : (
            visualElements.map((el, index) => {
              let innerCard = null;
              switch (el.tag) {
                case '[NRO]':
                  innerCard = <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#14b8a6' }}>CLASE # [NRO]</div>;
                  break;
                case '[MODULO]':
                  innerCard = <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2937', fontFamily: 'var(--font-headline)' }}>[MODULO] TÍTULO DE LA CLASE</div>;
                  break;
                case '[DESCRIPCION]':
                  innerCard = <div style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.4' }}>[DESCRIPCION] Cuerpo de texto explicativo o contenido de clase.</div>;
                  break;
                case '[URL_VIDEO_VIMEO]':
                  innerCard = (
                    <div style={{ background: '#f3f4f6', borderRadius: '6px', height: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '1.1rem' }}>🎥</span>
                      <span style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 600 }}>Reproductor de Video Vimeo [URL_VIDEO_VIMEO]</span>
                    </div>
                  );
                  break;
                case '[URL_GENIALLY]':
                  innerCard = (
                    <div style={{ background: '#e0e7ff', borderRadius: '6px', height: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #c7d2fe' }}>
                      <span style={{ fontSize: '1.1rem' }}>📊</span>
                      <span style={{ fontSize: '0.75rem', color: '#312e81', fontWeight: 600 }}>Presentación Genially [URL_GENIALLY]</span>
                    </div>
                  );
                  break;
                case '[URL_IMAGEN]':
                  innerCard = (
                    <div style={{ background: '#ccfbf1', borderRadius: '6px', height: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #99f6e4' }}>
                      <span style={{ fontSize: '1.1rem' }}>🖼️</span>
                      <span style={{ fontSize: '0.75rem', color: '#115e59', fontWeight: 600 }}>Imagen de Portada [URL_IMAGEN]</span>
                    </div>
                  );
                  break;
                case '[URL_ENLACES_ADJUNTOS]':
                  innerCard = (
                    <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: '6px', background: '#14b8a6', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                      Descargar Recursos [URL_ENLACES_ADJUNTOS] ➔
                    </div>
                  );
                  break;
              }

              return (
                <div
                  key={el.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedElementIndex(index);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedElementIndex !== null && draggedElementIndex !== index) {
                      handleReorderElements(draggedElementIndex, index, targetBlockId);
                      setDraggedElementIndex(null);
                    }
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    position: 'relative',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  className="visual-canvas-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '2px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>{el.label}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteElement(index, targetBlockId)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600 }}
                    >
                      Eliminar
                    </button>
                  </div>
                  {innerCard}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  const modulesOrder = Array.from(new Set(rows.map(r => r.modulo || 'Sin Clase')));

  const blocksByModule: Record<string, typeof activeTemplate.blocks> = {};
  if (activeTemplate) {
    activeTemplate.blocks.forEach(block => {
      const row = rows.find(r => r.id === block.id);
      const moduleName = row?.modulo || 'Sin Clase';
      if (!blocksByModule[moduleName]) {
        blocksByModule[moduleName] = [];
      }
      blocksByModule[moduleName].push(block);
    });
  }

  const updateActiveTemplate = (updatedTemplate: CourseTemplate) => {
    setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
  };

  const updateDesign = (field: keyof CourseDesign, value: string) => {
    if (!activeTemplate) return;
    updateActiveTemplate({
      ...activeTemplate,
      design: { ...activeTemplate.design, [field]: value }
    });
  };

  const updateBaseBlockCode = (type: TemplateBlockType, code: string) => {
    if (!activeTemplate) return;
    const currentCustomCodes = activeTemplate.customBlockCodes || { ...initialBlockCodes };
    updateActiveTemplate({
      ...activeTemplate,
      customBlockCodes: {
        ...currentCustomCodes,
        [type]: code
      }
    });
  };

  /*
  const applyBaseCodeToExistingBlocks = (type: TemplateBlockType) => {
    if (!activeTemplate) return;
    const codeToApply = activeTemplate.customBlockCodes?.[type] ?? initialBlockCodes[type];
    updateActiveTemplate({
      ...activeTemplate,
      blocks: activeTemplate.blocks.map(b => b.type === type ? { ...b, customCode: codeToApply } : b)
    });
  };
  */

  const handleTemplateNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTemplate) return;
    updateActiveTemplate({ ...activeTemplate, name: e.target.value });
  };

  const addTemplate = () => {
    const initialBlocks = rows.map((row) => {
      const type = mapFormatoToBlockType(row.formato);
      return {
        id: row.id,
        type,
        customCode: initialBlockCodes[type]
      };
    });

    const newTemplate: CourseTemplate = {
      id: Date.now().toString(),
      name: `Nueva Plantilla ${templates.length + 1}`,
      design: { ...defaultDesign },
      blocks: initialBlocks,
      customBlockCodes: { ...initialBlockCodes }
    };
    setTemplates([...templates, newTemplate]);
    setSelectedTemplateId(newTemplate.id);
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (templates.length <= 1) return;
    const newTemplates = templates.filter(t => t.id !== id);
    setTemplates(newTemplates);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(newTemplates[0].id);
    }
  };

  const updateBlockCode = (blockId: string, code: string) => {
    if (!activeTemplate) return;
    updateActiveTemplate({
      ...activeTemplate,
      blocks: activeTemplate.blocks.map(b => b.id === blockId ? { ...b, customCode: code } : b)
    });
  };

  return (
    <div className="design-panel-wrapper">
      
      {/* Sidebar: Templates List */}
      <div className="design-sidebar glass-panel">
        <div className="sidebar-header">
          <h3><LayoutTemplate size={20} className="text-primary" /> Mis Plantillas</h3>
          <button className="add-template-btn" onClick={addTemplate} title="Añadir Plantilla">
            <Plus size={18} />
          </button>
        </div>
        <div className="templates-list">
          {templates.map(template => (
            <div 
              key={template.id} 
              className={`template-item ${template.id === selectedTemplateId ? 'active' : ''}`}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              <div className="template-item-content">
                <LayoutTemplate size={16} />
                <span>{template.name}</span>
              </div>
              {templates.length > 1 && (
                <button className="delete-btn" onClick={(e) => deleteTemplate(template.id, e)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Settings Panel for Active Template */}
      {activeTemplate && (
        <div className="design-controls glass-panel">
          <div className="template-name-editor" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Nombre de la Plantilla
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={activeTemplate.name} 
                onChange={handleTemplateNameChange} 
                className="template-name-input"
                placeholder="Ej. Plantilla Principal"
                style={{ flex: 1 }}
              />
              <Pencil size={16} className="text-muted" style={{ opacity: 0.6 }} />
            </div>
          </div>

          <h3 className="section-title">
            <Palette size={18} className="text-primary" /> Colores
          </h3>
          
          <div className="control-group">
            <label>Color Primario</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.primaryColor} 
                onChange={(e) => updateDesign('primaryColor', e.target.value)}
              />
              <span>{activeTemplate.design.primaryColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="control-group">
            <label>Color Secundario</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.secondaryColor} 
                onChange={(e) => updateDesign('secondaryColor', e.target.value)}
              />
              <span>{activeTemplate.design.secondaryColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="control-group">
            <label>Fondo</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.backgroundColor} 
                onChange={(e) => updateDesign('backgroundColor', e.target.value)}
              />
              <span>{activeTemplate.design.backgroundColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="control-group">
            <label>Superficie</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.surfaceColor} 
                onChange={(e) => updateDesign('surfaceColor', e.target.value)}
              />
              <span>{activeTemplate.design.surfaceColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="control-group">
            <label>Texto</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.textColor} 
                onChange={(e) => updateDesign('textColor', e.target.value)}
              />
              <span>{activeTemplate.design.textColor.toUpperCase()}</span>
            </div>
          </div>

          <h3 className="section-title mt-4">
            <Type size={18} className="text-primary" /> Tipografía
          </h3>

          <div className="control-group">
            <label>Titulares</label>
            <select 
              className="font-select"
              value={activeTemplate.design.headlineFont}
              onChange={(e) => updateDesign('headlineFont', e.target.value)}
            >
              {fonts.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="control-group">
            <label>Cuerpo</label>
            <select 
              className="font-select"
              value={activeTemplate.design.bodyFont}
              onChange={(e) => updateDesign('bodyFont', e.target.value)}
            >
              {fonts.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <h3 className="section-title mt-4" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Palette size={18} className="text-primary" /> Estilo de Diseño
          </h3>

          <div className="control-group">
            <label>Tema Estético</label>
            <select 
              className="font-select"
              value={activeTemplate.design.themeStyle || 'modern'}
              onChange={(e) => updateDesign('themeStyle', e.target.value)}
            >
              <option value="modern">Moderno / Minimalista</option>
              <option value="classic">Clásico / Editorial</option>
              <option value="futuristic">Futurista / Tech Glow</option>
              <option value="creative">Creativo / Dinámico</option>
            </select>
          </div>

          {/* PALETTE OF DRAGGABLE TOKENS / VARIABLES */}
          <h3 className="section-title mt-4" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={18} className="text-primary" /> Marcadores Disponibles
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
            Arrastra estos marcadores a las hojas de maquetado en blanco de la derecha para diseñar tus clases:
          </p>

          <div className="draggable-markers-palette" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '0.75rem'
          }}>
            {PARSABLE_TAGS.map(t => (
              <div
                key={t.tag}
                draggable
                onDragStart={(e) => {
                  setDraggedTag(t.tag);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                style={{
                  background: 'rgba(20, 184, 166, 0.08)',
                  border: '1px solid rgba(20, 184, 166, 0.25)',
                  borderRadius: '6px',
                  color: '#14b8a6',
                  fontSize: '0.75rem',
                  padding: '8px 12px',
                  cursor: 'grab',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'transform 0.15s, background-color 0.15s'
                }}
                className="draggable-token-palette-item"
                title={`${t.label}: ${t.description}`}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 800 }}>{t.tag}</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{t.label}</span>
                </div>
                <span style={{ fontSize: '0.9rem' }}>🫴</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
            * También puedes hacer clic en un marcador para agregarlo al final del bloque seleccionado actualmente.
          </div>
        </div>
      )}

      {/* Main Workspace Area (White Sheets list replace Preview) */}
      {activeTemplate && (
        <div className="design-preview-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="preview-header">
            <h4>📄 Hojas de Maquetado (Espacio de Trabajo)</h4>
          </div>
          
          <div className="preview-content" style={{ background: '#1e1e24', padding: '2rem', overflowY: 'auto' }}>
            {activeTemplate.blocks.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '4rem',
                color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '16px',
                border: '1px dashed rgba(255,255,255,0.1)'
              }}>
                No hay clases cargadas en el Panel 1 del curso actual.
              </div>
            ) : (
              modulesOrder.map((moduleName) => {
                const moduleBlocks = blocksByModule[moduleName] || [];
                if (moduleBlocks.length === 0) return null;
                return (
                  <div key={moduleName} style={{ marginBottom: '2.5rem' }}>
                    <h3 style={{
                      fontFamily: 'var(--font-headline)',
                      color: 'var(--primary-color)',
                      fontSize: '1.25rem',
                      borderBottom: '2px solid var(--primary-color)',
                      paddingBottom: '0.5rem',
                      marginBottom: '1.5rem',
                      textAlign: 'left',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      📁 Clase: {moduleName}
                    </h3>
                    
                    {moduleBlocks.map((block) => {
                      const row = rows.find(r => r.id === block.id);
                      const label = row 
                        ? `Clase ${row.nro}: ${row.descripcion || 'Sin título'} (${getBlockTypeLabel(block.type)})`
                        : `Bloque (${getBlockTypeLabel(block.type)})`;
                      
                      const blockCode = block.customCode !== undefined 
                        ? block.customCode 
                        : (activeTemplate.customBlockCodes?.[block.type] ?? initialBlockCodes[block.type] ?? '');

                      return (
                        <div 
                          key={block.id} 
                          style={{ 
                            marginBottom: '2rem',
                            background: 'rgba(255,255,255,0.02)',
                            padding: '1.5rem',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.05)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                              {label}
                            </h4>
                            <button
                              type="button"
                              onClick={() => updateBlockCode(block.id, activeTemplate.customBlockCodes?.[block.type] ?? initialBlockCodes[block.type] ?? '')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary-color)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                              title="Restablecer este bloque al código de plantilla base"
                            >
                              Restablecer Hoja
                            </button>
                          </div>

                          {/* Quick Preset Selector for this Block Sheet */}
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>DISEÑOS RÁPIDOS:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {(LAYOUT_PRESETS[block.type] || []).map((preset) => (
                                <button
                                  key={preset.name}
                                  type="button"
                                  onClick={() => updateBlockCode(block.id, preset.code)}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    color: 'var(--primary-color)'
                                  }}
                                >
                                  {preset.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Visual Dropzone Canvas (White Sheet) */}
                          {renderVisualCanvas(blockCode, block.id)}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignPanel;
