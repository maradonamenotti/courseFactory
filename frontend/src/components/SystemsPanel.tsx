import React, { useState } from 'react';
import { type CourseRow, type CourseTemplate } from '../types';
import { systemsApi } from '../services/api';
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
  const { showAlert, DialogRenderer } = useDialog();

  const handleGenerate = async (row: CourseRow) => {
    setStatuses(prev => ({ ...prev, [row.id]: 'generating' }));
    
    try {
      const templateId = selectedTemplate[row.id] || templates[0]?.id;
      const template = templates.find(t => t.id === templateId) || templates[0];

      const { html: htmlOutput } = await systemsApi.generateHtml({ row, template });

      setGeneratedHtml(prev => ({ ...prev, [row.id]: htmlOutput }));
      setStatuses(prev => ({ ...prev, [row.id]: 'generated' }));
    } catch (error) {
      console.error(error);
      showAlert('Error de generación', 'Error al generar el HTML con IA. Verificá la configuración del servidor.', 'danger');
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

  const handlePublish = async (rowId: string) => {
    const settings = moodleSettings[rowId];
    if (!settings || !settings.courseName || !settings.courseCode) {
      showAlert('Datos incompletos', 'Por favor completa el Nombre y Código del curso en Moodle antes de publicar.', 'warning');
      return;
    }

    setStatuses(prev => ({ ...prev, [rowId]: 'publishing' }));
    try {
      const html = generatedHtml[rowId] || '';
      await systemsApi.publishMoodle({
        html,
        courseName: settings.courseName,
        courseCode: settings.courseCode,
      });
      setStatuses(prev => ({ ...prev, [rowId]: 'published' }));
      showAlert('✅ Publicado', 'El contenido ha sido publicado exitosamente en Moodle.', 'success');
    } catch (error) {
      console.error(error);
      showAlert(
        'Error al publicar',
        error instanceof Error ? error.message : 'No se pudo publicar en Moodle. Verifica la configuración.',
        'danger'
      );
      setStatuses(prev => ({ ...prev, [rowId]: 'generated' }));
    }
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
