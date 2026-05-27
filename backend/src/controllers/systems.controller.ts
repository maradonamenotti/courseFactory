import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Course } from '../entities/Course';

/**
 * Reemplaza los placeholders del template con los datos reales del row.
 * Se aplica tanto en el customCode de cada bloque (antes de Gemini)
 * como en el HTML final generado (después de Gemini) como seguridad extra.
 */
function replacePlaceholders(text: string, row: Record<string, any>): string {
  const vimeoUrl = row.videoVimeo
    ? `https://player.vimeo.com/video/${extractVimeoId(row.videoVimeo)}`
    : (row.videoDrive || row.links || '');
  const urlGenially = row.geniallyUrl || row.links || '';
  const urlEnlacesAdjuntos = row.links || '';
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
 
  let multilangPromptRule = '';
  if (languagesList.length > 1) {
    multilangPromptRule = `
12. **SOPORTE MULTILINGÜE (Idiomas activos: ${languagesList.join(', ')})**:
El curso requiere soporte para múltiples idiomas: ${languagesList.join(', ')}.
Para cada bloque de contenido (clase/recurso), DEBES generar la traducción completa del contenido de Word (.docx) cargado para cada uno de los idiomas activos:
- Envuelve el bloque de contenido en un contenedor principal \`<div class="multilang-container" style="position: relative;">\`.
- Al inicio de este contenedor, inserta una barra de selección de idioma HTML con botones estilizados (ej: con fondo de color primario \`${template.design?.primaryColor}\` para la pestaña activa, y fondo transparente para las inactivas) con el siguiente formato exacto:
  \`\`\`html
  <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 8px;">
    ${languagesList.map((lang, index) => `
    <button onclick="toggleLang_[NRO]('${lang}')" class="lang-btn-[NRO]" data-lang="${lang}" style="padding: 6px 12px; border-radius: 6px; border: 1.5px solid ${index === 0 ? template.design?.primaryColor : template.design?.secondaryColor}; background: ${index === 0 ? template.design?.primaryColor : 'transparent'}; color: ${index === 0 ? '#ffffff' : template.design?.textColor}; cursor: pointer; font-family: '${template.design?.headlineFont}', sans-serif; font-size: 0.8rem; font-weight: 700; transition: all 0.2s;">${lang}</button>
    `).join('')}
  </div>
  \`\`\`
- Genera el contenido completo traducido de forma independiente para cada uno de los idiomas habilitados, envolviendo cada traducción en un contenedor con clase \`lang-content-[NRO]\` y el atributo \`data-lang="IDIOMA"\`. El primer idioma de la lista debe estar visible (\`display: block;\`), y el resto de idiomas deben estar ocultos por defecto (\`display: none;\`).
  \`\`\`html
  <div class="lang-content-[NRO]" data-lang="ES" style="display: block;">
    <!-- Contenido traducido al Español -->
  </div>
  <div class="lang-content-[NRO]" data-lang="PT" style="display: none;">
    <!-- Contenido traducido al Portugués -->
  </div>
  <!-- etc. -->
  \`\`\`
- Agrega al final del bloque de contenido la etiqueta \`<script>\` autocontenida que controle el cambio de idioma dinámico al hacer clic en los botones correspondientes:
  \`\`\`html
  <script>
    (function() {
      window.toggleLang_[NRO] = function(lang) {
        document.querySelectorAll('.lang-content-[NRO]').forEach(function(el) {
          el.style.display = el.getAttribute('data-lang') === lang ? 'block' : 'none';
        });
        document.querySelectorAll('.lang-btn-[NRO]').forEach(function(btn) {
          var active = btn.getAttribute('data-lang') === lang;
          btn.style.background = active ? '${template.design?.primaryColor || '#14b8a6'}' : 'transparent';
          btn.style.color = active ? '#ffffff' : '${template.design?.textColor || '#111827'}';
          btn.style.borderColor = active ? '${template.design?.primaryColor || '#14b8a6'}' : '${template.design?.secondaryColor || '#9ca3af'}';
        });
      };
    })();
  </script>
  \`\`\`
- Asegúrate de que las traducciones sean fieles, de calidad profesional y bien formateadas utilizando los mismos estilos de la plantilla.
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
3. El HTML debe estar envuelto en un <div class="coursefactory-content" style="background-color: ${template.design?.backgroundColor}; color: ${template.design?.textColor}; font-family: '${template.design?.bodyFont}', sans-serif; padding: 2rem; border-radius: 16px;">.
4. Genera un encabezado de Módulo destacado al inicio con el título "${moduleName}" usando la fuente de títulos '${template.design?.headlineFont}' y el color principal ${template.design?.primaryColor}.
5. Aplica los estilos en línea (inline CSS) usando las variables de diseño o colores directos proporcionados.
6. Usa los Códigos Base de los bloques exactamente como se proporcionan (los cuales ya tienen sus placeholders reemplazados con los datos reales), ordenados secuencialmente.
7. Si se incluye "Contenido de Word (.docx) Extraído" para una clase, debes integrar, estructurar y maquetar TODO ese contenido detalladamente dentro del bloque correspondiente (usando los estilos de fuente y colores de la plantilla de diseño de acuerdo con el tema visual seleccionado: ${themeStyle}), en lugar de usar textos de ejemplo o descripciones cortas.
8. Asegúrate de que todos los iframes (videos o geniallys) se rendericen correctamente y se muestren dentro de sus contenedores con los estilos del bloque.
9. Transforma todas las tablas, listas y textos simples del documento Word en componentes web hermosos con CSS inline alineados al estilo estético "${themeStyle}".
10. **REEMPLAZO DE MARCADORES INTELIGENTES IA:** Si el Código Base de un bloque contiene alguno de los siguientes marcadores especiales, el modelo DEBE generar el contenido correspondiente extrayéndolo/creándolo a partir del "Contenido de Word" de esa clase e insertarlo usando estructuras HTML/CSS pulidas y hermosas alineadas con el tema visual (estilo: ${themeStyle}):
    - **[CUADRO_CONCEPTUAL]**: Genera un mapa o cuadro sinóptico/conceptual didáctico interactivo estructurado con cajas conectadas mediante flexbox o grid, colores de acento coherentes, bordes finos, etc.
    - **[TABLA_COMPARATIVA]**: Genera una tabla comparativa HTML bien diagramada que confronte de 2 a 4 conceptos clave descritos en el contenido de la clase.
    - **[METAFORA]**: Genera una tarjeta de metáfora didáctica destacada, utilizando un emoji grande y una explicación poética/visual que ayude a memorizar o entender un concepto abstracto del tema.
    - **[ANALOGIA]**: Genera un recuadro explicativo con una analogía práctica de la vida real que aclare el concepto clave de la clase.
    - **[ILUSTRACION]**: Dibuja un gráfico explicativo o diagrama conceptual representativo en formato SVG nativo en línea, o crea un diseño visual geométrico/infografía enriquecida con CSS e iconos/emojis.
    - **[CITA_AUTORIA]**: Genera un blockquote de cita sumamente premium y estilizado que resalte una frase célebre relevante del tema junto con el nombre del autor correspondiente.
11. **PAGINACIÓN PARA FLIPBOOK (formato FLIP)**: Si el Código Base de un bloque es de tipo \`flip\` o contiene el marcador \`[FLIPBOOK_PAGES]\`, debes estructurar el contenido del documento Word (.docx) cargado para esa clase dividiéndolo de forma lógica en múltiples páginas consecutivas (entre 3 y 6 páginas en total, según la cantidad de texto). Cada página debe ser devuelta como un elemento HTML con el siguiente formato y estilos en línea obligatorios:
    \`<div class="flip-page" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; display: flex; flex-direction: column; justify-content: flex-start; box-sizing: border-box; background: ${template.design?.surfaceColor || '#ffffff'}; padding: 2rem; transition: transform 0.6s, opacity 0.3s; backface-visibility: hidden; transform-style: preserve-3d; border-radius: 8px; border: 1px solid rgba(0,0,0,0.06); overflow-y: auto;">\`
      <!-- Contenido maquetado de la página (títulos, párrafos, listas, etc.) -->
    \`</div>\`
    Reemplaza por completo el marcador \`[FLIPBOOK_PAGES]\` con todas las páginas generadas de forma consecutiva dentro del contenedor del libro. Asegúrate de estructurar el texto de manera que se lea cómodamente por páginas individuales.
${multilangPromptRule}
   `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Gemini API error ${response.status}:`, errorBody);
      if (response.status === 429) {
        res.status(500).json({ message: 'Límite de solicitudes a Gemini excedido. Esperá unos segundos y volvé a intentar.' });
      } else {
        res.status(500).json({ message: `Error en Gemini API (${response.status}): ${errorBody}` });
      }
      return;
    }

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
