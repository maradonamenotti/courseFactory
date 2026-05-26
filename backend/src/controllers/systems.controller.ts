import { Request, Response } from 'express';

/**
 * Reemplaza los placeholders del template con los datos reales del row.
 * Se aplica tanto en el customCode de cada bloque (antes de Gemini)
 * como en el HTML final generado (después de Gemini) como seguridad extra.
 */
function replacePlaceholders(text: string, row: Record<string, string>): string {
  const vimeoUrl = row.videoVimeo
    ? `https://player.vimeo.com/video/${extractVimeoId(row.videoVimeo)}`
    : '';
  return text
    .replace(/\[URL_VIDEO_VIMEO\]/g, vimeoUrl || row.videoVimeo || '')
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

  if (!row || !template) {
    res.status(400).json({ message: 'Se requieren los datos del row y la plantilla' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ message: 'GEMINI_API_KEY no configurada en el servidor' });
    return;
  }

  // ── Reemplazar placeholders en el customCode de cada bloque ANTES de enviarlo a Gemini ──
  const blocksWithRealData = (template.blocks || []).map((b: { type: string; customCode?: string }) => ({
    ...b,
    customCode: b.customCode ? replacePlaceholders(b.customCode, row) : undefined,
  }));

  const prompt = `
Eres un experto desarrollador web creando contenido HTML estructurado para Moodle.
Tu objetivo es generar el HTML final de un curso basándote en la información del contenido y la plantilla proporcionada.

**CONTENIDO DEL CURSO**
- Módulo/Título: ${row.modulo}
- Descripción/Texto: ${row.descripcion}
- URL Video Vimeo (player embed): ${row.videoVimeo ? `https://player.vimeo.com/video/${extractVimeoId(row.videoVimeo)}` : 'No aplica'}
- Archivos/Enlaces adjuntos: ${row.links || 'No aplica'}
- Formato Principal: ${row.formato}

**PLANTILLA SELECCIONADA: ${template.name || 'Base'}**
- Color Principal: ${template.design?.primaryColor}
- Color Secundario: ${template.design?.secondaryColor}
- Fondo: ${template.design?.backgroundColor}
- Color de Superficie (Tarjetas): ${template.design?.surfaceColor}
- Color de Texto: ${template.design?.textColor}
- Fuente para Títulos: ${template.design?.headlineFont}
- Fuente para Cuerpo: ${template.design?.bodyFont}

**ESTRUCTURA DE BLOQUES ESPERADA (en este orden estricto)**
${blocksWithRealData.map((b: { type: string; customCode?: string }, i: number) => `${i + 1}. Tipo: ${b.type}${b.customCode ? ` | Código Base:\n${b.customCode}` : ''}`).join('\n')}

**INSTRUCCIONES CRÍTICAS**
1. Genera SOLO código HTML válido y semántico.
2. NO devuelvas markdown, NO uses \`\`\`html, NO devuelvas explicaciones. Solo el HTML raw.
3. El HTML debe estar envuelto en un <div class="coursefactory-content">.
4. Aplica los estilos en línea (inline CSS) usando las variables de diseño proporcionadas.
5. Si el Código Base de un bloque de tipo "video" ya contiene un iframe con la URL del video, úsalo TAL CUAL sin modificarlo.
6. Los bloques de tipo "text" deben contener la descripción formateada con jerarquía (h2, p).
7. Si un bloque es "custom", usa el "Código Base" proporcionado sin alterar las URLs.
8. NUNCA uses placeholders como [URL_VIDEO_VIMEO] en el HTML final. Usa siempre la URL real del video.
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
    html = replacePlaceholders(html, row);

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
    const endpoint = `${moodleUrl}/webservice/rest/server.php`;
    const params = new URLSearchParams({
      wstoken: moodleToken,
      wsfunction: 'core_course_update_courses',
      moodlewsrestformat: 'json',
      'courses[0][shortname]': courseCode,
      'courses[0][fullname]': courseName,
      'courses[0][summary]': html,
      'courses[0][summaryformat]': '1', // 1 = HTML
    });

    const moodleRes = await fetch(`${endpoint}?${params.toString()}`, { method: 'POST' });
    const result = await moodleRes.json();

    res.json({ success: true, moodleResponse: result });
  } catch (error) {
    console.error('Error conectando a Moodle:', error);
    res.status(500).json({ message: 'Error al publicar en Moodle' });
  }
};
