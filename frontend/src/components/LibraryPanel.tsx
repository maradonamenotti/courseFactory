import React, { useState, useRef, useEffect, useCallback } from 'react';
import { type Course, type LibraryItem } from '../types';
import { libraryApi, filesApi } from '../services/api';
import type { ApiLibraryItem } from '../services/api';
import { Plus, Trash2, ExternalLink, Upload, Eye, Inbox, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';

interface LibraryPanelProps {
  courses: Course[];
  onAddLibraryItem: (descripcion: string, formato: string, links: string, fileName?: string, fileType?: string, fileUrl?: string) => void;
  onDeleteLibraryItem: (id: string) => void;
  onAssignLibraryItem: (itemId: string, courseId: string, materia: string, modulo: string) => void;
  onAddLibraryItemTask: (itemId: string, descripcion: string) => void;
}

const PAGE_SIZE = 15;

const formatOptions = ['VIDEO', 'TEXTO', 'CUESTIONARIO', 'GENIALLY', 'PDF', 'OTRO'];

const LibraryRow: React.FC<{
  item: LibraryItem;
  courses: Course[];
  onAssign: (itemId: string, courseId: string, materia: string, modulo: string) => void;
  onDelete: (id: string) => void;
  onAddTask: (itemId: string, descripcion: string) => void;
}> = ({ item, courses, onAssign, onDelete, onAddTask }) => {
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
    // fileUrl = URL de Cloudinary (persistente) si hay archivo subido
    // link = URL manual ingresada a mano
    const finalLink = fileUrl || link.trim();
    onAddLibraryItem(desc.trim(), format, finalLink, fileName || undefined, fileType || undefined, fileUrl || undefined);
    setDesc('');
    setLink('');
    setFileName('');
    setFileType('');
    setFileUrl('');
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
      setFileName(result.fileName);
      setFileType(result.fileType);
    } catch (err) {
      console.error('Error subiendo archivo:', err);
      alert(err instanceof Error ? err.message : 'Error al subir el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearFile = () => {
    setLink('');
    setFileName('');
    setFileType('');
    setFileUrl('');
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

    </div>
  );
};

export default LibraryPanel;
