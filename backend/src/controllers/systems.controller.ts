import { Request, Response } from 'express';

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

  const prompt = `
Eres un experto desarrollador web creando contenido HTML estructurado para Moodle.
Tu objetivo es generar el HTML final de un curso basándote en la información del contenido y la plantilla proporcionada.

**CONTENIDO DEL CURSO**
- Módulo/Título: ${row.modulo}
- Descripción/Texto: ${row.descripcion}
- URL Video Vimeo: ${row.videoVimeo || 'No aplica'}
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
${template.blocks?.map((b: { type: string; customCode?: string }, i: number) => `${i + 1}. Tipo: ${b.type}${b.customCode ? ` | Código Base:\n${b.customCode}` : ''}`).join('\n')}

**INSTRUCCIONES CRÍTICAS**
1. Genera SOLO código HTML válido y semántico.
2. NO devuelvas markdown, NO uses \`\`\`html, NO devuelvas explicaciones. Solo el HTML raw.
3. El HTML debe estar envuelto en un <div class="coursefactory-content">.
4. Aplica los estilos en línea (inline CSS) usando las variables de diseño.
5. Reemplaza los bloques de tipo "video" por iframes de Vimeo responsivos (aspect-ratio 16/9).
6. Los bloques de tipo "text" deben contener la descripción formateada con jerarquía (h2, p).
7. Si un bloque es "custom", usa el "Código Base" proporcionado.
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
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
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    let html = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpiar markdown por si Gemini lo agrega igual
    html = html.replace(/^```html\n?/, '').replace(/```$/, '').trim();

    res.json({ html });
  } catch (error) {
    console.error('Error llamando a Gemini:', error);
    res.status(500).json({ message: 'Error al generar el HTML con IA' });
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
