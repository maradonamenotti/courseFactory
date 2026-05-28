import React, { useState } from 'react';
import { type CourseRow, type CourseTemplate } from '../types';
import { systemsApi } from '../services/api';
import { PlayCircle, CheckCircle, UploadCloud, Copy, Server, FileType2, Loader2, Link } from 'lucide-react';
import './SystemsPanel.css';
import { useDialog } from './CustomDialog';

interface SystemsPanelProps {
  rows: CourseRow[];
  templates: CourseTemplate[];
}

type RowProcessStatus = 'idle' | 'publishing' | 'published';

const SystemsPanel: React.FC<SystemsPanelProps> = ({ rows }) => {
  // Se consideran listos aquellos cuyo diseño ha sido APROBADO en el Panel 3 (Verificación)
  const readyRows = rows.filter(
    r => r.aprobacionDiseno === 'APROBADO' && r.generatedHtml
  );



  const [statuses, setStatuses] = useState<Record<string, RowProcessStatus>>({});
  const [moodleSettings, setMoodleSettings] = useState<Record<string, { courseName: string; courseCode: string }>>({});
  const [manuallyCopied, setManuallyCopied] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('coursefactory_manually_copied');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const { showAlert, DialogRenderer } = useDialog();

  const toggleManuallyCopied = (rowId: string) => {
    setManuallyCopied(prev => {
      const updated = { ...prev, [rowId]: !prev[rowId] };
      try {
        localStorage.setItem('coursefactory_manually_copied', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
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

  const handlePublish = async (row: CourseRow) => {
    const settings = moodleSettings[row.id];
    if (!settings || !settings.courseName || !settings.courseCode) {
      showAlert('Datos incompletos', 'Por favor completa el Nombre y Código del curso en Moodle antes de publicar.', 'warning');
      return;
    }

    setStatuses(prev => ({ ...prev, [row.id]: 'publishing' }));
    try {
      const html = row.generatedHtml || '';
      await systemsApi.publishMoodle({
        html,
        courseName: settings.courseName,
        courseCode: settings.courseCode,
      });
      setStatuses(prev => ({ ...prev, [row.id]: 'published' }));
      showAlert('✅ Publicado', `La Clase ${row.nro} ha sido publicada exitosamente en Moodle.`, 'success');
    } catch (error) {
      console.error(error);
      showAlert(
        'Error al publicar',
        error instanceof Error ? error.message : 'No se pudo publicar en Moodle. Verifica la configuración.',
        'danger'
      );
      setStatuses(prev => ({ ...prev, [row.id]: 'idle' }));
    }
  };

  const handleCopyCode = (rowId: string, html: string) => {
    navigator.clipboard.writeText(html);
    showAlert('✅ Código copiado', 'Código HTML copiado al portapapeles. Se marcó como copiado manualmente.', 'success');
    setManuallyCopied(prev => {
      const updated = { ...prev, [rowId]: true };
      try {
        localStorage.setItem('coursefactory_manually_copied', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
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
        <h3>No hay clases con diseño aprobado</h3>
        <p className="text-muted">Las clases deben ser generadas con Gemini y tener su diseño aprobado en el Panel 3 (Verificación) antes de publicarse aquí.</p>
      </div>
    );
  }

  return (
    <div className="systems-panel">
      <div className="panel-header">
        <div className="header-top">
          <div>
            <h3>Panel Sistemas / Operador</h3>
            <p className="text-muted">Exportación y Publicación de Clases con Diseño Aprobado en Moodle.</p>
          </div>
        </div>
      </div>

      <div className="systems-grid">
        {readyRows.map(row => {
          const status = statuses[row.id] || 'idle';
          const settings = moodleSettings[row.id] || { courseName: '', courseCode: '' };
          const html = row.generatedHtml || '';
          const moduleName = row.modulo || 'Sin Clase';

          return (
            <div 
              key={row.id} 
              className={`system-card ${status === 'published' || (status === 'idle' && manuallyCopied[row.id]) ? 'card-completed' : ''}`} 
              style={{ 
                borderLeft: `4px solid ${
                  status === 'published' || (status === 'idle' && manuallyCopied[row.id]) 
                    ? 'var(--status-available)' 
                    : 'var(--primary)'
                }` 
              }}
            >
              <div className="system-card-header" style={{ marginBottom: '1.25rem' }}>
                <h4>
                  <span className="badge" style={{ background: 'var(--accent)', color: '#fff', marginBottom: '0.4rem' }}>
                    {moduleName}
                  </span>
                  Clase {row.nro}: {row.descripcion || 'Sin descripción'}
                </h4>
                <div 
                  className={`systems-status-badge ${status} ${status === 'idle' && manuallyCopied[row.id] ? 'manual-copied' : ''}`} 
                  style={{ 
                    fontSize: '0.75rem', 
                    cursor: status === 'idle' ? 'pointer' : 'default' 
                  }}
                  onClick={() => status === 'idle' && toggleManuallyCopied(row.id)}
                  title={status === 'idle' ? "Clic para alternar estado de copiado manual" : undefined}
                >
                  {status === 'idle' && (
                    manuallyCopied[row.id] ? (
                      <><CheckCircle size={12} /> Copiado Manualmente</>
                    ) : (
                      'Listo para Moodle'
                    )
                  )}
                  {status === 'publishing' && <><Loader2 size={12} className="spin" /> Conectando API...</>}
                  {status === 'published' && <><CheckCircle size={12} /> Publicado</>}
                </div>
              </div>

              {/* Code Block area */}
              <div className="code-block" style={{ marginBottom: '1rem' }}>
                <div className="code-header">
                  <span><FileType2 size={14} /> clase_{row.nro}_moodle.html</span>
                  <div className="code-actions">
                    <button onClick={() => openPreview(html)} title="Vista Previa"><PlayCircle size={16} /> Preview</button>
                    <button onClick={() => handleCopyCode(row.id, html)} title="Copiar"><Copy size={16} /> Copiar</button>
                  </div>
                </div>
                <textarea readOnly value={html} className="html-textarea" style={{ height: '110px' }} />
              </div>

              {/* Moodle Connection specific to this row */}
              <div className="moodle-connection" style={{ marginTop: '0.5rem' }}>
                <h5 style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 0.5rem 0' }}>
                  <Link size={14} /> Sincronización Moodle
                </h5>
                
                <div className="moodle-inputs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="Nombre del Curso Moodle" 
                    value={settings.courseName}
                    onChange={e => updateMoodleSetting(row.id, 'courseName', e.target.value)}
                    disabled={status === 'publishing'}
                  />
                  <input 
                    type="text" 
                    placeholder="Código / ID del Curso" 
                    value={settings.courseCode}
                    onChange={e => updateMoodleSetting(row.id, 'courseCode', e.target.value)}
                    disabled={status === 'publishing'}
                  />
                </div>

                <button 
                  className={`btn-publish ${status === 'published' ? 'success' : ''}`}
                  onClick={() => handlePublish(row)}
                  disabled={status === 'publishing'}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {status === 'publishing' ? (
                    <><Loader2 size={14} className="spin" /> Publicando...</>
                  ) : status === 'published' ? (
                    <><CheckCircle size={14} /> Publicado Exitosamente</>
                  ) : (
                    <><UploadCloud size={14} /> Publicar Clase en Moodle</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {DialogRenderer}
    </div>
  );
};

export default SystemsPanel;
