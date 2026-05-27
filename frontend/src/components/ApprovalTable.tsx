import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, ClipboardList, PlayCircle, X, ChevronDown, ChevronRight, Sparkles, Check, RefreshCw, Loader2, Eye, EyeOff, Minimize2, Maximize2 } from 'lucide-react';
import { type CourseRow, type CourseTemplate, approvalOptions, finalStatusOptions } from '../types';
import { systemsApi, filesApi } from '../services/api';
import { useDialog } from './CustomDialog';

const extractVimeoId = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|channels\/[^\/]+\/|groups\/[^\/]+\/|manage\/videos\/|)?(\d+)/i);
  if (match) return match[1];
  const fallback = trimmed.match(/(?:\/|^)(\d{8,12})(?:\/|\?|$)/);
  return fallback ? fallback[1] : null;
};

interface VideoPreviewModalProps {
  vimeoId: string;
  title: string;
  onClose: () => void;
}

const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({ vimeoId, title, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 15, 25, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }} onClick={onClose}>
      <div 
        className="glass-panel animate-fade-in" 
        style={{
          width: '100%',
          maxWidth: '800px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border)'
        }}>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 600 }}>
            🎬 Vista Previa de Video: {title}
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '6px',
              borderRadius: '6px',
              transition: 'background-color 0.2s, color 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000' }}>
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 0
            }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};

interface ApprovalTableProps {
  rows: CourseRow[];
  updateRow: (id: string, field: keyof CourseRow | Partial<CourseRow>, value?: string) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
  templates: CourseTemplate[];
  languages?: string;
}

const ApprovalTable: React.FC<ApprovalTableProps> = ({ rows, updateRow, onAddRowTask, templates, languages = 'ES' }) => {
  const [previewVimeoId, setPreviewVimeoId] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  
  // Grouping state (Materia -> Módulo)
  const [collapsedMaterias, setCollapsedMaterias] = useState<Set<string>>(new Set());
  const [collapsedModulos, setCollapsedModulos] = useState<Set<string>>(new Set());
  
  // Gemini AI generation and preview state
  const [expandedPreviewRowId, setExpandedPreviewRowId] = useState<string | null>(null);
  const [minimizedPreviews, setMinimizedPreviews] = useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});
  // Track which rows have already been auto-triggered to avoid re-firing
  const autoGenTriggered = useRef<Set<string>>(new Set());
  
  const { showAlert, DialogRenderer } = useDialog();

  // Auto-generate HTML when both content and multimedia are APROBADO and no HTML yet
  useEffect(() => {
    rows.forEach(row => {
      const isReadyForAi = row.aprobacionContenido === 'APROBADO' && row.aprobacionMultimedia === 'APROBADO';
      const alreadyHasHtml = !!row.generatedHtml;
      const alreadyTriggered = autoGenTriggered.current.has(row.id);
      const currentlyGenerating = isGenerating[row.id];
      if (isReadyForAi && !alreadyHasHtml && !alreadyTriggered && !currentlyGenerating) {
        autoGenTriggered.current.add(row.id);
        handleGenerateHtml(row);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const toggleMinimizePreview = (rowId: string) => {
    setMinimizedPreviews(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const getApprovalColor = (status: string) => {
    return approvalOptions.find(opt => opt.value === status)?.color || 'white';
  };

  const getFinalStatusColor = (status: string) => {
    return finalStatusOptions.find(opt => opt.value === status)?.color || 'white';
  };

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

  const handleGenerateHtml = async (row: CourseRow) => {
    setIsGenerating(prev => ({ ...prev, [row.id]: true }));
    try {
      const templateId = selectedTemplates[row.id] || templates[0]?.id;
      const template = templates.find(t => t.id === templateId) || templates[0];

      let htmlContent = row.htmlContent || '';
      const isDocx = (row.fileType && row.fileType.includes('docx')) || (row.fileName && row.fileName.toLowerCase().endsWith('.docx'));
      
      if (!htmlContent && isDocx && row.links) {
        try {
          const resp = await fetch(row.links);
          if (!resp.ok) throw new Error('No se pudo descargar el archivo .docx');
          const blob = await resp.blob();
          const file = new File([blob], row.fileName || 'document.docx', { type: blob.type });
          const docxResult = await filesApi.uploadDocx(file);
          htmlContent = docxResult.htmlContent;
        } catch (e) {
          console.warn('Fallo el procesamiento de docx, se continúa sin texto de Word:', e);
        }
      }

      const { html } = await systemsApi.generateHtml({
        moduleName: row.modulo,
        rows: [{ ...row, htmlContent }],
        template
      });

      updateRow(row.id, {
        generatedHtml: html,
        aprobacionDiseno: 'PENDIENTE'
      });
      setExpandedPreviewRowId(row.id);
      showAlert('✨ Generación Exitosa', 'El diseño HTML ha sido generado con Gemini y está listo para ser previsualizado.', 'success');
    } catch (err) {
      console.error(err);
      showAlert('Error de Generación', err instanceof Error ? err.message : 'No se pudo generar el HTML.', 'danger');
    } finally {
      setIsGenerating(prev => ({ ...prev, [row.id]: false }));
    }
  };

  const activeLangs = languages.split(',').map(l => l.trim()).filter(Boolean);
  const requiresTranslation = activeLangs.length > 1;

  const handleApproveDesign = (rowId: string, approved: boolean) => {
    updateRow(rowId, 'aprobacionDiseno', approved ? 'APROBADO' : 'PENDIENTE');
  };

  const materias = Array.from(new Set(rows.map(r => r.materia)));

  return (
    <div className="table-wrapper glass-panel">
      <div className="table-responsive">
        <table className="content-table approval-table">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>NRO</th>
              <th style={{ width: '16%' }}>Clase / Descripción</th>
              <th style={{ width: '9%' }}>Ver Material</th>
              <th style={{ width: '10%' }}>Rev. Contenido</th>
              <th style={{ width: '10%' }}>Rev. Multimedia</th>
              <th style={{ width: '10%' }}>Rev. Traducción</th>
              <th style={{ width: '12%' }}>Comentarios</th>
              <th style={{ width: '15%' }}>Gemini AI / Diseño</th>
              <th style={{ width: '10%' }}>Visto Bueno Final</th>
              <th style={{ width: '4%' }}>Tarea</th>
            </tr>
          </thead>
          <tbody>
            {materias.map((materiaName, materiaIndex) => {
              const materiaRows = rows.filter(r => r.materia === materiaName);
              const modulos = Array.from(new Set(materiaRows.map(r => r.modulo)));
              const isMateriaCollapsed = collapsedMaterias.has(materiaName);

              return (
                <React.Fragment key={`materia-${materiaIndex}`}>
                  {/* Materia Header */}
                  <tr className="module-header-row" style={{ background: 'rgba(0, 150, 143, 0.12)' }}>
                    <td colSpan={10} style={{ padding: '0.8rem 1rem', borderBottom: '2px solid rgba(0, 150, 143, 0.25)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={() => toggleMateria(materiaName)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary)', display: 'flex' }}
                        >
                          {isMateriaCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                          MATERIA: {materiaName || 'Sin Materia'}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Módulos */}
                  {!isMateriaCollapsed && modulos.map((modName, modIndex) => {
                    const modRows = materiaRows.filter(r => r.modulo === modName);
                    const moduloKey = `${materiaName}::${modName}`;
                    const isModuloCollapsed = collapsedModulos.has(moduloKey);

                    return (
                      <React.Fragment key={`mod-${modIndex}`}>
                        {/* Módulo Header */}
                        <tr className="module-header-row" style={{ background: 'rgba(81, 172, 192, 0.08)' }}>
                          <td colSpan={10} style={{ padding: '0.6rem 1rem 0.6rem 2.5rem', borderBottom: '1px solid rgba(81, 172, 192, 0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <button
                                onClick={() => toggleModulo(moduloKey)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary-hover)', display: 'flex' }}
                              >
                                {isModuloCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                CLASE: {modName || 'Sin Clase'}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Content Rows */}
                        {!isModuloCollapsed && modRows.map(row => {
                          const isAvailable = row.estado === '4-DISPONIBLE';
                          const isReadyForAi = row.aprobacionContenido === 'APROBADO' && row.aprobacionMultimedia === 'APROBADO';
                          const isExpanded = expandedPreviewRowId === row.id;
                          
                          return (
                            <React.Fragment key={row.id}>
                              <tr 
                                className={row.estadoFinal === 'LISTO PARA MOODLE' ? 'row-approved' : ''}
                                style={!isAvailable ? { opacity: 0.55, background: 'rgba(255, 255, 255, 0.02)', filter: 'grayscale(80%)' } : {}}
                                title={!isAvailable ? "Este contenido aún no está DISPONIBLE para verificación" : ""}
                              >
                                <td className="readonly-cell" style={{ paddingLeft: '1.5rem' }}>{row.nro}</td>
                                <td className="readonly-cell">
                                  <div><strong>{row.modulo || 'Sin clase'}</strong></div>
                                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>{row.descripcion}</div>
                                </td>

                                {/* Ver Material */}
                                <td style={{ pointerEvents: !isAvailable ? 'none' : 'auto' }}>
                                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    {row.links && (
                                      <a
                                        href={row.links}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Contenido: ${row.links}`}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '6px',
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                          background: 'rgba(0,150,143,0.15)',
                                          color: 'var(--primary)',
                                          textDecoration: 'none',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        <ExternalLink size={11} /> Contenido
                                      </a>
                                    )}
                                    {row.videoDrive && (
                                      <a
                                        href={row.videoDrive}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Drive: ${row.videoDrive}`}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '6px',
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                          background: 'rgba(239,68,68,0.12)',
                                          color: '#ef4444',
                                          textDecoration: 'none',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        <ExternalLink size={11} /> Drive
                                      </a>
                                    )}
                                    {row.videoVimeo && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const id = extractVimeoId(row.videoVimeo);
                                            if (id) {
                                              setPreviewVimeoId(id);
                                              setPreviewTitle(row.descripcion || '');
                                            }
                                          }}
                                          title="Previsualizar video"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '0.25rem 0.4rem',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: 'rgba(16,185,129,0.12)',
                                            color: '#10b981',
                                            transition: 'background 0.2s',
                                          }}
                                        >
                                          <PlayCircle size={11} /> Ver Video
                                        </button>
                                      </div>
                                    )}
                                    {row.geniallyUrl && (
                                      <a
                                        href={row.geniallyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Genially: ${row.geniallyUrl}`}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '6px',
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                          background: 'rgba(59,130,246,0.12)',
                                          color: '#3b82f6',
                                          textDecoration: 'none',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        <ExternalLink size={11} /> Genially
                                      </a>
                                    )}
                                  </div>
                                </td>

                                {/* Aprobación Contenido */}
                                <td>
                                  <div className="status-select-wrapper">
                                    <div 
                                      className="status-indicator" 
                                      style={{ backgroundColor: getApprovalColor(row.aprobacionContenido) }} 
                                    />
                                    <select
                                      className="cell-select status-select"
                                      value={row.aprobacionContenido}
                                      style={{ color: getApprovalColor(row.aprobacionContenido) }}
                                      onChange={(e) => updateRow(row.id, 'aprobacionContenido', e.target.value)}
                                      disabled={!isAvailable}
                                    >
                                      {approvalOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.value}</option>
                                      ))}
                                    </select>
                                  </div>
                                </td>

                                {/* Aprobación Multimedia */}
                                <td>
                                  <div className="status-select-wrapper">
                                    <div 
                                      className="status-indicator" 
                                      style={{ backgroundColor: getApprovalColor(row.aprobacionMultimedia) }} 
                                    />
                                    <select
                                      className="cell-select status-select"
                                      value={row.aprobacionMultimedia}
                                      style={{ color: getApprovalColor(row.aprobacionMultimedia) }}
                                      onChange={(e) => updateRow(row.id, 'aprobacionMultimedia', e.target.value)}
                                      disabled={!isAvailable}
                                    >
                                      {approvalOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.value}</option>
                                      ))}
                                    </select>
                                  </div>
                                </td>

                                {/* Aprobación Traducción */}
                                <td>
                                  {requiresTranslation ? (
                                    <div className="status-select-wrapper">
                                      <div 
                                        className="status-indicator" 
                                        style={{ backgroundColor: getApprovalColor(row.aprobacionTraduccion || 'PENDIENTE') }} 
                                      />
                                      <select
                                        className="cell-select status-select"
                                        value={row.aprobacionTraduccion || 'PENDIENTE'}
                                        style={{ color: getApprovalColor(row.aprobacionTraduccion || 'PENDIENTE') }}
                                        onChange={(e) => updateRow(row.id, 'aprobacionTraduccion', e.target.value)}
                                        disabled={!isAvailable}
                                      >
                                        {approvalOptions.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>
                                      No requerido
                                    </div>
                                  )}
                                </td>

                                {/* Comentarios */}
                                <td>
                                  <input
                                    type="text"
                                    className="cell-input"
                                    value={row.comentariosRevisor}
                                    placeholder="Feedback..."
                                    onChange={(e) => updateRow(row.id, 'comentariosRevisor', e.target.value)}
                                    disabled={!isAvailable}
                                  />
                                </td>

                                {/* Gemini AI & Diseño (NUEVA COLUMNA INTEGRADA) */}
                                <td>
                                  {!isAvailable ? (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bloqueado</span>
                                  ) : !isReadyForAi ? (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Espera Aprobación</span>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      {isGenerating[row.id] ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--primary)' }}>
                                          <Loader2 size={12} className="spin" />
                                          <span>Generando...</span>
                                        </div>
                                      ) : !row.generatedHtml ? (
                                        <button
                                          onClick={() => handleGenerateHtml(row)}
                                          className="btn btn-sm"
                                          style={{
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.75rem',
                                            background: 'var(--primary)',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <Sparkles size={12} /> Generar
                                        </button>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                          <button
                                            onClick={() => setExpandedPreviewRowId(isExpanded ? null : row.id)}
                                            className="btn btn-sm btn-secondary"
                                            style={{
                                              padding: '0.25rem 0.5rem',
                                              fontSize: '0.75rem',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                            title="Ver o Cerrar Vista Previa"
                                          >
                                            {isExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                                            <span>{isExpanded ? 'Ocultar' : 'Diseño'}</span>
                                          </button>
                                          {row.aprobacionDiseno === 'APROBADO' ? (
                                            <span style={{
                                              fontSize: '0.7rem',
                                              fontWeight: 'bold',
                                              color: 'var(--status-available)',
                                              background: 'rgba(5, 150, 105, 0.1)',
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '2px'
                                            }}>
                                              <Check size={10} /> Ok
                                            </span>
                                          ) : (
                                            <span style={{
                                              fontSize: '0.7rem',
                                              fontWeight: 'bold',
                                              color: 'var(--status-in-progress)',
                                              background: 'rgba(217, 119, 6, 0.1)',
                                              padding: '2px 6px',
                                              borderRadius: '4px'
                                            }}>
                                              Pend.
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Estado Final */}
                                <td>
                                  <div className="status-select-wrapper">
                                    <div 
                                      className="status-indicator" 
                                      style={{ backgroundColor: getFinalStatusColor(row.estadoFinal) }} 
                                    />
                                    <select
                                      className="cell-select status-select"
                                      value={row.estadoFinal}
                                      style={{ color: getFinalStatusColor(row.estadoFinal) }}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'LISTO PARA MOODLE') {
                                          if (row.aprobacionContenido !== 'APROBADO' || row.aprobacionMultimedia !== 'APROBADO') {
                                            showAlert('Aprobaciones Requeridas', 'Se requiere aprobación de Contenido y Multimedia antes de dar el Visto Bueno Final.', 'warning');
                                            return;
                                          }
                                          if (requiresTranslation && row.aprobacionTraduccion !== 'APROBADO') {
                                            showAlert('Traducción Requerida', 'Se requiere la aprobación de la traducción antes de dar el Visto Bueno Final.', 'warning');
                                            return;
                                          }
                                        }
                                        updateRow(row.id, 'estadoFinal', val);
                                      }}
                                      disabled={!isAvailable}
                                    >
                                      {finalStatusOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.value}</option>
                                      ))}
                                    </select>
                                  </div>
                                </td>

                                {/* Tarea */}
                                <td style={{ textAlign: 'center' }}>
                                  <button 
                                    className="icon-btn" 
                                    style={{ color: 'var(--accent)', padding: '4px' }} 
                                    onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin clase', row.nro)}
                                    title="Crear tarea / observación"
                                    disabled={!isAvailable}
                                  >
                                    <ClipboardList size={16} />
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Preview Section */}
                              {isExpanded && row.generatedHtml && (() => {
                                const isMinimized = minimizedPreviews.has(row.id);
                                return (
                                <tr style={{ background: 'var(--bg-primary)' }}>
                                  <td colSpan={9} style={{ padding: '0.5rem 1.5rem 1rem 1.5rem' }}>
                                    <div style={{
                                      border: '1px solid var(--border)',
                                      borderRadius: '12px',
                                      background: 'var(--bg-secondary)',
                                      overflow: 'hidden',
                                      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.05)'
                                    }}>
                                      {/* Expanded Controls Header */}
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.5rem 1rem',
                                        background: 'rgba(0,0,0,0.05)',
                                        borderBottom: isMinimized ? 'none' : '1px solid var(--border)',
                                        flexWrap: 'wrap',
                                        gap: '0.5rem'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                            🎨 Vista Previa del Diseño (Clase {row.nro})
                                          </span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Plantilla:</span>
                                            <select
                                              style={{
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--border)',
                                                background: 'var(--bg-secondary)',
                                                color: 'var(--text-main)',
                                                fontSize: '0.75rem'
                                              }}
                                              value={selectedTemplates[row.id] || templates[0]?.id || ''}
                                              onChange={(e) => setSelectedTemplates(prev => ({ ...prev, [row.id]: e.target.value }))}
                                            >
                                              {templates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          {/* Minimize/Maximize toggle */}
                                          <button
                                            onClick={() => toggleMinimizePreview(row.id)}
                                            className="btn btn-sm btn-secondary"
                                            title={minimizedPreviews.has(row.id) ? 'Expandir vista previa' : 'Minimizar vista previa'}
                                            style={{
                                              padding: '0.3rem 0.5rem',
                                              fontSize: '0.75rem',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                          >
                                            {minimizedPreviews.has(row.id) ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                                          </button>
                                          <button
                                            onClick={() => handleGenerateHtml(row)}
                                            disabled={isGenerating[row.id]}
                                            className="btn btn-sm btn-secondary"
                                            style={{
                                              padding: '0.3rem 0.75rem',
                                              fontSize: '0.75rem',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                          >
                                            <RefreshCw size={12} className={isGenerating[row.id] ? 'spin' : ''} />
                                            <span>Regenerar</span>
                                          </button>
                                          {row.aprobacionDiseno === 'APROBADO' ? (
                                            <button
                                              onClick={() => handleApproveDesign(row.id, false)}
                                              className="btn btn-sm btn-danger"
                                              style={{
                                                padding: '0.3rem 0.75rem',
                                                fontSize: '0.75rem',
                                                background: 'var(--status-not-started)',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Rechazar Diseño
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => handleApproveDesign(row.id, true)}
                                              className="btn btn-sm"
                                              style={{
                                                padding: '0.3rem 0.75rem',
                                                fontSize: '0.75rem',
                                                background: 'var(--status-available)',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                              }}
                                            >
                                              <Check size={14} /> Aprobar Diseño
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Iframe View — collapsible */}
                                      {!minimizedPreviews.has(row.id) && (
                                        <div style={{ width: '100%', height: '360px', background: '#fff' }}>
                                          <iframe
                                            srcDoc={row.generatedHtml}
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                              border: 'none'
                                            }}
                                            title={`preview-row-${row.id}`}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                );
                              })()}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {previewVimeoId && (
        <VideoPreviewModal
          vimeoId={previewVimeoId}
          title={previewTitle}
          onClose={() => {
            setPreviewVimeoId(null);
            setPreviewTitle('');
          }}
        />
      )}
      {DialogRenderer}
    </div>
  );
};

export default ApprovalTable;
