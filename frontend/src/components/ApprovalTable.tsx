import React, { useState, useEffect } from 'react';
import { ExternalLink, ClipboardList, PlayCircle, X } from 'lucide-react';
import { type CourseRow, approvalOptions, finalStatusOptions } from '../types';

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

interface ApprovalTableProps {
  rows: CourseRow[];
  updateRow: (id: string, field: keyof CourseRow, value: string) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
}

const ApprovalTable: React.FC<ApprovalTableProps> = ({ rows, updateRow, onAddRowTask }) => {
  const [previewVimeoId, setPreviewVimeoId] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const getApprovalColor = (status: string) => {
    return approvalOptions.find(opt => opt.value === status)?.color || 'white';
  };

  const getFinalStatusColor = (status: string) => {
    return finalStatusOptions.find(opt => opt.value === status)?.color || 'white';
  };

  return (
    <div className="table-wrapper glass-panel">
      <div className="table-responsive">
        <table className="content-table approval-table">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>NRO</th>
              <th style={{ width: '14%' }}>Módulo / Clase</th>
              <th style={{ width: '10%' }}>Ver Material</th>
              <th style={{ width: '13%' }}>Rev. Contenido</th>
              <th style={{ width: '13%' }}>Rev. Multimedia</th>
              <th style={{ width: '30%' }}>Comentarios del Revisor</th>
              <th style={{ width: '12%' }}>Visto Bueno Final</th>
              <th style={{ width: '4%' }}>Tarea</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isAvailable = row.estado === '4-DISPONIBLE';
              
              return (
                <tr 
                  key={row.id} 
                  className={row.estadoFinal === 'LISTO PARA MOODLE' ? 'row-approved' : ''}
                  style={!isAvailable ? { opacity: 0.55, background: 'rgba(255, 255, 255, 0.02)', filter: 'grayscale(80%)' } : {}}
                  title={!isAvailable ? "Este contenido aún no está DISPONIBLE para verificación" : ""}
                >
                  <td className="readonly-cell">{row.nro}</td>
                  <td className="readonly-cell">
                    <div><strong>{row.modulo || 'Sin módulo'}</strong></div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>{row.descripcion}</div>
                  </td>

                  {/* Ver Material — links de acceso rápido */}
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
                            background: 'rgba(139,92,246,0.15)',
                            color: 'var(--accent)',
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
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.28)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.12)')}
                          >
                            <PlayCircle size={11} /> Ver Video
                          </button>
                          <a
                            href={row.videoVimeo}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Abrir link en Vimeo: ${row.videoVimeo}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              background: 'rgba(16,185,129,0.06)',
                              color: '#10b981',
                              textDecoration: 'none',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.06)')}
                          >
                            <ExternalLink size={11} />
                          </a>
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
                      {!row.links && !row.videoDrive && !row.videoVimeo && !row.geniallyUrl && (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>Sin links</span>
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

                  {/* Comentarios */}
                  <td>
                    <input
                      type="text"
                      className="cell-input"
                      value={row.comentariosRevisor}
                      placeholder="Escribir feedback o correcciones..."
                      onChange={(e) => updateRow(row.id, 'comentariosRevisor', e.target.value)}
                      disabled={!isAvailable}
                    />
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
                        onChange={(e) => updateRow(row.id, 'estadoFinal', e.target.value)}
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
                      onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin módulo', row.nro)}
                      title="Crear tarea / observación"
                      disabled={!isAvailable}
                    >
                      <ClipboardList size={16} />
                    </button>
                  </td>
                </tr>
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

export default ApprovalTable;
