import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Course } from '../entities/Course';

/**
 * Reemplaza los placeholders del template con los datos reales del row.
 * Se aplica tanto en el customCode de cada bloque (antes de Gemini)
 * como en el HTML final generado (después de Gemini) como seguridad extra.
 */
function replacePlaceholders(text: string, row: Record<string, any>): string {
  // 1. Vimeo / Video URL resolving
  let vimeoUrl = '';
  if (row.videoVimeo) {
    vimeoUrl = `https://player.vimeo.com/video/${extractVimeoId(row.videoVimeo)}`;
  } else {
    const fallback = row.videoDrive || row.links || '';
    if (fallback.includes('drive.google.com') || fallback.includes('vimeo.com') || fallback.match(/\.(mp4|webm|ogg|mov)/i)) {
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
    .replace(/\[NRO\]/g, row.nro || '');
}

/**
 * Extrae el ID numérico de una URL de Vimeo.
 * Soporta player.vimeo.com/video/ID, vimeo.com/ID, manage/videos/ID, etc.
 */
function extractVimeoId(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/|manage\/videos\/)?(\d+)/i);
  if (match) return match[1];
  const fallback = trimmed.match(/(?:\/|^)(\d{8,12})(?:\/|\?|$)/);
  return fallback ? fallback[1] : '';
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

  // Determine module name
  const moduleName = req.body.moduleName || (rows[0] ? rows[0].modulo : '');
 
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
        : `<label class="nav-btn-[NRO] nav-btn-finish-[NRO]" style="display: inline-block; padding: 10px 24px; background-color: #10b981; color: #ffffff; border-radius: 8px; font-family: '${headlineFont}', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: default; user-select: none;">Fin de la clase</label>`;

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
    - Debes insertar una barra de progreso al principio del contenedor (inmediatamente después del encabezado de Módulo destacado):
      \`\`\`html
      <div class="progress-bar-container-[NRO]" style="position: sticky; top: 0; left: 0; width: 100%; background-color: ${template.design?.backgroundColor || '#F9FAFB'}EE; backdrop-filter: blur(8px); height: 8px; z-index: 1000; margin-bottom: 24px; border-radius: 0 0 4px 4px; border-bottom: 1px solid rgba(0,0,0,0.04);">
        <div class="progress-bar-fill-[NRO]" style="height: 100%; background-color: ${primaryColor}; width: 0%; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 4px;"></div>
      </div>
      \`\`\`
${paginationInstructions}
      *(Nota: Para otros idiomas habilitados en el selector multilingüe, traduce los textos de los botones correspondientemente de forma nativa: 'Continuar' / 'Volver' / 'Fin de la clase' para Español, 'Continuar' / 'Voltar' / 'Fim da aula' para Portugués, 'Continue' / 'Back' / 'End of class' para Inglés).*
    - Al principio del documento (dentro de la etiqueta <style> o al principio de la etiqueta de estilos de cada idioma), inserta los inputs de tipo radio ocultos:
      ${radioInputs}
    - Agrega a la etiqueta <style> las siguientes reglas CSS:
      .class-container-[NRO] .class-page-[NRO] { display: none; }
      ${pageStyleRules}
      ${progressBarRules}
      .nav-btn-[NRO]:hover { opacity: 0.9; }
    - Agrega al final del documento (como último elemento del script, o en un script separado) el siguiente código de fallback para Moodle:
      <script>
        (function() {
          var inputs = document.querySelectorAll('input[name="class-steps-[NRO]"]');
          inputs.forEach(function(input) {
            input.addEventListener('change', function() {
              var activeStep = input.id.replace('step-radio-', '').replace('-[NRO]', '');
              document.querySelectorAll('.class-page-[NRO]').forEach(function(el) {
                var isCurrent = el.classList.contains('class-page-' + activeStep + '-[NRO]');
                el.style.display = isCurrent ? 'block' : 'none';
              });
              // update progress bar fallback
              var fill = document.querySelector('.progress-bar-fill-[NRO]');
              if (fill) {
                fill.style.width = ((activeStep / ${rows.length}) * 100) + '%';
              }
            });
          });
        })();
      </script>
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
- Envuelve TODO el HTML generado (incluyendo obligatoriamente el encabezado de Módulo destacado de la cabecera del punto 4 y todas las clases/recursos) en un único contenedor principal \`<div class="multilang-container-[NRO]" style="position: relative;">\`.
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
- Genera el contenido completo traducido (incluyendo su respectivo encabezado de Módulo destacado de cabecera traducido al idioma correspondiente, y luego todos los bloques) de forma independiente para cada uno de los idiomas habilitados, envolviendo cada versión en un contenedor con clase \`lang-content-[NRO] lang-content-[IDIOMA_LOWER]-[NRO]\` (ej. \`lang-content-[NRO] lang-content-es-[NRO]\`) y el atributo \`data-lang="IDIOMA"\`. El primer idioma debe tener \`style="display: block;"\`, y los otros \`style="display: none;"\`.
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
      return {
        ...b,
        customCode: b.customCode && correspondingRow ? replacePlaceholders(b.customCode, correspondingRow) : undefined,
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
          modulo: '[MODULO]' || 'Clase General'
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
4. **NO generes un encabezado de módulo al inicio del HTML ni al inicio de ningún bloque de texto.** El sistema ya muestra el nombre de la clase, la materia y los contenidos en un cabezal propio antes del bloque HTML. Queda TERMINANTEMENTE PROHIBIDO generar dentro de cualquier \`<div class="block-text">\` (u otro bloque) un patrón del tipo: \`<h3>N. NombreModulo</h3>\` seguido de \`<p>Materia</p>\` y \`<p>PRESENTACIÓN / TIPO</p>\`. El contenido debe comenzar directamente con el primer párrafo, imagen o sección del documento Word, sin ningún título introductorio que repita el número, nombre, materia o tipo del módulo/clase.

5. **CONTENEDOR DE CONTENIDOS (OBLIGATORIO)**: Todo el contenido de la clase (los bloques de clases, texto, videos, etc.) debe estar envuelto en un contenedor principal:
   \`<div class="content-body" style="padding: 2rem;">\`
   Esto garantiza que los bloques mantengan un margen elegante y limpio respecto a los bordes laterales y no toquen los extremos de la tarjeta principal.

6. Aplica los estilos en línea (inline CSS) usando las variables de diseño o colores directos proporcionados. Es CRÍTICO y OBLIGATORIO que todas las propiedades de tipografía (ej: \`font-family: '${headlineFont}', sans-serif;\` o \`font-family: '${bodyFont}', sans-serif;\`) sean escritas en línea (inline CSS) en el atributo \`style\` de cada etiqueta HTML relevante (como \`h1\`, \`h2\`, \`h3\`, \`h4\`, \`p\`, \`span\`, \`li\`, \`a\`, \`td\`, etc.), además de definirse en el bloque \`<style>\`. Esto previene de forma definitiva que Moodle elimine la familia tipográfica si se sanitizan las clases del bloque de estilos.
7. Usa los Códigos Base de los bloques exactamente como se proporcionan (los cuales ya tienen sus placeholders reemplazados con los datos reales), ordenados secuencialmente.
7. Si se incluye "Contenido de Word (.docx) Extraído" para una clase, debes integrar, estructurar y maquetar TODO ese contenido detalladamente dentro del bloque correspondiente (usando los estilos de fuente y colores de la plantilla de diseño de acuerdo con el tema visual seleccionado: ${themeStyle}), en lugar de usar textos de ejemplo o descripciones cortas.
   ⚠️ **PROHIBICIÓN ABSOLUTA DE RESUMEN — DERECHOS DE AUTOR Y CURADURÍA**: Queda TERMINANTEMENTE PROHIBIDO omitir, resumir, recortar, condensar o parafrasear cualquier parte del texto del documento Word. El contenido provisto tiene derechos de autor y obligaciones de curaduría que exigen fidelidad total. Debes incluir CADA párrafo, CADA oración y CADA palabra exactamente como aparece en el Word, sin excepciones. Esto aplica especialmente al formato FLIP: si el Word tiene 26 páginas, el flipbook debe tener tantas páginas como sean necesarias para incluir todo el texto completo. NO existe un límite de páginas. Además, queda ESTRICTAMENTE PROHIBIDO inventar o agregar palabras, frases, introducciones, conclusiones o explicaciones adicionales que no formen parte del documento Word original. Debes ser 100% fiel al contenido provisto.
8. Asegúrate de que todos los iframes (videos o geniallys) se rendericen correctamente. Si la URL de un Genially ([URL_GENIALLY]) o de un Video ([URL_VIDEO_VIMEO]) está vacía o no es un enlace válido (es decir, no contiene genial.ly / geni.al / cloudinary.com para Genially, o no contiene drive.google.com / vimeo.com / youtube.com para video), NO intentes renderizar un iframe vacío. En su lugar, genera un contenedor premium y elegante que informe que el recurso multimedia interactivo está "En proceso de edición y diseño" o similar, decorado con un estilo y colores que encajen con la plantilla.
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
    - **Compatibilidad Absoluta ES5 (CRÍTICO - OBLIGATORIO)**: Todo el código JavaScript generado para el cuestionario interactivo DEBE ser compatible con ES5. Queda TERMINANTEMENTE PROHIBIDO el uso de sintaxis moderna como optional chaining (\`?.\`), nullish coalescing (\`??\`), variables \`const\` o \`let\`, funciones flecha (\`=>\`), o \`Array.from\`. Usa únicamente variables \`var\`, funciones clásicas (\`function() {}\`), y bucles \`for\` tradicionales. Para recorrer colecciones DOM (como el resultado de \`querySelectorAll\`), utiliza bucles \`for\` tradicionales en lugar de \`forEach\`, ya que \`forEach\` no es soportado por \`NodeList\` en navegadores o Smart TVs antiguos.
    - **Detección y Ocultamiento Absoluto de Respuestas Correctas**: El documento Word tiene las respuestas correctas marcadas (ya sea en negrita, con la etiqueta \`<strong>\`, resaltadas, con checkmarks \`✓\`, o con un asterisco \`*\`). Debes detectar esta respuesta correcta de manera precisa, mapearla internamente en la lógica JavaScript de tu cuestionario (por ejemplo, guardando el índice de la opción correcta de cada pregunta en una estructura de datos JS), y **ELIMINAR POR COMPLETO cualquier marca visual en el HTML inicial** (como etiquetas \`<strong>\`, negrita, textos destacados, checkmarks \`✓\`, colores verdes, asteriscos, etc.) de modo que al renderizarse por primera vez y durante todo el cuestionario, todas las opciones se muestren idénticas, con el mismo formato neutro, sin revelar en absoluto cuál es la correcta.
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
    - **Shuffling/Barajado de Opciones al Cargar y Reintentar**: Añade código JavaScript que, al cargarse el cuestionario por primera vez y cada vez que el alumno haga clic en "Reintentar Cuestionario", mezcle de forma completamente aleatoria (shuffling) los nodos/elementos DOM de las opciones (A, B, C, D) para cada pregunta. Esto asegura que las opciones cambien de posición y que la opción correcta no quede siempre en el mismo lugar. Para convertir las colecciones HTML a arrays para barajado, usa bucles \`for\` tradicionales o \`Array.prototype.slice.call()\` en lugar de \`Array.from()\`. Al reintentar, limpia todas las selecciones y devuelve las opciones a su estado neutro original (sin colores ni marcas).


14. **FIDELIDAD ABSOLUTA AL TEXTO ORIGINAL (PROHIBIDO INSERTAR TEXTO PROPIO/CONVERSACIONAL)**:
    Queda TERMINANTEMENTE PROHIBIDO que agregues o inventes palabras, oraciones, introducciones, resúmenes, conclusiones o comentarios de relleno que no provengan literalmente del documento Word (.docx) o del texto provisto. No agregues saludos ("¡Bienvenidos a la clase!", etc.), ni introducciones a los temas ni conclusiones sintetizadas por ti. Maqueta e integra de manera exacta, literal e íntegra el texto proporcionado, estructurando visualmente los elementos del contenido (tablas, metáforas, cuadros sinópticos) a partir del texto y sin desviar o parafrasear las ideas originales. Si una clase o recurso no posee un documento Word (.docx) cargado o su contenido extraído está vacío, debes utilizar el Código Base provisto de la clase (que ya tiene los placeholders reemplazados con el nombre y descripción del módulo) como el contenido principal para maquetar, estructurar y traducir, sin dejarla en blanco ni colocar únicamente marcadores de posición o comentarios vacíos.

15. **FORMATO DE MAYÚSCULAS/MINÚSCULAS EN TÍTULOS (SENTENCE CASE - OBLIGATORIO)**:
    Todos los títulos principales, subtítulos y encabezados generados por la IA deben usar obligatoriamente "Sentence Case" (mayúscula únicamente en la primera letra de la primera palabra de la oración, y minúsculas en el resto de palabras, salvo nombres propios). Queda estrictamente prohibido usar "Title Case" (mayúsculas al inicio de cada palabra) en los textos generados.
    - **Acrónimos, Siglas y Números Romanos**: Debes mantener siempre en mayúsculas todas las siglas, acrónimos o abreviaciones (ej: "TTyE", "PF", "BDD", "LMS", etc.) y los números romanos (ej: "I", "II", "III", "IV", etc.), respetando su formato de mayúsculas original sin forzarlos a minúscula bajo ninguna circunstancia.
    - EJEMPLO CORRECTO: "1. Introducción general" / "Metodología de la enseñanza I" / "Intro TTyE I" / "El preparador físico (PF) en el fútbol"
    - EJEMPLO INCORRECTO: "1. Introducción General" / "Metodología De La Enseñanza I" / "Intro ttye i" / "El preparador físico (pf) en el fútbol"

16. **TAMAÑO DE IMÁGENES Y RECURSOS MULTIMEDIA — LIGHTBOX AL CLICK**:
    Todas las fotos, imágenes y videos (iframes de Vimeo, Youtube, etc.) que se inserten o maqueten en la clase deben renderizarse a un tamaño amplio y destacado. Queda estrictamente prohibido usar miniaturas o elementos pequeños y angostos dentro del contenido.
    - Las imágenes deben ocupar todo el ancho disponible del contenedor de la tarjeta, usando estilos inline como \`width: 100%; max-width: 800px; height: auto; display: block; margin: 1.5rem auto; border-radius: 8px;\`.
    - Los videos y Geniallys deben ocupar un tamaño prominente con un ancho de \`100%\` y una altura proporcional amplia (por ejemplo, envueltos en un contenedor de relación de aspecto 16:9 con \`padding-bottom: 56.25%;\`).
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
   - El encabezado de Módulo destacado al inicio de cada idioma debe lucir premium e institucional, utilizando el fondo oscuro \`#002D2B\` o marino \`#14263D\`, con el título del módulo en letras grandes en color blanco usando la tipografía \`'Bebas Neue'\` y detalles decorativos en turquesa brillante \`#00FFF4\`. Debe llevar la clase CSS \`module-header\` y la clase \`nolink\` en el título (ej: \`class="bebas-title nolink"\`), y contar con la regla CSS de respaldo \`.module-header a, #region-main .module-header a { color: inherit !important; text-decoration: none !important; }\` en el bloque \`<style>\` para evitar que el auto-enlace de Moodle esconda el título.
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
    'gemini-3.5-flash',             // Último modelo — súper rápido y disponible
    'gemini-2.5-flash',             // Fallback 1 — alta disponibilidad
    'gemini-2.0-flash',             // Fallback 2
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
            generationConfig: { temperature: 0.2 },
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
    if (lastStatus === 429 || /quota/i.test(lastErrorBody)) {
      res.status(500).json({ message: 'Límite de solicitudes a Gemini excedido. Esperá unos minutos y volvé a intentar.' });
    } else if (lastStatus === 503 || /UNAVAILABLE|high demand/i.test(lastErrorBody)) {
      res.status(503).json({ message: `El servicio de IA está saturado. Se reintentó automáticamente 3 veces en ambos modelos disponibles sin éxito. Volvé a intentar en unos minutos.` });
    } else {
      res.status(500).json({ message: `Error en Gemini API (${lastStatus}): ${lastErrorBody}` });
    }
    return;
  }

  try {
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    let html = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpiar markdown por si Gemini lo agrega igual
    html = html.replace(/^```html\n?/, '').replace(/```$/, '').trim();

    // ── Seguridad extra: reemplazar cualquier placeholder que Gemini haya dejado ──
    if (rows && rows.length > 0) {
      for (const r of rows) {
        html = replacePlaceholders(html, r);
      }
    }

    // Dynamic Google Fonts Loader fallback injection
    const fontScript = getGoogleFontsScript(headlineFont, bodyFont);
    html += fontScript;

    res.json({ html });
  } catch (error) {
    console.error('Error llamando a Gemini:', error);
    res.status(500).json({ message: 'Error al generar el HTML con IA. Verificá la configuración del servidor.' });
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
