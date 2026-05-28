import React, { useState, useRef, useEffect, useCallback } from 'react';
import { type Course, type LibraryItem } from '../types';
import { libraryApi, filesApi, vimeoApi } from '../services/api';
import type { ApiLibraryItem } from '../services/api';
import { Plus, Trash2, ExternalLink, Upload, Eye, Inbox, ClipboardList, ChevronLeft, ChevronRight, Loader2, PlayCircle, X } from 'lucide-react';

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

const LibraryRow: React.FC<{
  item: LibraryItem;
  courses: Course[];
  onAssign: (itemId: string, courseId: string, materia: string, modulo: string) => void;
  onDelete: (id: string) => void;
  onAddTask: (itemId: string, descripcion: string) => void;
  onPreviewVimeo?: (vimeoId: string, title: string) => void;
}> = ({ item, courses, onAssign, onDelete, onAddTask, onPreviewVimeo }) => {
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

  const getFormatBadgeClass = (fmt: string) => {
    switch (fmt) {
      case 'VIDEO': return 'formato-badge--video';
      case 'GENIALLY': return 'formato-badge--genially';
      default: return '';
    }
  };

  const isFile = item.fileName && item.fileType && item.fileType !== 'link';

  return (
    <tr>
      <td className="readonly-cell" style={{ fontSize: '0.8rem' }}>
        {new Date(item.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </td>
      <td>
        <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{item.descripcion}</span>
      </td>
      <td>
        <span className={`formato-badge ${getFormatBadgeClass(item.formato)}`} style={!getFormatBadgeClass(item.formato) ? { background: 'var(--border)', color: 'var(--text-muted)' } : undefined}>
          {item.formato}
        </span>
      </td>
      <td>
        {item.formato === 'VIDEO' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
            {/* Drive / Archivo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Drive:</span>
              {isFile ? (
                <span style={{ color: 'var(--accent)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={item.fileName || ''}>
                  📁 {item.fileName}
                </span>
              ) : (
                <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={item.videoDrive || item.links}>
                  {item.videoDrive || item.links || '—'}
                </span>
              )}
              {(item.videoDrive || item.links) && (
                <a 
                  href={item.videoDrive || item.links} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', padding: '3px', borderRadius: '4px', background: 'rgba(139,92,246,0.08)', color: 'var(--accent)' }}
                  title={isFile ? "Ver Archivo" : "Abrir Enlace de Drive"}
                >
                  {isFile ? <Eye size={11} /> : <ExternalLink size={11} />}
                </a>
              )}
            </div>

            {/* Vimeo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Vimeo:</span>
              <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={item.videoVimeo || ''}>
                {item.videoVimeo || '—'}
              </span>
              {item.videoVimeo && (
                <>
                  {(() => {
                    const vId = extractVimeoId(item.videoVimeo || '');
                    return vId && onPreviewVimeo ? (
                      <button
                        type="button"
                        onClick={() => onPreviewVimeo(vId, item.descripcion)}
                        title="Previsualizar video de Vimeo"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '3px',
                          borderRadius: '4px',
                          color: '#10b981',
                          background: 'rgba(16,185,129,0.12)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <PlayCircle size={11} />
                      </button>
                    ) : null;
                  })()}
                  <a 
                    href={item.videoVimeo} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', padding: '3px', borderRadius: '4px', background: 'rgba(139,92,246,0.08)', color: 'var(--accent)' }}
                    title="Abrir Enlace de Vimeo"
                  >
                    <ExternalLink size={11} />
                  </a>
                </>
              )}
            </div>

            {/* Subtítulos */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.3rem' }}>
              <span>Subtítulos:</span>
              <span style={{ fontWeight: 600, color: item.videoSubtitulos === 'SI' ? '#10b981' : 'var(--text-muted)' }}>
                {item.videoSubtitulos || 'NO'}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isFile ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 500 }}>
                📁 {item.fileName}
              </span>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.links}>
                {item.links}
              </span>
            )}
            {item.links && (
              <a 
                href={item.links} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px', background: 'rgba(139,92,246,0.08)', color: 'var(--accent)' }}
                title={isFile ? "Ver Archivo" : "Abrir Enlace"}
              >
                {isFile ? <Eye size={12} /> : <ExternalLink size={12} />}
              </a>
            )}
          </div>
        )}
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
          {/* Select Course */}
          <select 
            className="cell-select" 
            value={selectedCourseId} 
            onChange={e => handleCourseChange(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '0.3rem 1.5rem 0.3rem 0.5rem' }}
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
                style={{ fontSize: '0.8rem', padding: '0.3rem 1.5rem 0.3rem 0.5rem' }}
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
                  placeholder="Nombre de la nueva materia..." 
                  value={customMateria}
                  onChange={e => setCustomMateria(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.3rem' }}
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
                  style={{ fontSize: '0.8rem', padding: '0.3rem 1.5rem 0.3rem 0.5rem' }}
                >
                  <option value="">-- Seleccionar Clase --</option>
                  {modulos.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__NEW__">+ Nueva Clase...</option>
                </select>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                  Creando clase para nueva materia:
                </span>
              )}

              {(selectedMateria === '__NEW__' || selectedModulo === '__NEW__') && (
                <input 
                  type="text" 
                  className="cell-input" 
                  placeholder="Nombre de la nueva clase..." 
                  value={customModulo}
                  onChange={e => setCustomModulo(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                />
              )}
            </>
          )}
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
          <button 
            className="btn btn-sm btn-primary" 
            onClick={handleAssignClick}
            disabled={!isFormValid()}
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
            title="Asignar al curso y remover de biblioteca"
          >
            Asignar
          </button>
          <button 
            className="icon-btn" 
            onClick={() => onAddTask(item.id, item.descripcion)}
            style={{ padding: '4px', color: 'var(--accent)', background: 'rgba(139,92,246,0.08)' }}
            title="Añadir Tarea/Observación"
          >
            <ClipboardList size={15} />
          </button>
          <button 
            className="icon-btn danger" 
            onClick={() => onDelete(item.id)}
            style={{ padding: '4px' }}
            title="Eliminar de biblioteca"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
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
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      borderRadius: '0 0 12px 12px',
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
      alert(err instanceof Error ? err.message : 'Error al subir el archivo');
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
      alert(err instanceof Error ? err.message : 'Error al subir el video a Vimeo');
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
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      
      {/* Cargar nuevo recurso Form */}
      <div className="glass-panel" style={{ padding: '1.5rem', position: 'sticky', top: '20px' }}>
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
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="table-wrapper glass-panel" style={{ margin: 0, borderRadius: items.length > 0 ? '12px 12px 0 0' : '12px', flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
              Cargando recursos...
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <Inbox size={48} style={{ color: 'var(--text-muted)' }} />
              <h4 style={{ color: 'var(--text-secondary)', margin: 0 }}>La biblioteca está vacía</h4>
              <p className="text-muted" style={{ maxWidth: '400px', margin: 0, fontSize: '0.9rem' }}>
                Los recursos subidos aquí por el equipo de multimedia estarán disponibles para ser visualizados y luego asignados a materias y clases por el equipo de contenidos.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="content-table">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>Fecha</th>
                    <th style={{ width: '25%' }}>Descripción del recurso</th>
                    <th style={{ width: '10%' }}>Formato</th>
                    <th style={{ width: '20%' }}>Enlace / Archivo</th>
                    <th style={{ width: '25%' }}>Asignar Destino</th>
                    <th style={{ width: '8%', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <LibraryRow 
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
                </tbody>
              </table>
            </div>
          )}
        </div>

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
    </div>
  );
};

export default LibraryPanel;
