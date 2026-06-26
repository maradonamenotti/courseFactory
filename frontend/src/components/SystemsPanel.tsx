import React, { useState } from 'react';
import { type CourseRow, type CourseTemplate } from '../types';
import { systemsApi } from '../services/api';
import { PlayCircle, CheckCircle, UploadCloud, Copy, Server, FileType2, Loader2, Link, ChevronDown, ChevronRight } from 'lucide-react';
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

  // Estados de agrupamiento colapsables (iguales al panel 3)
  const [collapsedMaterias, setCollapsedMaterias] = useState<Set<string>>(new Set());
  const [collapsedModulos, setCollapsedModulos] = useState<Set<string>>(new Set());

  const toggleMateria = (materia: string) => {
    setCollapsedMaterias(prev => {
      const next = new Set(prev);
      if (next.has(materia)) next.delete(materia);
      else next.add(materia);
      return next;
    });
  };

  const toggleModulo = (key: string) => {
    setCollapsedModulos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      const html = buildMoodleHtml(row.generatedHtml || '', row);
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

  /**
   * Construye el HTML completo listo para Moodle:
   * Cabezal del sistema (100% inline CSS) + contenido generado por IA.
   * Sin dependencias de React, CSS externo ni fuentes — Moodle puede sanitizar el HTML
   * pero respeta los estilos inline.
   */
  const buildMoodleHtml = (html: string, row: CourseRow): string => {
    const cleanHtml = html
      .replace(/<h3[^>]*>[\s\S]*?📖[\s\S]*?<\/h3>/i, '')
      .replace(
        /(<div[^>]*class="[^"]*block-text[^"]*"[^>]*>[\s\S]{0,300}?)<h3[^>]*>\s*\d+\.\s*[\s\S]{1,150}<\/h3>\s*<p[^>]*>[\s\S]{1,250}<\/p>\s*<p[^>]*>[\s\S]{0,150}<\/p>/gi,
        '$1'
      );

    const headerHtml = `
<div style="
  background: linear-gradient(135deg, #0d3d38 0%, #0a2e2a 100%);
  border-left: 5px solid #14b8a6;
  padding: 2rem 2.5rem;
  margin-bottom: 1.5rem;
  font-family: 'Manrope', Arial, sans-serif;
  border-radius: 12px;
">
  ${row.materia ? `<p style="margin:0 0 0.4rem 0;font-size:0.9rem;font-weight:700;color:#14b8a6;text-transform:uppercase;letter-spacing:0.12em;font-family:Arial,sans-serif;">${row.materia}</p>` : ''}
  <h2 style="margin:0 0 0.75rem 0;font-family:Impact,Arial,sans-serif;font-size:2.2rem;font-weight:900;color:#ffffff;line-height:1.05;letter-spacing:0.03em;text-transform:uppercase;">${row.modulo || ''}</h2>
  ${row.descripcion ? `<span style="font-size:0.75rem;color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:3px 12px;font-family:Arial,sans-serif;">${row.descripcion}</span>` : ''}
</div>`;

    return `${headerHtml}\n${cleanHtml}`;
  };

  const handleCopyCode = (rowId: string, html: string, row: CourseRow) => {
    const moodleHtml = buildMoodleHtml(html, row);
    navigator.clipboard.writeText(moodleHtml);
    showAlert('✅ Código copiado', 'HTML completo con cabezal copiado. Listo para pegar en Moodle.', 'success');
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

  const openPreview = (html: string, row?: { nro?: number | string; materia?: string; modulo?: string; descripcion?: string }) => {
    const headerHtml = row ? `
      <div style="
        background: linear-gradient(135deg, #0d3d38 0%, #0a2e2a 100%);
        border-left: 5px solid #14b8a6;
        padding: 2rem 2.5rem;
        margin-bottom: 1.5rem;
        font-family: 'Manrope', sans-serif;
      ">
        ${row.materia ? `<p style="margin:0 0 0.4rem 0;font-size:0.9rem;font-weight:700;color:#14b8a6;text-transform:uppercase;letter-spacing:0.12em;">${row.materia}</p>` : ''}
        <h2 style="margin:0 0 0.75rem 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:2.4rem;font-weight:400;color:#ffffff;line-height:1.05;letter-spacing:0.03em;text-transform:uppercase;">${row.modulo || ''}</h2>
        ${row.descripcion ? `<span style="font-size:0.75rem;color:rgba(255,255,255,0.55);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:3px 10px;">${row.descripcion}</span>` : ''}
      </div>
    ` : '';
    const cleanHtml = html
      .replace(/<h3[^>]*>[\s\S]*?📖[\s\S]*?<\/h3>/i, '')
      .replace(
        /(<div[^>]*class="[^"]*block-text[^"]*"[^>]*>[\s\S]{0,300}?)<h3[^>]*>\s*\d+\.\s*[\s\S]{1,150}<\/h3>\s*<p[^>]*>[\s\S]{1,250}<\/p>\s*<p[^>]*>[\s\S]{0,150}<\/p>/gi,
        '$1'
      );
    const fullDoc = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet"><style>body{margin:0;padding:2rem;background:#f9fafb;}</style></head><body>${headerHtml}${cleanHtml}</body></html>`;
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
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
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
        <div className="header-top">
          <div>
            <h3>Panel Sistemas / Operador</h3>
            <p className="text-muted">Exportación y Publicación de Clases con Diseño Aprobado en Moodle.</p>
          </div>
        </div>
      </div>

      {(() => {
        const materias = Array.from(new Set(readyRows.map(r => r.materia)));
        return materias.map((materiaName, materiaIndex) => {
          const materiaRows = readyRows.filter(r => r.materia === materiaName);
          const modulos = Array.from(new Set(materiaRows.map(r => r.modulo))).sort((a, b) => {
            const rowA = materiaRows.find(r => r.modulo === a);
            const rowB = materiaRows.find(r => r.modulo === b);
            const numA = parseInt(rowA?.moduloNumero || '0', 10);
            const numB = parseInt(rowB?.moduloNumero || '0', 10);
            const hasA = !isNaN(numA) && rowA?.moduloNumero !== '';
            const hasB = !isNaN(numB) && rowB?.moduloNumero !== '';
            if (hasA && hasB) return numA - numB;
            if (hasA && !hasB) return -1;
            if (!hasA && hasB) return 1;
            return (a || '').localeCompare(b || '');
          });
          const isMateriaCollapsed = collapsedMaterias.has(materiaName);

          return (
            <div key={`materia-${materiaIndex}`} className="materia-group" style={{ marginBottom: '2rem' }}>
              {/* Materia Header */}
              <div 
                className="materia-header" 
                onClick={() => toggleMateria(materiaName)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  background: 'rgba(0, 150, 143, 0.12)', 
                  padding: '0.8rem 1rem', 
                  borderRadius: '8px', 
                  borderBottom: '2px solid rgba(0, 150, 143, 0.25)',
                  marginBottom: isMateriaCollapsed ? '0' : '1.5rem',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}
                  onClick={(e) => { e.stopPropagation(); toggleMateria(materiaName); }}
                >
                  {isMateriaCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                </button>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  MATERIA: {materiaName || 'Sin Materia'}
                </span>
              </div>

              {!isMateriaCollapsed && modulos.map((modName, modIndex) => {
                const modRows = materiaRows.filter(r => r.modulo === modName);
                const firstRow = modRows[0];
                const moduloNumero = firstRow?.moduloNumero || '';
                const moduloKey = `${materiaName}::${modName}`;
                const isModuloCollapsed = collapsedModulos.has(moduloKey);

                return (
                  <div key={`mod-${modIndex}`} className="modulo-group" style={{ marginLeft: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Módulo Header */}
                    <div 
                      className="modulo-header" 
                      onClick={() => toggleModulo(moduloKey)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        background: 'rgba(81, 172, 192, 0.08)', 
                        padding: '0.6rem 1rem', 
                        borderRadius: '6px', 
                        borderBottom: '1px solid rgba(81, 172, 192, 0.15)',
                        marginBottom: isModuloCollapsed ? '0' : '1.5rem',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary-hover)', display: 'flex', alignItems: 'center' }}
                        onClick={(e) => { e.stopPropagation(); toggleModulo(moduloKey); }}
                      >
                        {isModuloCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {moduloNumero && (
                        <span style={{
                          background: 'var(--primary)', color: '#fff',
                          borderRadius: '6px', padding: '2px 8px',
                          fontSize: '0.72rem', fontWeight: 800, flexShrink: 0,
                          marginLeft: '0.25rem', marginRight: '0.25rem'
                        }}>
                          #{moduloNumero}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        CLASE: {modName || 'Sin Clase'}
                      </span>
                    </div>

                    {(() => {
                      const mainReadyRow = modRows.find(r => r.aprobacionDiseno === 'APROBADO' && r.generatedHtml);
                      if (!mainReadyRow) return null;
                      
                      const row = mainReadyRow;
                      const status = statuses[row.id] || 'idle';
                      const settings = moodleSettings[row.id] || { courseName: '', courseCode: '' };
                      const html = row.generatedHtml || '';
                      const moduleName = row.modulo || 'Sin Clase';

                      return (
                        <div className="systems-row-layout">
                          <div 
                            className={`system-card-horizontal ${status === 'published' || (status === 'idle' && manuallyCopied[row.id]) ? 'card-completed' : ''}`} 
                            style={{ 
                              borderLeft: `4px solid ${
                                status === 'published' || (status === 'idle' && manuallyCopied[row.id]) 
                                  ? 'var(--status-available)' 
                                  : 'var(--primary)'
                              }` 
                            }}
                          >
                            {/* Columna Izquierda: Información de Clase y Estado */}
                            <div className="system-col-info">
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <span className="badge" style={{ background: 'var(--accent)', color: '#fff', marginBottom: '0.4rem' }}>
                                  {row.materia || 'Sin Materia'}
                                </span>
                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.3 }}>
                                  {row.moduloNumero && (
                                    <span style={{
                                      background: 'var(--primary)',
                                      color: '#fff',
                                      borderRadius: '4px',
                                      padding: '2px 6px',
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                      marginRight: '0.5rem',
                                      display: 'inline-block',
                                      verticalAlign: 'middle'
                                    }}>
                                      #{row.moduloNumero}
                                    </span>
                                  )}
                                  <span style={{ verticalAlign: 'middle' }}>{moduleName}</span>
                                </h4>
                              </div>
                              
                              <div 
                                className={`systems-status-badge ${status} ${status === 'idle' && manuallyCopied[row.id] ? 'manual-copied' : ''}`} 
                                style={{ 
                                  fontSize: '0.75rem', 
                                  cursor: status === 'idle' ? 'pointer' : 'default',
                                  width: 'fit-content'
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

                            {/* Columna Central: Bloque de Código HTML */}
                            <div className="system-col-code">
                              <div className="code-block">
                                <div className="code-header">
                                  <span><FileType2 size={14} /> clase_{row.nro}_moodle.html</span>
                                  <div className="code-actions">
                                    <button onClick={() => openPreview(html, row)} title="Vista Previa"><PlayCircle size={16} /> Preview</button>
                                    <button onClick={() => handleCopyCode(row.id, html, row)} title="Copiar"><Copy size={16} /> Copiar</button>
                                  </div>
                                </div>
                                <textarea readOnly value={html} className="html-textarea" />
                              </div>
                            </div>

                            {/* Columna Derecha: Sincronización Moodle */}
                            <div className="system-col-moodle">
                              <div className="moodle-connection">
                                <div>
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
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          );
        });
      })()}
      {DialogRenderer}
    </div>
  );
};

export default SystemsPanel;
