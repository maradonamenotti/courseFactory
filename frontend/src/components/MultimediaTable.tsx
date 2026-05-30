import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { type CourseRow, type User, type Task } from '../types';
import { vimeoApi } from '../services/api';
import { AlertCircle, ExternalLink, ClipboardList, ChevronDown, ChevronRight, Upload, Loader2, PlayCircle, X, Clock, Eye } from 'lucide-react';
import { HistoryDrawer } from './HistoryDrawer';
import { useDialog } from './CustomDialog';

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

interface MultimediaPreviewModalProps {
  type: 'vimeo' | 'genially';
  urlOrId: string;
  title: string;
  onClose: () => void;
}

const MultimediaPreviewModal: React.FC<MultimediaPreviewModalProps> = ({ type, urlOrId, title, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isVimeo = type === 'vimeo';
  const iframeSrc = isVimeo 
    ? `https://player.vimeo.com/video/${urlOrId}?autoplay=1`
    : urlOrId;

  const modalContent = (
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
          maxWidth: isVimeo ? '800px' : '1024px',
          height: isVimeo ? 'auto' : '85vh',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
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
            {isVimeo ? '🎬 Vista Previa de Video: ' : '🌐 Vista Previa de Genially: '}{title}
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
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          height: isVimeo ? '0' : '100%',
          paddingBottom: isVimeo ? '56.25%' : '0', 
          background: '#000',
          flexGrow: isVimeo ? 0 : 1
        }}>
          <iframe
            src={iframeSrc}
            style={isVimeo ? {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 0
            } : {
              width: '100%',
              height: '100%',
              border: 0,
              background: '#fff'
            }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

interface MultimediaTableProps {
  rows: CourseRow[];
  tasks?: Task[];
  courseId: string;
  updateRow: (id: string, field: keyof CourseRow, value: string) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
  user: User;
}

const subtitulosEstados = [
  { value: 'NO', label: 'No', color: '#e53935', glow: 'rgba(229, 57, 53, 0.4)' },
  { value: 'SI', label: 'Sí', color: '#00c853', glow: 'rgba(0, 200, 83, 0.4)' }
];



const configEstados = [
  { value: '1-NO EMPEZADO', label: 'Pendiente', color: '#ffb300', glow: 'rgba(255, 179, 0, 0.4)' },
  { value: '2-EN PROCESO', label: 'En Proceso', color: '#ff6f00', glow: 'rgba(255, 111, 0, 0.4)' },
  { value: '3-CORREGIR', label: 'Corregir', color: '#e53935', glow: 'rgba(229, 57, 53, 0.4)' },
  { value: '4-DISPONIBLE', label: 'Disponible', color: '#00c853', glow: 'rgba(0, 200, 83, 0.4)' }
];

const renderMateriaProgress = (materiaRows: CourseRow[]) => {
  const multimediaRows = materiaRows.filter(r => r.formato === 'VIDEO' || r.formato === 'GENIALLY');
  if (multimediaRows.length === 0) {
    return (
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Sin multimedia
      </span>
    );
  }

  const total = multimediaRows.length;
  const countPending = multimediaRows.filter(r => r.estadoMultimedia === '1-NO EMPEZADO').length;
  const countInProgress = multimediaRows.filter(r => r.estadoMultimedia === '2-EN PROCESO').length;
  const countCorrection = multimediaRows.filter(r => r.estadoMultimedia === '3-CORREGIR').length;
  const countAvailable = multimediaRows.filter(r => r.estadoMultimedia === '4-DISPONIBLE').length;

  const pctPending = (countPending / total) * 100;
  const pctInProgress = (countInProgress / total) * 100;
  const pctCorrection = (countCorrection / total) * 100;
  const pctAvailable = (countAvailable / total) * 100;


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
      title={`Disponible: ${Math.round(pctAvailable)}% | En Proceso: ${Math.round(pctInProgress)}% | Corregir: ${Math.round(pctCorrection)}% | Pendiente: ${Math.round(pctPending)}%`}
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
      {/* Segmento En Proceso */}
      {pctInProgress > 0 && (
        <div 
          title={`En Proceso: ${Math.round(pctInProgress)}%`}
          style={{
            height: '100%',
            width: `${pctInProgress}%`,
            backgroundColor: '#ff6f00',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Corregir */}
      {pctCorrection > 0 && (
        <div 
          title={`Corregir: ${Math.round(pctCorrection)}%`}
          style={{
            height: '100%',
            width: `${pctCorrection}%`,
            backgroundColor: '#e53935',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Disponible */}
      {pctAvailable > 0 && (
        <div 
          title={`Disponible: ${Math.round(pctAvailable)}%`}
          style={{
            height: '100%',
            width: `${pctAvailable}%`,
            backgroundColor: '#00c853',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}

    </div>
  );
};

const MultimediaTable: React.FC<MultimediaTableProps> = ({ rows, tasks = [], courseId, updateRow, onAddRowTask, user }) => {
  const { showAlert, DialogRenderer } = useDialog();
  const hasEditAccess = user.isAdmin || user.canEdit;
  const [historyRow, setHistoryRow] = useState<{ id: string; label: string } | null>(null);

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

  const [previewMultimedia, setPreviewMultimedia] = useState<{ type: 'vimeo' | 'genially'; urlOrId: string; title: string } | null>(null);

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
      showAlert('Error', err instanceof Error ? err.message : 'Error al subir el video a Vimeo', 'danger');
    } finally {
      setVimeoUploading(prev => ({ ...prev, [rowId]: false }));
    }
  };

  // Helper: input + botón para abrir el link
  const LinkInput = ({ 
    value, placeholder, onChange, onPreview, previewTitle = "Previsualizar video", previewIcon = <PlayCircle size={13} />, disabled 
  }: { 
    value: string; 
    placeholder: string; 
    onChange: (v: string) => void; 
    onPreview?: () => void; 
    previewTitle?: string; 
    previewIcon?: React.ReactNode; 
    disabled?: boolean 
  }) => (
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
              title={previewTitle}
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
              {previewIcon}
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
    <div className="table-wrapper glass-panel" style={{ '--sticky-header-height': '85px' } as React.CSSProperties}>
      <div className="table-responsive">
        <table className="content-table multimedia-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '4%' }}>NRO</th>
              <th rowSpan={2} style={{ width: '13%' }}>Descripción del contenido</th>
              <th rowSpan={2} style={{ width: '8%' }}>Formato</th>
              <th colSpan={3} className="text-center group-header">VIDEOS</th>
              <th colSpan={1} className="text-center group-header">GENIALLY</th>
              <th rowSpan={2} style={{ width: '12%' }}>ESTADO</th>
              <th rowSpan={2} style={{ width: '5%' }}>TAREA</th>
            </tr>
            <tr>
              <th className="sub-header">Link de drive</th>
              <th className="sub-header">Link de vimeo</th>
              <th className="sub-header">Subtitulos</th>
              <th className="sub-header">LINK</th>
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
                  <tr className="module-header-row materia-header-row"
                    style={{ background: 'rgba(79, 70, 229, 0.12)' }}>
                    <td colSpan={7} style={{ padding: '0.9rem 1rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)', verticalAlign: 'middle' }}>
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
                    <td style={{ padding: '0.9rem 1.2rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)', verticalAlign: 'middle' }}>
                      {renderMateriaProgress(materiaRows)}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)', verticalAlign: 'middle' }}>
                      {/* Espacio para la columna Tarea */}
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
                        <tr className="module-header-row clase-header-row"
                          style={{ background: 'rgba(139, 92, 246, 0.06)' }}>
                          <td colSpan={9} style={{ padding: '0.65rem 1rem 0.65rem 2.5rem', borderBottom: '1px solid rgba(139, 92, 246, 0.15)' }}>
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
                                                setPreviewMultimedia({
                                                  type: 'vimeo',
                                                  urlOrId: extractVimeoId(row.videoVimeo)!,
                                                  title: row.descripcion
                                                });
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
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        padding: '4px 8px',
                                        borderRadius: '20px',
                                        border: '1px solid rgba(255, 255, 255, 0.05)'
                                      }}>
                                        {subtitulosEstados.map(estado => {
                                          const esActivo = (row.videoSubtitulos || 'NO') === estado.value;
                                          return (
                                            <button
                                              key={estado.value}
                                              onClick={() => hasEditAccess && updateRow(row.id, 'videoSubtitulos', estado.value)}
                                              disabled={!hasEditAccess}
                                              title={estado.label}
                                              style={{
                                                width: esActivo ? '12px' : '8px',
                                                height: esActivo ? '12px' : '8px',
                                                borderRadius: '50%',
                                                backgroundColor: estado.color,
                                                border: 'none',
                                                padding: 0,
                                                cursor: hasEditAccess ? 'pointer' : 'default',
                                                opacity: esActivo ? 1.0 : 0.25,
                                                transform: esActivo ? 'scale(1.1)' : 'scale(1)',
                                                boxShadow: esActivo ? `0 0 8px ${estado.glow}` : 'none',
                                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                flexShrink: 0
                                              }}
                                            />
                                          );
                                        })}
                                      </div>
                                    </div>
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
                                      previewTitle="Previsualizar Genially"
                                      previewIcon={<Eye size={13} />}
                                      onPreview={
                                        row.geniallyUrl
                                          ? () => {
                                              setPreviewMultimedia({
                                                type: 'genially',
                                                urlOrId: row.geniallyUrl,
                                                title: row.descripcion
                                              });
                                            }
                                          : undefined
                                      }
                                    />
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>
 
                                 {/* ESTADO MULTIMEDIA — para todas las filas */}
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
                                      {configEstados.map(estado => {
                                        const esActivo = row.estadoMultimedia === estado.value;
                                        return (
                                          <button
                                            key={estado.value}
                                            onClick={() => hasEditAccess && updateRow(row.id, 'estadoMultimedia', estado.value)}
                                            disabled={!hasEditAccess}
                                            title={estado.label}
                                            style={{
                                              width: esActivo ? '15px' : '10px',
                                              height: esActivo ? '15px' : '10px',
                                              borderRadius: '50%',
                                              backgroundColor: estado.color,
                                              border: 'none',
                                              padding: 0,
                                              cursor: hasEditAccess ? 'pointer' : 'default',
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

                                {/* TAREA */}
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                                    <button 
                                      className="icon-btn" 
                                      style={{ color: getTaskIconColor(row.id), padding: '4px' }} 
                                      onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin clase', row.nro)}
                                      title="Crear tarea / observación"
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

                                {/* VIDEOS (Drive, Vimeo, Subtitulos) */}
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>

                                {/* GENIALLY Link */}
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>

                                {/* ESTADO */}
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>

                                {/* TAREA */}
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                                    <button 
                                      className="icon-btn" 
                                      style={{ color: getTaskIconColor(row.id, 'var(--text-muted)'), padding: '4px', cursor: 'pointer' }} 
                                      onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin clase', row.nro)}
                                      title="Crear tarea / observación"
                                    >
                                      <ClipboardList size={16} />
                                    </button>
                                    <button
                                      className="icon-btn"
                                      style={{ color: 'var(--text-muted)', padding: '4px', cursor: 'pointer', opacity: 0.5 }}
                                      onClick={() => setHistoryRow({ id: row.id, label: `Clase ${row.nro} - ${row.modulo || 'Sin clase'}` })}
                                      title="Ver historial de cambios"
                                    >
                                      <Clock size={16} />
                                    </button>
                                  </div>
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
      {previewMultimedia && (
        <MultimediaPreviewModal
          type={previewMultimedia.type}
          urlOrId={previewMultimedia.urlOrId}
          title={previewMultimedia.title}
          onClose={() => setPreviewMultimedia(null)}
        />
      )}

      {historyRow && (
        <HistoryDrawer
          rowId={historyRow.id}
          courseId={courseId}
          rowLabel={historyRow.label}
          panel={2}
          onRestored={() => {}}
          onClose={() => setHistoryRow(null)}
        />
      )}
      {DialogRenderer}
    </div>
  );
};

export default MultimediaTable;
