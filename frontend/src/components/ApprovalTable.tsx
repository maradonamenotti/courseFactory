import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, ClipboardList, PlayCircle, X, ChevronDown, ChevronRight, Sparkles, Check, RefreshCw, Loader2, Eye, EyeOff, Minimize2, Maximize2, Clock } from 'lucide-react';
import { type CourseRow, type User, type CourseTemplate, type Task } from '../types';


const approvalEstados = [
  { value: 'PENDIENTE', label: 'Pendiente', color: '#ffb300', glow: 'rgba(255, 179, 0, 0.4)' },
  { value: 'RECHAZADO', label: 'Rechazado', color: '#e53935', glow: 'rgba(229, 57, 53, 0.4)' },
  { value: 'APROBADO', label: 'Aprobado', color: '#00c853', glow: 'rgba(0, 200, 83, 0.4)' }
];

const finalEstados = [
  { value: 'NO LISTO', label: 'No Listo', color: '#e53935', glow: 'rgba(229, 57, 53, 0.4)' },
  { value: 'LISTO PARA MOODLE', label: 'Listo Moodle', color: '#00c853', glow: 'rgba(0, 200, 83, 0.4)' }
];
import { systemsApi, filesApi } from '../services/api';
import { useDialog } from './CustomDialog';
import { HistoryDrawer } from './HistoryDrawer';

const isGoogleDriveUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return ['drive.google.com', 'docs.google.com', 'sheets.google.com',
            'slides.google.com', 'forms.google.com'].includes(hostname);
  } catch { return false; }
};

const isGeniallyUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return hostname.includes('genial.ly') || hostname.includes('genially');
  } catch { return false; }
};

const getExternalEditUrl = (row: CourseRow): string => {
  if (row.googleFileId) {
    const isPdf = (row.links && row.links.toLowerCase().endsWith('.pdf')) || row.fileType === 'application/pdf';
    if (isPdf) {
      return `https://drive.google.com/file/d/${row.googleFileId}/view`;
    }
    return `https://docs.google.com/document/d/${row.googleFileId}/edit`;
  }
  if (row.links && isGoogleDriveUrl(row.links)) {
    return row.links;
  }
  return row.links || '';
};

const extractGoogleFileId = (url: string): string | null => {
  if (!url) return null;
  try {
    const dMatch = url.match(/\/d\/([^/]+)/);
    if (dMatch) return dMatch[1];
    const idMatch = url.match(/[?&]id=([^&]+)/);
    if (idMatch) return idMatch[1];
    return null;
  } catch {
    return null;
  }
};

const extractVimeoId = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|channels\/[^\/]+\/|groups\/[^\/]+\/|manage\/videos\/|)?(\d+)/i);
  if (match) return match[1];
  const fallback = trimmed.match(/(?:\/|^)(\d{8,12})(?:\/|\?|$)/);
  return fallback ? fallback[1] : null;
};

const SafeIframePreview: React.FC<{ html: string; title: string }> = ({ html, title }) => {
  const [blobUrl, setBlobUrl] = useState<string>('');

  useEffect(() => {
    if (!html) {
      setBlobUrl('');
      return;
    }
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [html]);

  if (!blobUrl) return null;

  return (
    <iframe
      src={blobUrl}
      style={{
        width: '100%',
        height: '100%',
        border: 'none'
      }}
      title={title}
    />
  );
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

const renderCombinedMateriaProgress = (materiaRows: CourseRow[]) => {
  let totalApprovals = 0;
  let countPending = 0;
  let countRejected = 0;
  let countApproved = 0;

  materiaRows.forEach(row => {
    // 1. Contenido is always required
    totalApprovals++;
    if (row.aprobacionContenido === 'APROBADO') {
      countApproved++;
    } else if (row.aprobacionContenido === 'RECHAZADO') {
      countRejected++;
    } else {
      countPending++;
    }

    // 2. Multimedia
    totalApprovals++;
    if (row.aprobacionMultimedia === 'APROBADO') {
      countApproved++;
    } else if (row.aprobacionMultimedia === 'RECHAZADO') {
      countRejected++;
    } else {
      countPending++;
    }
  });

  if (totalApprovals === 0) return null;

  const pctPending = (countPending / totalApprovals) * 100;
  const pctRejected = (countRejected / totalApprovals) * 100;
  const pctApproved = (countApproved / totalApprovals) * 100;
  

  return (
    <div 
      style={{
        position: 'relative',
        height: '20px',
        width: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
        minWidth: '110px'
      }} 
      title={`Aprobado: ${Math.round(pctApproved)}% | Rechazado: ${Math.round(pctRejected)}% | Pendiente: ${Math.round(pctPending)}%`}
    >
      {/* Segmento Pendiente */}
      {pctPending > 0 && (
        <div 
          title={`Pendiente: ${Math.round(pctPending)}%`}
          style={{
            height: '100%',
            width: `${pctPending}%`,
            backgroundColor: '#ffb300',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Rechazado */}
      {pctRejected > 0 && (
        <div 
          title={`Rechazado: ${Math.round(pctRejected)}%`}
          style={{
            height: '100%',
            width: `${pctRejected}%`,
            backgroundColor: '#e53935',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Aprobado */}
      {pctApproved > 0 && (
        <div 
          title={`Aprobado: ${Math.round(pctApproved)}%`}
          style={{
            height: '100%',
            width: `${pctApproved}%`,
            backgroundColor: '#00c853',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}

    </div>
  );
};

interface ApprovalTableProps {
  rows: CourseRow[];
  tasks?: Task[];
  courseId: string;
  updateRow: (id: string, field: keyof CourseRow | Partial<CourseRow>, value?: string) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
  templates: CourseTemplate[];
  languages?: string;
  user: User;
}

const ApprovalTable: React.FC<ApprovalTableProps> = ({ rows, tasks = [], courseId, updateRow, onAddRowTask, templates, user }) => {
  const hasEditAccess = user.isAdmin || user.canEdit;

  const getTaskIconColor = (rowId: string, defaultColor: string = 'var(--accent)') => {
    const rowTasks = tasks.filter(t => t.rowId === rowId);
    if (rowTasks.length === 0) return defaultColor;
    const hasPending = rowTasks.some(t => t.status === 'PENDIENTE' || t.status === 'EN_PROCESO');
    if (hasPending) return '#f59e0b'; // orange
    const hasResolved = rowTasks.every(t => t.status === 'RESUELTO');
    if (hasResolved) return 'var(--status-available)'; // green
    return defaultColor;
  };
  const [historyRow, setHistoryRow] = useState<{ id: string; label: string } | null>(null);
  const [previewVimeoId, setPreviewVimeoId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CourseRow | null>(null);
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

  // Auto-generate HTML when both content and multimedia are APROBADO and no HTML yet (at class level)
  useEffect(() => {
    // Group rows by class
    const classes = new Map<string, CourseRow[]>();
    rows.forEach(r => {
      const key = `${r.materia}::${r.modulo}`;
      if (!classes.has(key)) classes.set(key, []);
      classes.get(key)!.push(r);
    });

    classes.forEach((classRows) => {
      const firstRow = classRows[0];
      if (!firstRow) return;

      const allReady = classRows.every(r => r.aprobacionContenido === 'APROBADO' && r.aprobacionMultimedia === 'APROBADO');
      const alreadyHasHtml = !!firstRow.generatedHtml;
      const alreadyTriggered = autoGenTriggered.current.has(firstRow.id);
      const currentlyGenerating = isGenerating[firstRow.id];

      if (allReady && !alreadyHasHtml && !alreadyTriggered && !currentlyGenerating) {
        autoGenTriggered.current.add(firstRow.id);
        handleGenerateHtml(firstRow);
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

      // Get all rows of the same class (modulo)
      const classRows = rows.filter(r => r.modulo === row.modulo && r.materia === row.materia);

      // Download/process Word content for all rows in the class
      const rowsWithHtml = await Promise.all(classRows.map(async (r) => {
        let rHtml = r.htmlContent || '';
        const rIsDocx = (r.fileType && r.fileType.includes('docx')) || (r.fileName && r.fileName.toLowerCase().endsWith('.docx'));
        
        if (!rHtml && rIsDocx && r.links) {
          try {
            const resp = await fetch(r.links);
            if (!resp.ok) throw new Error('No se pudo descargar el archivo .docx');
            const blob = await resp.blob();
            const file = new File([blob], r.fileName || 'document.docx', { type: blob.type });
            const docxResult = await filesApi.uploadDocx(file);
            rHtml = docxResult.htmlContent;
            // Optimistically update locally & server
            updateRow(r.id, 'htmlContent', rHtml);
          } catch (e) {
            console.warn('Fallo el procesamiento de docx para la fila', r.id, e);
          }
        }
        return { ...r, htmlContent: rHtml };
      }));

      const { html } = await systemsApi.generateHtml({
        moduleName: row.modulo,
        rows: rowsWithHtml,
        template
      });

      // Update the first row (the main row representing the class)
      updateRow(row.id, {
        generatedHtml: html,
        aprobacionDiseno: 'PENDIENTE'
      });

      // Clear the HTML on subsequent rows of the same class to avoid duplicates
      classRows.forEach(r => {
        if (r.id !== row.id) {
          updateRow(r.id, {
            generatedHtml: '',
            aprobacionDiseno: 'PENDIENTE'
          });
        }
      });

      setExpandedPreviewRowId(row.id);
      showAlert('✨ Generación Exitosa', 'El diseño HTML ha sido generado para toda la clase y está listo para ser previsualizado.', 'success');
    } catch (err) {
      console.error(err);
      showAlert('Error de Generación', err instanceof Error ? err.message : 'No se pudo generar el HTML.', 'danger');
    } finally {
      setIsGenerating(prev => ({ ...prev, [row.id]: false }));
    }
  };


  const handleApproveDesign = (rowId: string, approved: boolean) => {
    updateRow(rowId, 'aprobacionDiseno', approved ? 'APROBADO' : 'PENDIENTE');
    const mainRow = rows.find(r => r.id === rowId);
    if (mainRow) {
      const classRows = rows.filter(r => r.modulo === mainRow.modulo && r.materia === mainRow.materia);
      classRows.forEach(r => {
        if (r.id !== rowId) {
          updateRow(r.id, 'aprobacionDiseno', approved ? 'APROBADO' : 'PENDIENTE');
        }
      });
    }
  };

  const materias = Array.from(new Set(rows.map(r => r.materia)));

  return (
    <div className="table-wrapper glass-panel" style={{ '--sticky-header-height': '53px' } as React.CSSProperties}>
      <div className="table-responsive">
        <table className="content-table approval-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>NRO</th>
              <th style={{ width: '20%' }}>Clase / Descripción</th>
              <th style={{ width: '12%' }}>Ver Material</th>
              <th style={{ width: '12%' }}>Rev. Contenido</th>
              <th style={{ width: '12%' }}>Rev. Multimedia</th>
              <th style={{ width: '15%' }}>Gemini AI / Diseño</th>
              <th style={{ width: '10%' }}>Visto Bueno Final</th>
              <th style={{ width: '5%' }}>Tarea</th>
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
                  <tr className="module-header-row materia-header-row" style={{ background: 'rgba(0, 150, 143, 0.12)' }}>
                    <td colSpan={3} style={{ padding: '0.8rem 1rem', borderBottom: '2px solid rgba(0, 150, 143, 0.25)', verticalAlign: 'middle' }}>
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
                    <td colSpan={2} style={{ padding: '0.8rem 1.2rem', borderBottom: '2px solid rgba(0, 150, 143, 0.25)', verticalAlign: 'middle' }}>
                      {renderCombinedMateriaProgress(materiaRows)}
                    </td>
                    <td colSpan={3} style={{ padding: '0.8rem 1rem', borderBottom: '2px solid rgba(0, 150, 143, 0.25)', verticalAlign: 'middle' }}>
                      {/* Espacio para columnas restantes */}
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
                        <tr className="module-header-row clase-header-row" style={{ background: 'rgba(81, 172, 192, 0.08)' }}>
                          <td colSpan={8} style={{ padding: '0.6rem 1rem 0.6rem 2.5rem', borderBottom: '1px solid rgba(81, 172, 192, 0.15)' }}>
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
                        {!isModuloCollapsed && modRows.map((row, rowIndex) => {
                          const isAvailable = row.estado === '4-DISPONIBLE';
                          const isReadyForAi = modRows.every(r => r.aprobacionContenido === 'APROBADO' && r.aprobacionMultimedia === 'APROBADO');
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
                                      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                        <a
                                          href={getExternalEditUrl(row)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Contenido: ${row.links}`}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px 0 0 6px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: 'rgba(0,150,143,0.15)',
                                            color: 'var(--primary)',
                                            textDecoration: 'none',
                                            borderRight: '1px solid rgba(0,150,143,0.2)',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <ExternalLink size={11} /> Contenido
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewDoc(row)}
                                          title="Previsualizar Contenido"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '0.25rem 0.4rem',
                                            borderRadius: '0 6px 6px 0',
                                            fontSize: '0.7rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: 'rgba(0,150,143,0.25)',
                                            color: 'var(--primary)',
                                            height: '23px',
                                            boxSizing: 'border-box'
                                          }}
                                        >
                                          <Eye size={11} />
                                        </button>
                                      </div>
                                    )}
                                    {row.videoDrive && (
                                      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
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
                                            borderRadius: '6px 0 0 6px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: 'rgba(239,68,68,0.12)',
                                            color: '#ef4444',
                                            textDecoration: 'none',
                                            borderRight: '1px solid rgba(239,68,68,0.15)',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <ExternalLink size={11} /> Drive
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewDoc({ ...row, links: row.videoDrive })}
                                          title="Previsualizar video en Drive"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '0.25rem 0.4rem',
                                            borderRadius: '0 6px 6px 0',
                                            fontSize: '0.7rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: 'rgba(239,68,68,0.2)',
                                            color: '#ef4444',
                                            height: '23px',
                                            boxSizing: 'border-box'
                                          }}
                                        >
                                          <Eye size={11} />
                                        </button>
                                      </div>
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
                                      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
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
                                            borderRadius: '6px 0 0 6px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: 'rgba(59,130,246,0.12)',
                                            color: '#3b82f6',
                                            textDecoration: 'none',
                                            borderRight: '1px solid rgba(59,130,246,0.2)',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <ExternalLink size={11} /> Genially
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewDoc({ ...row, links: row.geniallyUrl })}
                                          title="Previsualizar Genially"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '0.25rem 0.4rem',
                                            borderRadius: '0 6px 6px 0',
                                            fontSize: '0.7rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: 'rgba(59,130,246,0.25)',
                                            color: '#3b82f6',
                                            height: '23px',
                                            boxSizing: 'border-box'
                                          }}
                                        >
                                          <Eye size={11} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                 {/* Aprobación Contenido */}
                                <td>
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <div style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      background: 'rgba(0, 0, 0, 0.3)',
                                      padding: '5px 10px',
                                      borderRadius: '20px',
                                      border: '1px solid rgba(255, 255, 255, 0.05)'
                                    }}>
                                      {approvalEstados.map(estado => {
                                        const esActivo = row.aprobacionContenido === estado.value;
                                        return (
                                          <button
                                            key={estado.value}
                                            onClick={() => isAvailable && hasEditAccess && updateRow(row.id, 'aprobacionContenido', estado.value)}
                                            disabled={!isAvailable || !hasEditAccess}
                                            title={estado.label}
                                            style={{
                                              width: esActivo ? '15px' : '10px',
                                              height: esActivo ? '15px' : '10px',
                                              borderRadius: '50%',
                                              backgroundColor: estado.color,
                                              border: 'none',
                                              padding: 0,
                                              cursor: isAvailable && hasEditAccess ? 'pointer' : 'default',
                                              opacity: esActivo ? 1.0 : 0.25,
                                              transform: esActivo ? 'scale(1.1)' : 'scale(1)',
                                              boxShadow: esActivo ? `0 0 10px ${estado.glow}` : 'none',
                                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                              flexShrink: 0
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>

                                {/* Aprobación Multimedia */}
                                <td>
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <div style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      background: 'rgba(0, 0, 0, 0.3)',
                                      padding: '5px 10px',
                                      borderRadius: '20px',
                                      border: '1px solid rgba(255, 255, 255, 0.05)'
                                    }}>
                                      {approvalEstados.map(estado => {
                                        const esActivo = row.aprobacionMultimedia === estado.value;
                                        return (
                                          <button
                                            key={estado.value}
                                            onClick={() => isAvailable && hasEditAccess && updateRow(row.id, 'aprobacionMultimedia', estado.value)}
                                            disabled={!isAvailable || !hasEditAccess}
                                            title={estado.label}
                                            style={{
                                              width: esActivo ? '15px' : '10px',
                                              height: esActivo ? '15px' : '10px',
                                              borderRadius: '50%',
                                              backgroundColor: estado.color,
                                              border: 'none',
                                              padding: 0,
                                              cursor: isAvailable && hasEditAccess ? 'pointer' : 'default',
                                              opacity: esActivo ? 1.0 : 0.25,
                                              transform: esActivo ? 'scale(1.1)' : 'scale(1)',
                                              boxShadow: esActivo ? `0 0 10px ${estado.glow}` : 'none',
                                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                              flexShrink: 0
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>





                                {/* Gemini AI & Diseño (NUEVA COLUMNA INTEGRADA) */}
                                <td>
                                  {rowIndex > 0 ? (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      Incluido en principal
                                    </span>
                                  ) : (
                                    <>
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
                                        hasEditAccess && (
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
                                        )
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
                                    </>
                                  )}
                                </td>

                                {/* Estado Final */}
                                <td>
                                  {rowIndex > 0 ? (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      Incluido en principal
                                    </span>
                                  ) : (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        padding: '5px 10px',
                                        borderRadius: '20px',
                                        border: '1px solid rgba(255, 255, 255, 0.05)'
                                      }}>
                                        {finalEstados.map(estado => {
                                          const esActivo = row.estadoFinal === estado.value;
                                          return (
                                            <button
                                              key={estado.value}
                                              onClick={() => {
                                                if (!isAvailable || !hasEditAccess) return;
                                                const val = estado.value;
                                                if (val === 'LISTO PARA MOODLE') {
                                                  const anyUnapproved = modRows.some(r => r.aprobacionContenido !== 'APROBADO' || r.aprobacionMultimedia !== 'APROBADO');
                                                  if (anyUnapproved) {
                                                    showAlert('Aprobaciones Requeridas', 'Todos los recursos de la clase deben estar aprobados antes de dar el Visto Bueno Final.', 'warning');
                                                    return;
                                                  }
                                                }
                                                updateRow(row.id, 'estadoFinal', val);
                                                modRows.forEach(r => {
                                                  if (r.id !== row.id) updateRow(r.id, 'estadoFinal', val);
                                                });
                                              }}
                                              disabled={!isAvailable || !hasEditAccess}
                                              title={estado.label}
                                              style={{
                                                width: esActivo ? '15px' : '10px',
                                                height: esActivo ? '15px' : '10px',
                                                borderRadius: '50%',
                                                backgroundColor: estado.color,
                                                border: 'none',
                                                padding: 0,
                                                cursor: isAvailable && hasEditAccess ? 'pointer' : 'default',
                                                opacity: esActivo ? 1.0 : 0.25,
                                                transform: esActivo ? 'scale(1.1)' : 'scale(1)',
                                                boxShadow: esActivo ? `0 0 10px ${estado.glow}` : 'none',
                                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                flexShrink: 0
                                              }}
                                            />
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </td>

                                {/* Tarea */}
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                                    <button 
                                      className="icon-btn" 
                                      style={{ color: getTaskIconColor(row.id), padding: '4px' }} 
                                      onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin clase', row.nro)}
                                      title="Crear tarea / observación"
                                      disabled={!isAvailable}
                                    >
                                      <ClipboardList size={16} />
                                    </button>
                                    <button
                                      className="icon-btn"
                                      style={{ color: 'var(--text-muted)', padding: '4px', cursor: 'pointer' }}
                                      onClick={() => setHistoryRow({ id: row.id, label: `Clase ${row.nro} - ${row.modulo || 'Sin clase'}` })}
                                      title="Ver historial de cambios"
                                    >
                                      <Clock size={16} />
                                    </button>
                                  </div>
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
                                          {hasEditAccess && (
                                            row.aprobacionDiseno === 'APROBADO' ? (
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
                                            )
                                          )}
                                        </div>
                                      </div>

                                      {/* Iframe View — collapsible */}
                                      {!minimizedPreviews.has(row.id) && (
                                        <div style={{ width: '100%', height: '360px', background: '#fff' }}>
                                          <SafeIframePreview
                                            html={row.generatedHtml || ''}
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

      {historyRow && (
        <HistoryDrawer
          rowId={historyRow.id}
          courseId={courseId}
          rowLabel={historyRow.label}
          panel={3}
          onRestored={() => {}}
          onClose={() => setHistoryRow(null)}
        />
      )}

      {previewDoc && (
        <DocumentPreviewModal
          row={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
};

interface DocumentPreviewModalProps {
  row: CourseRow;
  onClose: () => void;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ row, onClose }) => {
  const isDrive = isGoogleDriveUrl(row.links || '');
  const fileId = row.googleFileId || (row.links ? extractGoogleFileId(row.links) : null);
  
  let contentNode = null;

  if (isDrive && fileId) {
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    contentNode = (
      <iframe
        src={previewUrl}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
        allow="autoplay"
        title="Previsualización de Google Drive"
      />
    );
  } else if (row.htmlContent) {
    contentNode = (
      <div 
        style={{ 
          width: '100%', 
          height: '100%', 
          overflowY: 'auto', 
          background: 'rgba(0, 0, 0, 0.4)', 
          padding: '2rem 1rem', 
          display: 'flex', 
          justifyContent: 'center' 
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .word-preview-page img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            margin: 1.5rem 0;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
          }
          .word-preview-page table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
            font-size: 0.9rem;
          }
          .word-preview-page th, .word-preview-page td {
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 12px;
            text-align: left;
          }
          .word-preview-page th {
            background: rgba(255, 255, 255, 0.05);
          }
        ` }} />
        <div 
          className="word-preview-page"
          style={{
            background: '#ffffff',
            color: '#333333',
            width: '100%',
            maxWidth: '800px',
            minHeight: '100%',
            padding: '3rem 4rem',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            boxSizing: 'border-box',
            fontFamily: 'Georgia, serif',
            lineHeight: 1.6,
            fontSize: '1.05rem',
            overflowX: 'hidden'
          }}
          dangerouslySetInnerHTML={{ __html: row.htmlContent }}
        />
      </div>
    );
  } else if (row.links && isGeniallyUrl(row.links)) {
    contentNode = (
      <iframe
        src={row.links}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', background: '#fff' }}
        allow="autoplay; fullscreen"
        allowFullScreen
        title="Previsualización de Genially"
      />
    );
  } else if (row.links && row.links.includes('res.cloudinary.com') && row.links.includes('/raw/upload/')) {
    contentNode = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <ClipboardList size={48} style={{ color: 'var(--primary)' }} />
        <h4 style={{ color: 'var(--text-main)', margin: 0 }}>Archivo de Servidor Multimedia</h4>
        <p style={{ maxWidth: '400px', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Este archivo ({row.fileName || 'documento'}) está almacenado en el servidor multimedia de forma segura. Para visualizarlo o descargarlo, haz clic en el botón <strong>"Abrir Externo"</strong> en la esquina superior derecha.
        </p>
      </div>
    );
  } else if (row.links && (row.links.endsWith('.pdf') || row.fileType === 'application/pdf')) {
    contentNode = (
      <iframe
        src={row.links}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
        title="Previsualización de PDF"
      />
    );
  } else if (row.links && (row.links.endsWith('.docx') || row.links.endsWith('.doc'))) {
    const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(row.links)}&embedded=true`;
    contentNode = (
      <iframe
        src={googleViewerUrl}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
        title="Previsualización de Word"
      />
    );
  } else {
    contentNode = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem' }}>
        <EyeOff size={48} />
        <span>No hay previsualización disponible para este tipo de archivo.</span>
        {row.links && (
          <a href={getExternalEditUrl(row)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
            Abrir archivo en pestaña nueva
          </a>
        )}
      </div>
    );
  }

  return createPortal(
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
    >
      {/* Floating Close Button */}
      <button 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 100000,
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#ffffff',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          transition: 'all 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        ×
      </button>

      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1200px',
          height: '85vh',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Previsualización de Documento
            </span>
            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.fileName || 'Documento sin título'}
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {row.links && (
              <a 
                href={getExternalEditUrl(row)} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  color: '#ffffff',
                  textDecoration: 'none',
                  background: 'rgba(20, 184, 166, 0.15)',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(20, 184, 166, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(20, 184, 166, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.3)';
                }}
              >
                <ExternalLink size={14} />
                Abrir Externo
              </a>
            )}
            <button 
              onClick={onClose}
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                border: 'none', 
                color: 'var(--text-main)', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div style={{ flex: 1, minHeight: 0, background: 'rgba(0, 0, 0, 0.2)' }}>
          {contentNode}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ApprovalTable;
