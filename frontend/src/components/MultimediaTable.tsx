import React, { useState, useRef, useEffect } from 'react';
import { type CourseRow, type User, type Task, multimediaStatusOptions } from '../types';
import { vimeoApi } from '../services/api';
import { AlertCircle, ExternalLink, ClipboardList, ChevronDown, ChevronRight, Upload, Loader2, PlayCircle, X } from 'lucide-react';

const extractVimeoId = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  // Match standard paths or manage/videos/ paths
  const match = trimmed.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|channels\/[^\/]+\/|groups\/[^\/]+\/|manage\/videos\/|)?(\d+)/i);
  if (match) return match[1];
  // Fallback: look for a sequence of 8-12 digits bounded by slashes/start/end/question mark
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
        {/* Header */}
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
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-main)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Player */}
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

interface MultimediaTableProps {
  rows: CourseRow[];
  tasks?: Task[];
  updateRow: (id: string, field: keyof CourseRow, value: string) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
  user: User;
}

const subtitulosOptions = ['SI', 'NO'];

const estadoMultimediaOptions = [
  { value: '1-NO EMPEZADO', color: 'var(--status-not-started)' },
  { value: '2-EN PROCESO', color: 'var(--status-in-progress)' },
  { value: '3-CORREGIR', color: 'var(--status-review)' },
  { value: '4-DISPONIBLE', color: 'var(--status-available)' }
];

const MultimediaTable: React.FC<MultimediaTableProps> = ({ rows, tasks = [], updateRow, onAddRowTask, user }) => {
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
  const [collapsedMaterias, setCollapsedMaterias] = useState<Set<string>>(new Set());
  const [collapsedModulos, setCollapsedModulos] = useState<Set<string>>(new Set());
  // videoId → 'uploading' | 'done' | undefined
  const [vimeoUploading, setVimeoUploading] = useState<Record<string, boolean>>({});
  const vimeoInputRef = useRef<Record<string, HTMLInputElement | null>>({});

  const [previewVimeoId, setPreviewVimeoId] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  const toggleMateria = (materia: string) => {
    setCollapsedMaterias(prev => {
      const next = new Set(prev);
      if (next.has(materia)) next.delete(materia); else next.add(materia);
      return next;
    });
  };

  const toggleModulo = (key: string) => {
    setCollapsedModulos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    return multimediaStatusOptions.find(opt => opt.value === status)?.color || 'white';
  };

  const getEstadoColor = (status: string) => {
    return estadoMultimediaOptions.find(opt => opt.value === status)?.color || 'white';
  };

  /**
   * Sube el video seleccionado a Vimeo y rellena automáticamente el campo videoVimeo.
   */
  const handleVimeoUpload = async (rowId: string, file: File, descripcion: string) => {
    setVimeoUploading(prev => ({ ...prev, [rowId]: true }));
    try {
      const result = await vimeoApi.upload(file, descripcion);
      // Rellenar el campo videoVimeo con la URL del player de Vimeo
      updateRow(rowId, 'videoVimeo', result.embedUrl);
    } catch (err) {
      console.error('Error subiendo a Vimeo:', err);
      alert(err instanceof Error ? err.message : 'Error al subir el video a Vimeo');
    } finally {
      setVimeoUploading(prev => ({ ...prev, [rowId]: false }));
    }
  };

  // Helper: input + botón para abrir el link
  const LinkInput = ({ 
    value, placeholder, onChange, onPreview, disabled 
  }: { value: string; placeholder: string; onChange: (v: string) => void; onPreview?: () => void; disabled?: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <input
        type="text"
        className="cell-input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <>
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              title="Previsualizar video"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.3rem',
                borderRadius: '6px',
                color: '#10b981',
                background: 'rgba(16,185,129,0.12)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.28)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.12)')}
            >
              <PlayCircle size={13} />
            </button>
          )}
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir enlace"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.3rem',
              borderRadius: '6px',
              color: 'var(--accent)',
              background: 'rgba(139,92,246,0.12)',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.28)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
          >
            <ExternalLink size={13} />
          </a>
        </>
      )}
    </div>
  );

  // Extract unique materias from rows
  const materias = Array.from(new Set(rows.map(r => r.materia || 'Sin materia')));

  // Check if there are any rows at all
  if (rows.length === 0) {
    return (
      <div className="table-wrapper glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Sin contenido registrado</h4>
        <p className="text-muted">
          No hay clases o temas cargados en el Panel 1 para este curso.
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrapper glass-panel">
      <div className="table-responsive">
        <table className="content-table multimedia-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '4%' }}>NRO</th>
              <th rowSpan={2} style={{ width: '15%' }}>Descripción del contenido</th>
              <th rowSpan={2} style={{ width: '8%' }}>Formato</th>
              <th colSpan={3} className="text-center group-header">VIDEOS</th>
              <th colSpan={3} className="text-center group-header">GENIALLY</th>
              <th rowSpan={2} style={{ width: '10%' }}>ESTADO</th>
              <th rowSpan={2} style={{ width: '5%' }}>TAREA</th>
            </tr>
            <tr>
              <th className="sub-header">Link de drive</th>
              <th className="sub-header">Link de vimeo</th>
              <th className="sub-header">Subtitulos</th>
              <th className="sub-header">LINK</th>
              <th className="sub-header">TEXTO</th>
              <th className="sub-header">DISEÑO</th>
            </tr>
          </thead>
          <tbody>
            {materias.map(materiaName => {
              const materiaRows = rows.filter(r => (r.materia || 'Sin materia') === materiaName);
              const modulos = Array.from(new Set(materiaRows.map(r => r.modulo || 'Sin clase')));
              const isMateriaCollapsed = collapsedMaterias.has(materiaName);

              return (
                <React.Fragment key={`materia-${materiaName}`}>
                  {/* ── MATERIA HEADER (Level 1) ─────────────────── */}
                  <tr className="module-header-row"
                    style={{ background: 'rgba(79, 70, 229, 0.12)' }}>
                    <td colSpan={11} style={{ padding: '0.9rem 1rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                          onClick={() => toggleMateria(materiaName)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary)', display: 'flex', marginRight: '0.5rem' }}
                        >
                          {isMateriaCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.8px', marginRight: '0.5rem' }}>MATERIA:</span>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>{materiaName}</span>
                      </div>
                    </td>
                  </tr>

                  {/* ── MÓDULOS within this materia ──────────────── */}
                  {!isMateriaCollapsed && modulos.map(modName => {
                    const modRows = materiaRows.filter(r => (r.modulo || 'Sin clase') === modName);
                    const moduloKey = `${materiaName}::${modName}`;
                    const isModuloCollapsed = collapsedModulos.has(moduloKey);

                    return (
                      <React.Fragment key={moduloKey}>
                        {/* ── MÓDULO HEADER (Level 2) ──────────── */}
                        <tr className="module-header-row"
                          style={{ background: 'rgba(139, 92, 246, 0.06)' }}>
                          <td colSpan={11} style={{ padding: '0.65rem 1rem 0.65rem 2.5rem', borderBottom: '1px solid rgba(139, 92, 246, 0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <button
                                onClick={() => toggleModulo(moduloKey)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--accent)', display: 'flex', marginRight: '0.5rem' }}
                              >
                                {isModuloCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.5rem' }}>CLASE:</span>
                              <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)' }}>{modName}</span>
                            </div>
                          </td>
                        </tr>

                        {/* ── CONTENT ROWS (Level 3) ───────────── */}
                        {!isModuloCollapsed && modRows.map(row => {
                          const isVideo = row.formato === 'VIDEO';
                          const isGenially = row.formato === 'GENIALLY';
                          const isMultimedia = isVideo || isGenially;

                          if (isMultimedia) {
                            return (
                              <tr key={row.id}>
                                <td className="readonly-cell" style={{ paddingLeft: '1.5rem' }}>{row.nro}</td>
                                <td>
                                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                    {row.descripcion}
                                  </span>
                                </td>
                                <td>
                                  <span className={`formato-badge ${isVideo ? 'formato-badge--video' : 'formato-badge--genially'}`}>
                                    {row.formato}
                                  </span>
                                </td>

                                 {/* VIDEOS — editable solo si es VIDEO */}
                                <td>
                                  {isVideo ? (
                                    <LinkInput
                                      value={row.videoDrive}
                                      placeholder="https://drive..."
                                      onChange={(v) => updateRow(row.id, 'videoDrive', v)}
                                      disabled={!hasEditAccess}
                                    />
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>
                                <td>
                                  {isVideo ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <LinkInput
                                        value={row.videoVimeo}
                                        placeholder="https://player.vimeo.com/video/..."
                                        onChange={(v) => updateRow(row.id, 'videoVimeo', v)}
                                        disabled={!hasEditAccess}
                                        onPreview={
                                          extractVimeoId(row.videoVimeo)
                                            ? () => {
                                                setPreviewVimeoId(extractVimeoId(row.videoVimeo));
                                                setPreviewTitle(row.descripcion);
                                              }
                                            : undefined
                                        }
                                      />
                                      {/* Botón subir a Vimeo */}
                                      {vimeoUploading[row.id] ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--accent)' }}>
                                          <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />
                                          Subiendo a Vimeo...
                                        </div>
                                      ) : (
                                        hasEditAccess && (
                                          <>
                                            <input
                                              type="file"
                                              accept="video/*"
                                              style={{ display: 'none' }}
                                              ref={el => { vimeoInputRef.current[row.id] = el; }}
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleVimeoUpload(row.id, file, row.descripcion);
                                                e.target.value = '';
                                              }}
                                            />
                                            <button
                                              type="button"
                                              onClick={() => vimeoInputRef.current[row.id]?.click()}
                                              style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px',
                                                borderRadius: '6px', border: '1px solid rgba(19,183,229,0.4)',
                                                background: 'rgba(19,183,229,0.08)', color: '#13b7e5',
                                                cursor: 'pointer', whiteSpace: 'nowrap',
                                              }}
                                              title="Subir video directamente a Vimeo"
                                            >
                                              <Upload size={11} /> Subir a Vimeo
                                            </button>
                                          </>
                                        )
                                      )}
                                    </div>
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>
                                <td>
                                  {isVideo ? (
                                    <select
                                      className="cell-select"
                                      value={row.videoSubtitulos}
                                      disabled={!hasEditAccess}
                                      onChange={(e) => updateRow(row.id, 'videoSubtitulos', e.target.value)}
                                    >
                                      {subtitulosOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>

                                {/* GENIALLY — editable solo si es GENIALLY */}
                                <td>
                                  {isGenially ? (
                                    <LinkInput
                                      value={row.geniallyUrl || ''}
                                      placeholder="https://view.genial.ly/..."
                                      onChange={(v) => updateRow(row.id, 'geniallyUrl', v)}
                                      disabled={!hasEditAccess}
                                    />
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>
                                <td>
                                  {isGenially ? (
                                    <div className="status-select-wrapper">
                                      <div 
                                        className="status-indicator" 
                                        style={{ backgroundColor: getStatusColor(row.geniallyTextoStatus) }} 
                                      />
                                      <select
                                        className="cell-select status-select"
                                        value={row.geniallyTextoStatus}
                                        disabled={!hasEditAccess}
                                        style={{ color: getStatusColor(row.geniallyTextoStatus) }}
                                        onChange={(e) => updateRow(row.id, 'geniallyTextoStatus', e.target.value)}
                                      >
                                        {multimediaStatusOptions.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>
                                <td>
                                  {isGenially ? (
                                    <div className="status-select-wrapper">
                                      <div 
                                        className="status-indicator" 
                                        style={{ backgroundColor: getStatusColor(row.geniallyDisenoStatus) }} 
                                      />
                                      <select
                                        className="cell-select status-select"
                                        value={row.geniallyDisenoStatus}
                                        disabled={!hasEditAccess}
                                        style={{ color: getStatusColor(row.geniallyDisenoStatus) }}
                                        onChange={(e) => updateRow(row.id, 'geniallyDisenoStatus', e.target.value)}
                                      >
                                        {multimediaStatusOptions.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>

                                {/* ESTADO MULTIMEDIA — para todas las filas */}
                                <td>
                                  <div className="status-select-wrapper">
                                    <div 
                                      className="status-indicator" 
                                      style={{ backgroundColor: getEstadoColor(row.estadoMultimedia) }} 
                                    />
                                    <select
                                      className="cell-select status-select"
                                      value={row.estadoMultimedia}
                                      disabled={!hasEditAccess}
                                      style={{ color: getEstadoColor(row.estadoMultimedia) }}
                                      onChange={(e) => updateRow(row.id, 'estadoMultimedia', e.target.value)}
                                    >
                                      {estadoMultimediaOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.value}</option>
                                      ))}
                                    </select>
                                  </div>
                                </td>

                                {/* TAREA */}
                                <td style={{ textAlign: 'center' }}>
                                  <button 
                                    className="icon-btn" 
                                    style={{ color: getTaskIconColor(row.id), padding: '4px' }} 
                                    onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin clase', row.nro)}
                                    title="Crear tarea / observación"
                                  >
                                    <ClipboardList size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          } else {
                            // Fila grisada y no editable (por ejemplo TEXTO, CUESTIONARIO, etc.)
                            return (
                              <tr key={row.id} style={{ opacity: 0.45, background: 'rgba(255, 255, 255, 0.015)' }}>
                                <td className="readonly-cell" style={{ paddingLeft: '1.5rem' }}>{row.nro}</td>
                                <td>
                                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                    {row.descripcion}
                                  </span>
                                </td>
                                <td>
                                  <span className="formato-badge" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                                    {row.formato}
                                  </span>
                                </td>

                                {/* VIDEOS */}
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>

                                {/* GENIALLY */}
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>

                                {/* ESTADO */}
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>

                                {/* TAREA */}
                                <td style={{ textAlign: 'center' }}>
                                  <button 
                                    className="icon-btn" 
                                    style={{ color: getTaskIconColor(row.id, 'var(--text-muted)'), padding: '4px', cursor: 'pointer' }} 
                                    onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin clase', row.nro)}
                                    title="Crear tarea / observación"
                                  >
                                    <ClipboardList size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          }
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
    </div>
  );
};

export default MultimediaTable;
