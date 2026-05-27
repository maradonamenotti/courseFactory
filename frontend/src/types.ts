export interface CourseRow {
  id: string;
  // Panel 1
  nro: string;
  materia: string;
  modulo: string;
  descripcion: string;
  formato: string;
  links: string;
  fileName?: string;
  fileType?: string;
  htmlContent?: string;
  estado: string;
  
  // Panel 2
  videoDrive: string;
  videoVimeo: string;
  videoSubtitulos: string;
  geniallyUrl: string;
  geniallyLinkStatus: string;
  geniallyTextoStatus: string;
  geniallyDisenoStatus: string;
  estadoMultimedia: string;
  
  // Panel Aprobación
  aprobacionContenido: string;
  aprobacionMultimedia: string;
  comentariosRevisor: string;
  estadoFinal: string;
  generatedHtml?: string;
  aprobacionDiseno?: string;
  aprobacionTraduccion?: string;
}

export interface Folder {
  id: string;
  name: string;
  type: 'carrera' | 'licencia';
  parentId?: string; // pointing to carrera folder id (only for licencias)
  year?: string;
  isOfficial?: boolean;
  createdAt: string;
}

export interface Course {
  id: string;
  name: string;
  rows: CourseRow[];
  createdAt: string;
  folderId?: string;
  languages?: string;
}

export const defaultRow: Omit<CourseRow, 'id' | 'nro'> = {
  materia: '',
  modulo: '',
  descripcion: '',
  formato: 'VIDEO',
  links: '',
  htmlContent: '',
  estado: '1-NO EMPEZADO',
  videoDrive: '',
  videoVimeo: '',
  videoSubtitulos: 'NO',
  geniallyUrl: '',
  geniallyLinkStatus: 'NO EMPEZADO',
  geniallyTextoStatus: 'NO EMPEZADO',
  geniallyDisenoStatus: 'NO EMPEZADO',
  estadoMultimedia: '1-NO EMPEZADO',
  aprobacionContenido: 'PENDIENTE',
  aprobacionMultimedia: 'PENDIENTE',
  comentariosRevisor: '',
  estadoFinal: 'NO LISTO',
  generatedHtml: '',
  aprobacionDiseno: 'PENDIENTE',
};

export const multimediaStatusOptions = [
  { value: 'NO EMPEZADO', color: 'var(--status-not-started)' },
  { value: 'EN PROCESO', color: 'var(--status-in-progress)' },
  { value: 'CORREGIR', color: 'var(--status-review)' },
  { value: 'FINALIZADO', color: 'var(--status-available)' }
];

export const approvalOptions = [
  { value: 'PENDIENTE', color: 'var(--status-in-progress)' },
  { value: 'RECHAZADO', color: 'var(--status-not-started)' },
  { value: 'APROBADO', color: 'var(--status-available)' }
];

export const finalStatusOptions = [
  { value: 'NO LISTO', color: 'var(--status-not-started)' },
  { value: 'LISTO PARA MOODLE', color: 'var(--status-available)' }
];

export const DEFAULT_PASSWORD = 'Maradona2026';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  allowedPanels: number[];
  mustChangePassword: boolean;
}

export interface CourseDesign {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  headlineFont: string;
  bodyFont: string;
  themeStyle: 'modern' | 'classic' | 'futuristic' | 'creative';
}

export type TemplateBlockType = 'text' | 'video' | 'pdf' | 'cuestionario' | 'custom' | 'flip';

export const mapFormatoToBlockType = (formato: string): TemplateBlockType => {
  switch (formato?.toUpperCase()) {
    case 'VIDEO': return 'video';
    case 'TEXTO': return 'text';
    case 'CUESTIONARIO': return 'cuestionario';
    case 'GENIALLY': return 'pdf';
    case 'PDF': return 'pdf';
    case 'FLIP': return 'flip';
    case 'OTRO': return 'custom';
    default: return 'custom';
  }
};

export interface TemplateBlock {
  id: string;
  type: TemplateBlockType;
  customCode?: string;
}

export interface CourseTemplate {
  id: string;
  name: string;
  design: CourseDesign;
  blocks: TemplateBlock[];
  customBlockCodes?: Record<TemplateBlockType, string>;
}

export const defaultDesign: CourseDesign = {
  primaryColor: '#14B8A6',
  secondaryColor: '#9CA3AF',
  backgroundColor: '#F9FAFB',
  surfaceColor: '#FFFFFF',
  textColor: '#111827',
  headlineFont: 'Plus Jakarta Sans',
  bodyFont: 'Manrope',
  themeStyle: 'modern',
};

export const initialBlockCodes: Record<TemplateBlockType, string> = {
  text: `<div class="block-text" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; border-left: 5px solid var(--theme-primary); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <h3 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0;">[NRO]. [MODULO]</h3>
  <div style="font-family: var(--font-body); color: var(--theme-text); line-height: 1.6;">
    <p>[DESCRIPCION]</p>
  </div>
</div>`,

  video: `<div class="block-video" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <h3 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
    <span>🎥</span> [MODULO] - Video Clase
  </h3>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; margin-bottom: 1rem; background: #000;">
    <iframe src="[URL_VIDEO_VIMEO]" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
  </div>
  <p style="font-family: var(--font-body); color: var(--theme-secondary); font-size: 0.9rem; line-height: 1.5; margin: 0;">
    [DESCRIPCION]
  </p>
</div>`,

  pdf: `<div class="block-genially" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <h3 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
    <span>📊</span> [MODULO] - Presentación Interactiva
  </h3>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; margin-bottom: 1rem; background: transparent;">
    <iframe src="[URL_GENIALLY]" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe>
  </div>
  <p style="font-family: var(--font-body); color: var(--theme-text); line-height: 1.6; margin: 0;">
    [DESCRIPCION]
  </p>
</div>`,

  cuestionario: `<div class="block-quiz" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; border: 2px solid rgba(139, 92, 246, 0.15); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <h3 style="font-family: var(--font-headline); color: #8b5cf6; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
    <span>📝</span> Cuestionario de Evaluación
  </h3>
  <p style="font-family: var(--font-body); color: var(--theme-text); line-height: 1.6; margin-bottom: 1.5rem;">
    [DESCRIPCION]
  </p>
  <button style="font-family: var(--font-headline); background: #8b5cf6; color: #ffffff; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; font-size: 0.95rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
    <span>🚀</span> Iniciar Cuestionario
  </button>
</div>`,

  custom: `<div class="block-custom" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; border: 2px dashed var(--theme-primary);">
  <div style="font-family: var(--font-headline); color: var(--theme-primary); font-weight: bold; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
    <span>⚙️</span> Bloque Personalizado
  </div>
  <p style="font-family: var(--font-body); color: var(--theme-text); line-height: 1.6;">
    [DESCRIPCION]
  </p>
</div>`,

  flip: `<div class="block-flipbook" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--theme-surface); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden;">
  <h3 style="font-family: var(--font-headline); color: var(--theme-primary); margin-top: 0; display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid var(--theme-secondary); padding-bottom: 0.5rem; font-size: 1.25rem;">
    <span>📖</span> [MODULO] - Libro Interactivo
  </h3>
  
  <div style="position: relative; width: 100%; max-width: 720px; margin: 1.5rem auto; perspective: 1200px; font-family: var(--font-body); min-height: 420px; display: flex; justify-content: center; align-items: center;">
    <div id="book-[NRO]" style="position: relative; width: 100%; height: 100%; min-height: 420px; transition: transform 0.5s;">
      [FLIPBOOK_PAGES]
    </div>
  </div>

  <div style="display: flex; justify-content: center; align-items: center; gap: 1.5rem; margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid rgba(0,0,0,0.05);">
    <button onclick="prevPage[NRO]()" style="font-family: var(--font-headline); background: var(--theme-secondary); color: var(--theme-text); border: 1.5px solid var(--theme-secondary); padding: 0.5rem 1.25rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">◀ Anterior</button>
    <span id="page-indicator-[NRO]" style="font-family: var(--font-body); font-size: 0.9rem; color: var(--theme-text); font-weight: 700;">Página 1</span>
    <button onclick="nextPage[NRO]()" style="font-family: var(--font-headline); background: var(--theme-primary); color: #ffffff; border: none; padding: 0.5rem 1.25rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">Siguiente ▶</button>
  </div>

  <script>
    (function() {
      const book = document.getElementById('book-[NRO]');
      const pages = book ? book.querySelectorAll('.flip-page') : [];
      let currentPage = 0;
      const totalPages = pages.length;

      window.prevPage[NRO] = function() {
        if (currentPage > 0) {
          currentPage--;
          updateBook();
        }
      };

      window.nextPage[NRO] = function() {
        if (currentPage < totalPages - 1) {
          currentPage++;
          updateBook();
        }
      };

      function updateBook() {
        pages.forEach((page, index) => {
          if (index < currentPage) {
            page.style.transform = 'rotateY(-180deg)';
            page.style.zIndex = index + 1;
            page.style.visibility = 'hidden';
            page.style.opacity = '0';
          } else if (index === currentPage) {
            page.style.transform = 'rotateY(0deg)';
            page.style.zIndex = totalPages + 10;
            page.style.visibility = 'visible';
            page.style.opacity = '1';
          } else {
            page.style.transform = 'rotateY(0deg)';
            page.style.zIndex = totalPages - index;
            page.style.visibility = 'hidden';
            page.style.opacity = '0';
          }
        });
        const indicator = document.getElementById('page-indicator-[NRO]');
        if (indicator) {
          indicator.textContent = 'Página ' + (currentPage + 1) + ' / ' + totalPages;
        }
      }
      
      updateBook();
    })();
  </script>
</div>`
};

export const defaultTemplate: CourseTemplate = {
  id: 'default-1',
  name: 'Plantilla Principal',
  design: defaultDesign,
  blocks: [
    { id: 'b1', type: 'pdf', customCode: initialBlockCodes.pdf },
    { id: 'b2', type: 'video', customCode: initialBlockCodes.video },
    { id: 'b3', type: 'text', customCode: initialBlockCodes.text }
  ]
};

export interface Task {
  id: string;
  title: string;
  description: string;
  courseId?: string;
  courseName?: string;
  rowId?: string;
  rowNro?: string;
  rowModulo?: string;
  panelName: string; // e.g., 'Contenido', 'Multimedia', 'Verificación', 'Maquetado', 'Sistemas', 'Analítica'
  createdBy: string;
  createdByName: string;
  assignedTo: string;
  assignedToName: string;
  status: 'PENDIENTE' | 'EN_PROCESO' | 'RESUELTO';
  createdAt: string;
  dueDate?: string;
}

export interface LibraryItem {
  id: string;
  descripcion: string;
  formato: string; // 'VIDEO' | 'TEXTO' | 'CUESTIONARIO' | 'GENIALLY' | 'PDF' | 'OTRO'
  links: string;
  fileName?: string;
  fileType?: string;
  createdAt: string;
}

