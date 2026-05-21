import React, { useState } from 'react';
import { type CourseRow, type CourseTemplate } from '../types';
import { Bot, PlayCircle, CheckCircle, UploadCloud, Copy, Server, FileType2, Loader2, Link } from 'lucide-react';
import './SystemsPanel.css';
import { useDialog } from './CustomDialog';

interface SystemsPanelProps {
  rows: CourseRow[];
  templates: CourseTemplate[];
}

type RowProcessStatus = 'idle' | 'generating' | 'generated' | 'publishing' | 'published';

const SystemsPanel: React.FC<SystemsPanelProps> = ({ rows, templates }) => {
  // Se consideran listos aquellos que han sido aprobados en el Panel 3
  const readyRows = rows.filter(
    r => r.aprobacionContenido === 'APROBADO' && r.aprobacionMultimedia === 'APROBADO'
  );

  const [statuses, setStatuses] = useState<Record<string, RowProcessStatus>>({});
  const [moodleSettings, setMoodleSettings] = useState<Record<string, { courseName: string; courseCode: string }>>({});
  const [generatedHtml, setGeneratedHtml] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
  const { showAlert, DialogRenderer } = useDialog();

  const handleGenerate = async (row: CourseRow) => {
    if (!apiKey) {
      showAlert('API Key requerida', 'Por favor ingresa tu API Key de Gemini para continuar.', 'warning');
      return;
    }

    setStatuses(prev => ({ ...prev, [row.id]: 'generating' }));
    
    try {
      const templateId = selectedTemplate[row.id] || templates[0]?.id;
      const template = templates.find(t => t.id === templateId) || templates[0];
      
      const prompt = `
Eres un experto desarrollador web creando contenido HTML estructurado para Moodle.
Tu objetivo es generar el HTML final de un curso basándote en la información del contenido y la plantilla proporcionada.

**CONTENIDO DEL CURSO**
- Módulo/Título: ${row.modulo}
- Descripción/Texto: ${row.descripcion}
- URL Video Vimeo: ${row.videoVimeo || 'No aplica'}
- Archivos/Enlaces adjuntos: ${row.links || 'No aplica'}
- Formato Principal: ${row.formato}

**PLANTILLA SELECCIONADA: ${template?.name || 'Base'}**
- Color Principal: ${template?.design.primaryColor}
- Color Secundario: ${template?.design.secondaryColor}
- Fondo: ${template?.design.backgroundColor}
- Color de Superficie (Tarjetas): ${template?.design.surfaceColor}
- Color de Texto: ${template?.design.textColor}
- Fuente para Títulos: ${template?.design.headlineFont}
- Fuente para Cuerpo: ${template?.design.bodyFont}

**ESTRUCTURA DE BLOQUES ESPERADA (en este orden estricto)**
${template?.blocks.map((b, i) => `${i + 1}. Tipo: ${b.type}${b.customCode ? ` | Código Base: \n${b.customCode}` : ''}`).join('\n')}

**INSTRUCCIONES CRÍTICAS**
1. Genera SOLO código HTML válido y semántico.
2. NO devuelvas markdown, NO uses \`\`\`html, NO devuelvas explicaciones. Solo el HTML raw.
3. El HTML debe estar envuelto en un <div class="coursefactory-content">.
4. Aplica los estilos en línea (inline CSS) o usa un tag <style> al inicio con las variables de diseño.
5. Reemplaza los bloques de tipo "video" por iframes de Vimeo responsivos (aspect-ratio 16/9) incrustados de forma correcta.
6. Los bloques de tipo "text" deben contener la descripción formateada con jerarquía (h2, p).
7. Si un bloque es "custom", usa el "Código Base" proporcionado e inyéctalo en la estructura final.
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
          }
        })
      });

      if (!response.ok) {
        throw new Error('Error al conectar con Gemini API');
      }

      const data = await response.json();
      let htmlOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Limpiar output si Gemini devuelve markdown por error
      htmlOutput = htmlOutput.replace(/^```html\n?/, '').replace(/```$/, '').trim();

      setGeneratedHtml(prev => ({ ...prev, [row.id]: htmlOutput }));
      setStatuses(prev => ({ ...prev, [row.id]: 'generated' }));
    } catch (error) {
      console.error(error);
      showAlert('Error de generación', 'Error en la generación con IA. Revisa la consola o tu API Key.', 'danger');
      setStatuses(prev => ({ ...prev, [row.id]: 'idle' }));
    }
  };

  const updateMoodleSetting = (rowId: string, field: 'courseName' | 'courseCode', value: string) => {
    setMoodleSettings(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || { courseName: '', courseCode: '' }),
        [field]: value
      }
    }));
  };

  const handlePublish = (rowId: string) => {
    const settings = moodleSettings[rowId];
    if (!settings || !settings.courseName || !settings.courseCode) {
      showAlert('Datos incompletos', 'Por favor completa el Nombre y Código del curso en Moodle antes de publicar.', 'warning');
      return;
    }

    setStatuses(prev => ({ ...prev, [rowId]: 'publishing' }));
    setTimeout(() => {
      setStatuses(prev => ({ ...prev, [rowId]: 'published' }));
    }, 2000);
  };

  const handleCopyCode = (html: string) => {
    navigator.clipboard.writeText(html);
    showAlert('✅ Código copiado', 'Código HTML copiado al portapapeles. Puedes pegarlo manualmente en Moodle.', 'success');
  };

  const openPreview = (html: string) => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    }
  };

  if (readyRows.length === 0) {
    return (
      <div className="panel-container empty-state animate-fade-in">
        <Server size={48} className="text-muted" />
        <h3>No hay contenidos listos para procesar</h3>
        <p className="text-muted">Los módulos deben ser aprobados en el Panel 3 (Verificación) antes de llegar aquí.</p>
      </div>
    );
  }

  return (
    <div className="systems-panel">
      <div className="panel-header">
        <div className="header-top">
          <div>
            <h3>Panel Sistemas / Operador</h3>
            <p className="text-muted">Generación con IA, Exportación HTML y Conexión con Moodle.</p>
          </div>
          <div className="api-key-container">
            <label htmlFor="geminiApiKey" className="text-sm text-muted">Gemini API Key:</label>
            <input 
              id="geminiApiKey"
              type="password" 
              placeholder="AIzaSy..." 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              className="api-key-input"
            />
          </div>
        </div>
      </div>

      <div className="systems-grid">
        {readyRows.map(row => {
          const status = statuses[row.id] || 'idle';
          const settings = moodleSettings[row.id] || { courseName: '', courseCode: '' };
          const html = generatedHtml[row.id] || '';

          return (
            <div key={row.id} className={`system-card status-${status}`}>
              <div className="system-card-header">
                <h4>
                  <span className="badge">Módulo {row.nro}</span>
                  {row.modulo}
                </h4>
                <div className={`status-indicator ${status}`}>
                  {status === 'idle' && 'Pendiente de Generación'}
                  {status === 'generating' && <><Loader2 size={14} className="spin" /> Generando IA...</>}
                  {status === 'generated' && <><CheckCircle size={14} /> Listo para Moodle</>}
                  {status === 'publishing' && <><Loader2 size={14} className="spin" /> Conectando API...</>}
                  {status === 'published' && <><UploadCloud size={14} /> Publicado</>}
                </div>
              </div>

              <p className="row-desc">{row.descripcion}</p>

              {status === 'idle' && (
                <div className="generate-section">
                  <div className="template-selector">
                    <label>Seleccionar Plantilla de Diseño:</label>
                    <select 
                      value={selectedTemplate[row.id] || templates[0]?.id || ''}
                      onChange={(e) => setSelectedTemplate(prev => ({...prev, [row.id]: e.target.value}))}
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <button className="btn-generate" onClick={() => handleGenerate(row)}>
                    <Bot size={18} /> Procesar con Gemini IA
                  </button>
                </div>
              )}

              {status === 'generating' && (
                <div className="loading-state">
                  <Bot size={32} className="pulse text-primary" />
                  <p>Gemini IA está analizando los contenidos y el diseño para estructurar el HTML del curso...</p>
                </div>
              )}

              {(status === 'generated' || status === 'publishing' || status === 'published') && (
                <div className="generated-section animate-fade-in">
                  
                  <div className="code-block">
                    <div className="code-header">
                      <span><FileType2 size={14} /> output_moodle.html</span>
                      <div className="code-actions">
                        <button onClick={() => openPreview(html)} title="Vista Previa"><PlayCircle size={16} /> Preview</button>
                        <button onClick={() => handleCopyCode(html)} title="Copiar"><Copy size={16} /> Copiar</button>
                      </div>
                    </div>
                    <textarea readOnly value={html} className="html-textarea" />
                  </div>

                  <div className="moodle-connection">
                    <h5><Link size={16} /> Conexión a Moodle</h5>
                    <p className="helper-text">
                      Puedes copiar el código arriba y pegarlo manualmente en tu Moodle, o ingresa las credenciales del curso para publicarlo automáticamente vía API.
                    </p>
                    
                    <div className="moodle-inputs">
                      <input 
                        type="text" 
                        placeholder="Nombre del Curso en Moodle" 
                        value={settings.courseName}
                        onChange={e => updateMoodleSetting(row.id, 'courseName', e.target.value)}
                        disabled={status !== 'generated'}
                      />
                      <input 
                        type="text" 
                        placeholder="Código / ID del Curso" 
                        value={settings.courseCode}
                        onChange={e => updateMoodleSetting(row.id, 'courseCode', e.target.value)}
                        disabled={status !== 'generated'}
                      />
                    </div>

                    <button 
                      className={`btn-publish ${status === 'published' ? 'success' : ''}`}
                      onClick={() => handlePublish(row.id)}
                      disabled={status !== 'generated'}
                    >
                      {status === 'publishing' ? (
                        <><Loader2 size={18} className="spin" /> Sincronizando con Moodle...</>
                      ) : status === 'published' ? (
                        <><CheckCircle size={18} /> Publicado Exitosamente</>
                      ) : (
                        <><UploadCloud size={18} /> Conectar y Publicar en Moodle</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {DialogRenderer}
    </div>
  );
};

export default SystemsPanel;
