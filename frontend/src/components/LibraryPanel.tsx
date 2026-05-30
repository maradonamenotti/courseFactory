import React, { useState, useRef, useEffect, useCallback } from 'react';
import { type Course, type LibraryItem } from '../types';
import { libraryApi, filesApi, vimeoApi } from '../services/api';
import type { ApiLibraryItem } from '../services/api';
import { Plus, Trash2, ExternalLink, Upload, Eye, Inbox, ClipboardList, ChevronLeft, ChevronRight, Loader2, PlayCircle, X } from 'lucide-react';
import { useDialog } from './CustomDialog';

interface LibraryPanelProps {
  courses: Course[];
  onAddLibraryItem: (
    descripcion: string,
    formato: string,
    links: string,
    fileName?: string,
    fileType?: string,
    fileUrl?: string,
    videoDrive?: string,
    videoVimeo?: string,
    videoSubtitulos?: string
  ) => void;
  onDeleteLibraryItem: (id: string) => void;
  onAssignLibraryItem: (itemId: string, courseId: string, materia: string, modulo: string) => void;
  onAddLibraryItemTask: (itemId: string, descripcion: string) => void;
}

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

const PAGE_SIZE = 15;

const formatOptions = ['VIDEO', 'TEXTO', 'CUESTIONARIO', 'GENIALLY', 'PDF', 'OTRO'];

const getFormatBadgeStyle = (fmt: string) => {
  switch (fmt) {
    case 'VIDEO':
      return { background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.25)' };
    case 'GENIALLY':
      return { background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.25)' };
    case 'TEXTO':
      return { background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.25)' };
    case 'PDF':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)' };
    case 'CUESTIONARIO':
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.25)' };
    default:
      return { background: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.25)' };
  }
};

const LibraryCard: React.FC<{
  item: LibraryItem;
  courses: Course[];
  onAssign: (itemId: string, courseId: string, materia: string, modulo: string) => void;
  onDelete: (id: string) => void;
  onAddTask: (itemId: string, descripcion: string) => void;
  onPreviewVimeo?: (vimeoId: string, title: string) => void;
}> = ({ item, courses, onAssign, onDelete, onAddTask, onPreviewVimeo }) => {
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedMateria, setSelectedMateria] = useState('');
  const [customMateria, setCustomMateria] = useState('');
  const [selectedModulo, setSelectedModulo] = useState('');
  const [customModulo, setCustomModulo] = useState('');

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Extract existing materias in selected course
  const materias = selectedCourse
    ? Array.from(new Set(selectedCourse.rows.map(r => r.materia).filter(Boolean)))
    : [];

  // Extract existing modules in selected materia
  const modulos = selectedCourse && selectedMateria && selectedMateria !== '__NEW__'
    ? Array.from(new Set(selectedCourse.rows.filter(r => r.materia === selectedMateria).map(r => r.modulo).filter(Boolean)))
    : [];

  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedMateria('');
    setCustomMateria('');
    setSelectedModulo('');
    setCustomModulo('');
  };

  const handleMateriaChange = (materia: string) => {
    setSelectedMateria(materia);
    setCustomMateria('');
    setSelectedModulo('');
    setCustomModulo('');
  };

  const handleModuloChange = (modulo: string) => {
    setSelectedModulo(modulo);
    setCustomModulo('');
  };

  const isFormValid = () => {
    if (!selectedCourseId) return false;
    
    const finalMateria = selectedMateria === '__NEW__' ? customMateria.trim() : selectedMateria;
    if (!finalMateria) return false;

    const finalModulo = (selectedMateria === '__NEW__' || selectedModulo === '__NEW__') 
      ? customModulo.trim() 
      : selectedModulo;
    if (!finalModulo) return false;

    return true;
  };

  const handleAssignClick = () => {
    if (!isFormValid()) return;
    const finalMateria = selectedMateria === '__NEW__' ? customMateria.trim() : selectedMateria;
    const finalModulo = (selectedMateria === '__NEW__' || selectedModulo === '__NEW__') 
      ? customModulo.trim() 
      : selectedModulo;

    onAssign(item.id, selectedCourseId, finalMateria, finalModulo);
  };

  const isFile = item.fileName && item.fileType && item.fileType !== 'link';

  return (
    <div 
      className="glass-panel" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
        padding: '1.25rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        position: 'relative',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0, 229, 204, 0.25)';
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.3), 0 0 1px 0 rgba(0, 229, 204, 0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Top row: Format Badge & Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span 
          style={{
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            ...getFormatBadgeStyle(item.formato)
          }}
        >
          {item.formato}
        </span>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          {new Date(item.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Description / Name */}
      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.98rem', lineHeight: '1.4' }}>
        {item.descripcion}
      </div>

      {/* Resource Box */}
      <div 
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: '10px',
          padding: '0.75rem 0.9rem',
          fontSize: '0.82rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}
      >
        {item.formato === 'VIDEO' ? (
          <>
            {/* Drive Link */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem' }}>DRIVE:</span>
                {isFile ? (
                  <span style={{ color: 'var(--accent)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.fileName || ''}>
                    📁 {item.fileName}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.videoDrive || item.links}>
                    {item.videoDrive || item.links || '—'}
                  </span>
                )}
              </div>
              {(item.videoDrive || item.links) && (
                <a 
                  href={item.videoDrive || item.links} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-icon btn-sm"
                  style={{ padding: '4px', background: 'rgba(139,92,246,0.06)', color: 'var(--accent)', border: 'none', borderRadius: '4px', display: 'flex' }}
                  title={isFile ? "Ver Archivo" : "Abrir Enlace de Drive"}
                >
                  {isFile ? <Eye size={12} /> : <ExternalLink size={12} />}
                </a>
              )}
            </div>

            {/* Vimeo Link */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem' }}>VIMEO:</span>
                <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.videoVimeo || ''}>
                  {item.videoVimeo || '—'}
                </span>
              </div>
              {item.videoVimeo && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(() => {
                    const vId = extractVimeoId(item.videoVimeo || '');
                    return vId && onPreviewVimeo ? (
                      <button
                        type="button"
                        onClick={() => onPreviewVimeo(vId, item.descripcion)}
                        title="Previsualizar video de Vimeo"
                        className="btn btn-icon btn-sm"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px',
                          borderRadius: '4px',
                          color: '#10b981',
                          background: 'rgba(16,185,129,0.1)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <PlayCircle size={12} />
                      </button>
                    ) : null;
                  })()}
                  <a 
                    href={item.videoVimeo} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-icon btn-sm"
                    style={{ padding: '4px', background: 'rgba(139,92,246,0.06)', color: 'var(--accent)', border: 'none', borderRadius: '4px', display: 'flex' }}
                    title="Abrir Enlace de Vimeo"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            {/* Subtítulos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem' }}>SUBTÍTULOS:</span>
              <span 
                style={{ 
                  fontWeight: 700, 
                  fontSize: '0.76rem',
                  color: item.videoSubtitulos === 'SI' ? '#10b981' : 'var(--text-muted)',
                  background: item.videoSubtitulos === 'SI' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                  padding: '1px 6px',
                  borderRadius: '4px'
                }}
              >
                {item.videoSubtitulos || 'NO'}
              </span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem' }}>LINK/ARCH:</span>
              {isFile ? (
                <span style={{ color: 'var(--accent)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.fileName || ''}>
                  📁 {item.fileName}
                </span>
              ) : (
                <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.links}>
                  {item.links}
                </span>
              )}
            </div>
            {item.links && (
              <a 
                href={item.links} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-icon btn-sm"
                style={{ padding: '4px', background: 'rgba(139,92,246,0.06)', color: 'var(--accent)', border: 'none', borderRadius: '4px', display: 'flex' }}
                title={isFile ? "Ver Archivo" : "Abrir Enlace"}
              >
                {isFile ? <Eye size={12} /> : <ExternalLink size={12} />}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Action Footer row */}
      {!isAssigning ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '0.3rem' }}>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={() => setIsAssigning(true)}
            style={{ flex: 1, padding: '0.45rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '8px' }}
          >
            Asignar a Curso
          </button>
          
          <button 
            className="icon-btn" 
            onClick={() => onAddTask(item.id, item.descripcion)}
            style={{ padding: '8px', borderRadius: '8px', color: 'var(--accent)', background: 'rgba(139,92,246,0.06)' }}
            title="Añadir Tarea/Observación"
          >
            <ClipboardList size={15} />
          </button>
          
          <button 
            className="icon-btn danger" 
            onClick={() => onDelete(item.id)}
            style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239,68,68,0.06)' }}
            title="Eliminar de biblioteca"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        /* Expandable Inline assignment section */
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            background: 'rgba(255,255,255,0.01)', 
            border: '1px dashed var(--border)',
            borderRadius: '10px',
            padding: '0.8rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            ASIGNAR DESTINO
          </div>

          {/* Select Course */}
          <select 
            className="cell-select" 
            value={selectedCourseId} 
            onChange={e => handleCourseChange(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '0.4rem 1.5rem 0.4rem 0.5rem', width: '100%', height: '34px', background: 'var(--bg-primary)' }}
          >
            <option value="">-- Seleccionar Curso --</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Select Materia */}
          {selectedCourseId && (
            <>
              <select 
                className="cell-select" 
                value={selectedMateria} 
                onChange={e => handleMateriaChange(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '0.4rem 1.5rem 0.4rem 0.5rem', width: '100%', height: '34px', background: 'var(--bg-primary)' }}
              >
                <option value="">-- Seleccionar Materia --</option>
                {materias.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="__NEW__">+ Nueva Materia...</option>
              </select>
              
              {selectedMateria === '__NEW__' && (
                <input 
                  type="text" 
                  className="cell-input" 
                  placeholder="Nombre de nueva materia..." 
                  value={customMateria}
                  onChange={e => setCustomMateria(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem', height: '34px', background: 'var(--bg-primary)' }}
                />
              )}
            </>
          )}

          {/* Select Modulo */}
          {selectedCourseId && selectedMateria && (
            <>
              {selectedMateria !== '__NEW__' ? (
                <select 
                  className="cell-select" 
                  value={selectedModulo} 
                  onChange={e => handleModuloChange(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 1.5rem 0.4rem 0.5rem', width: '100%', height: '34px', background: 'var(--bg-primary)' }}
                >
                  <option value="">-- Seleccionar Clase --</option>
                  {modulos.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__NEW__">+ Nueva Clase...</option>
                </select>
              ) : (
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                  Clase para nueva materia:
                </span>
              )}

              {(selectedMateria === '__NEW__' || selectedModulo === '__NEW__') && (
                <input 
                  type="text" 
                  className="cell-input" 
                  placeholder="Nombre de nueva clase..." 
                  value={customModulo}
                  onChange={e => setCustomModulo(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem', height: '34px', background: 'var(--bg-primary)' }}
                />
              )}
            </>
          )}

          {/* Assignment action buttons */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '0.2rem' }}>
            <button 
              className="btn btn-sm btn-primary" 
              onClick={handleAssignClick}
              disabled={!isFormValid()}
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.78rem', height: '32px' }}
            >
              Confirmar
            </button>
            <button 
              className="btn btn-sm btn-outline" 
              onClick={() => setIsAssigning(false)}
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.78rem', height: '32px', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Pagination Controls ──────────────────────────────────────────────────────
const PaginationBar: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPrev: () => void;
  onNext: () => void;
  isLoading: boolean;
}> = ({ page, totalPages, total, limit, onPrev, onNext, isLoading }) => {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1.25rem',
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      borderRadius: '12px',
      marginTop: '1rem'
    }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        {total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total} recursos`}
      </span>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          className="icon-btn"
          onClick={onPrev}
          disabled={page <= 1 || isLoading}
          title="Página anterior"
          style={{
            padding: '6px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: page <= 1 ? 'transparent' : 'var(--bg-primary)',
            opacity: page <= 1 ? 0.4 : 1,
            cursor: page <= 1 ? 'not-allowed' : 'pointer',
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', minWidth: '80px', textAlign: 'center' }}>
          Pág. {page} / {Math.max(1, totalPages)}
        </span>
        <button
          className="icon-btn"
          onClick={onNext}
          disabled={page >= totalPages || isLoading}
          title="Página siguiente"
          style={{
            padding: '6px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: page >= totalPages ? 'transparent' : 'var(--bg-primary)',
            opacity: page >= totalPages ? 0.4 : 1,
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────
const LibraryPanel: React.FC<LibraryPanelProps> = ({
  courses,
  onAddLibraryItem,
  onDeleteLibraryItem,
  onAssignLibraryItem,
  onAddLibraryItemTask
}) => {
  const { showAlert, DialogRenderer } = useDialog();
  const [desc, setDesc] = useState('');
  const [format, setFormat] = useState('VIDEO');
  const [link, setLink] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [fileUrl, setFileUrl] = useState('');        // URL persistente en Cloudinary
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video states
  const [videoDrive, setVideoDrive] = useState('');
  const [videoVimeo, setVideoVimeo] = useState('');
  const [videoSubtitulos, setVideoSubtitulos] = useState('NO');
  const [vimeoUploading, setVimeoUploading] = useState(false);
  const vimeoInputRef = useRef<HTMLInputElement>(null);

  const [previewVimeoId, setPreviewVimeoId] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  // ── Pagination state ──────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const mapApiItem = (item: ApiLibraryItem): LibraryItem => ({
    id: item.id,
    descripcion: item.descripcion,
    formato: item.formato,
    links: item.links,
    fileName: item.fileName ?? undefined,
    fileType: item.fileType ?? undefined,
    videoDrive: item.videoDrive ?? undefined,
    videoVimeo: item.videoVimeo ?? undefined,
    videoSubtitulos: item.videoSubtitulos ?? undefined,
    createdAt: item.createdAt,
  });

  const fetchPage = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    try {
      const res = await libraryApi.getPaginated({ page: targetPage, limit: PAGE_SIZE });
      setItems(res.data.map(mapApiItem));
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setPage(targetPage);
    } catch (err) {
      console.error('Error cargando biblioteca:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchPage(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers that delegate to parent and then reload ──────────────────────
  const handleAddClick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) return;
    const finalLink = format === 'VIDEO' ? (videoDrive || fileUrl || link.trim()) : (fileUrl || link.trim());
    onAddLibraryItem(
      desc.trim(), 
      format, 
      finalLink, 
      fileName || undefined, 
      fileType || undefined, 
      fileUrl || undefined,
      format === 'VIDEO' ? (videoDrive || fileUrl || link.trim()) : undefined,
      format === 'VIDEO' ? videoVimeo : undefined,
      format === 'VIDEO' ? videoSubtitulos : undefined
    );
    setDesc('');
    setLink('');
    setFileName('');
    setFileType('');
    setFileUrl('');
    setVideoDrive('');
    setVideoVimeo('');
    setVideoSubtitulos('NO');
    // Give the parent's optimistic state a tick, then reload page 1
    setTimeout(() => fetchPage(1), 300);
  };

  const handleDelete = (id: string) => {
    onDeleteLibraryItem(id);
    // If last item on page > 1, go back one page; else reload current
    const isLastOnPage = items.length === 1 && page > 1;
    setTimeout(() => fetchPage(isLastOnPage ? page - 1 : page), 300);
  };

  const handleAssign = (itemId: string, courseId: string, materia: string, modulo: string) => {
    onAssignLibraryItem(itemId, courseId, materia, modulo);
    const isLastOnPage = items.length === 1 && page > 1;
    setTimeout(() => fetchPage(isLastOnPage ? page - 1 : page), 600);
  };

  /**
   * Sube el archivo a Cloudinary vía backend y guarda la URL permanente.
   * Ya no usa URL.createObjectURL (blob URL que desaparece al recargar).
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploading(true);
    try {
      const result = await filesApi.upload(file);
      setFileUrl(result.url);          // URL permanente de Cloudinary
      setLink(result.url);             // también en el campo link para mostrarlo
      setVideoDrive(result.url);       // para el formulario de video
      setFileName(result.fileName);
      setFileType(result.fileType);
    } catch (err) {
      console.error('Error subiendo archivo:', err);
      showAlert('Error', err instanceof Error ? err.message : 'Error al subir el archivo', 'danger');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLibraryVimeoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setVimeoUploading(true);
    try {
      const result = await vimeoApi.upload(file, desc.trim() || 'Video de biblioteca');
      setVideoVimeo(result.embedUrl);
    } catch (err) {
      console.error('Error subiendo a Vimeo:', err);
      showAlert('Error', err instanceof Error ? err.message : 'Error al subir el video a Vimeo', 'danger');
    } finally {
      setVimeoUploading(false);
    }
  };

  const handleClearFile = () => {
    setLink('');
    setFileName('');
    setFileType('');
    setFileUrl('');
    setVideoDrive('');
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'start' }}>
      
      {/* Cargar nuevo recurso Form */}
      <div className="glass-panel" style={{ width: '320px', flexShrink: 0, padding: '1.5rem', position: 'sticky', top: '20px' }}>
        <h4 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} style={{ color: 'var(--primary)' }} />
          Cargar Recurso
        </h4>
        
        <form onSubmit={handleAddClick} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
              Descripción
            </label>
            <input 
              type="text" 
              className="cell-input" 
              placeholder="Ej: Video de bienvenida..." 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              required
              style={{ border: '1px solid var(--border)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
              Formato de salida
            </label>
            <select 
              className="cell-select" 
              value={format} 
              onChange={e => setFormat(e.target.value)}
              style={{ border: '1px solid var(--border)' }}
            >
              {formatOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            {format === 'VIDEO' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {/* Drive Link */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Link de Drive
                  </label>
                  
                  {isUploading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                      <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--accent)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 500 }}>Subiendo a Cloudinary...</span>
                    </div>
                  ) : fileName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', padding: '0.4rem 0.6rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem' }}>☁️</span>
                      <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {fileName}
                      </span>
                      <button 
                        type="button" 
                        onClick={handleClearFile} 
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', lineHeight: 1 }}
                        title="Quitar archivo"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <input 
                        type="text" 
                        className="cell-input" 
                        placeholder="https://drive.google.com/..." 
                        value={videoDrive}
                        onChange={e => setVideoDrive(e.target.value)}
                        style={{ border: '1px solid var(--border)', flex: 1 }}
                      />
                      <button 
                        type="button" 
                        className="icon-btn" 
                        onClick={() => fileInputRef.current?.click()}
                        title="Subir archivo a Cloudinary"
                        style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Upload size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Vimeo Link */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Link de Vimeo
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <input 
                      type="text" 
                      className="cell-input" 
                      placeholder="https://player.vimeo.com/video/..." 
                      value={videoVimeo}
                      onChange={e => setVideoVimeo(e.target.value)}
                      style={{ border: '1px solid var(--border)', flex: 1 }}
                    />
                    <input 
                      type="file" 
                      ref={vimeoInputRef} 
                      style={{ display: 'none' }} 
                      onChange={handleLibraryVimeoUpload} 
                      accept="video/*"
                    />
                    {vimeoUploading ? (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                        <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite', color: '#13b7e5' }} />
                      </div>
                    ) : (
                      <button 
                        type="button" 
                        className="icon-btn" 
                        onClick={() => vimeoInputRef.current?.click()}
                        title="Subir video directamente a Vimeo"
                        style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#13b7e5', background: 'rgba(19,183,229,0.06)' }}
                      >
                        <Upload size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subtítulos */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Subtítulos
                  </label>
                  <select 
                    className="cell-select" 
                    value={videoSubtitulos} 
                    onChange={e => setVideoSubtitulos(e.target.value)}
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <option value="NO">NO</option>
                    <option value="SI">SI</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Link o Archivo
                </label>
                
                {isUploading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <div style={{ width: '14px', height: '14px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 500 }}>Subiendo a Cloudinary...</span>
                  </div>
                ) : fileName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', padding: '0.4rem 0.6rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem' }}>☁️</span>
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {fileName}
                    </span>
                    <button 
                      type="button" 
                      onClick={handleClearFile} 
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', lineHeight: 1 }}
                      title="Quitar archivo"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <input 
                      type="text" 
                      className="cell-input" 
                      placeholder="https://..." 
                      value={link}
                      onChange={e => setLink(e.target.value)}
                      style={{ border: '1px solid var(--border)', flex: 1 }}
                    />
                    <button 
                      type="button" 
                      className="icon-btn" 
                      onClick={() => fileInputRef.current?.click()}
                      title="Subir archivo a Cloudinary"
                      style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Upload size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
              accept=".pdf,.doc,.docx,.mp4,video/mp4,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isUploading}>
            <Plus size={16} /> {isUploading ? 'Subiendo...' : 'Añadir a Biblioteca'}
          </button>
        </form>
      </div>

      {/* Biblioteca List */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '320px' }}>
        {isLoading ? (
          <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', borderRadius: '12px' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', color: 'var(--primary)' }} />
            Cargando recursos...
          </div>
        ) : items.length === 0 ? (
          <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', borderRadius: '12px' }}>
            <Inbox size={48} style={{ color: 'var(--text-muted)' }} />
            <h4 style={{ color: 'var(--text-secondary)', margin: 0 }}>La biblioteca está vacía</h4>
            <p className="text-muted" style={{ maxWidth: '400px', margin: 0, fontSize: '0.9rem' }}>
              Los recursos subidos aquí por el equipo de multimedia estarán disponibles para ser visualizados y luego asignados a materias y clases por el equipo de contenidos.
            </p>
          </div>
        ) : (
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', 
              gap: '1.25rem',
              flex: 1,
              marginBottom: '1rem'
            }}
          >
            {items.map(item => (
              <LibraryCard 
                key={item.id} 
                item={item} 
                courses={courses} 
                onAssign={handleAssign} 
                onDelete={handleDelete}
                onAddTask={onAddLibraryItemTask}
                onPreviewVimeo={(vimeoId, title) => {
                  setPreviewVimeoId(vimeoId);
                  setPreviewTitle(title);
                }}
              />
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {(total > PAGE_SIZE || totalPages > 1) && (
          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            limit={PAGE_SIZE}
            onPrev={() => fetchPage(page - 1)}
            onNext={() => fetchPage(page + 1)}
            isLoading={isLoading}
          />
        )}
      </div>

      {previewVimeoId && (
        <VideoPreviewModal
          vimeoId={previewVimeoId}
          title={previewTitle}
          onClose={() => setPreviewVimeoId(null)}
        />
      )}
      {DialogRenderer}
    </div>
  );
};

export default LibraryPanel;
