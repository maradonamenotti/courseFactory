import React, { useState, useRef } from 'react';
import { type Course, type LibraryItem } from '../types';
import { Plus, Trash2, ExternalLink, Upload, Eye, Inbox, ClipboardList } from 'lucide-react';

interface LibraryPanelProps {
  courses: Course[];
  libraryItems: LibraryItem[];
  onAddLibraryItem: (descripcion: string, formato: string, links: string, fileName?: string, fileType?: string) => void;
  onDeleteLibraryItem: (id: string) => void;
  onAssignLibraryItem: (itemId: string, courseId: string, materia: string, modulo: string) => void;
  onAddLibraryItemTask: (itemId: string, descripcion: string) => void;
}

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
                  <option value="">-- Seleccionar Módulo --</option>
                  {modulos.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__NEW__">+ Nuevo Módulo...</option>
                </select>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                  Creando módulo para nueva materia:
                </span>
              )}

              {(selectedMateria === '__NEW__' || selectedModulo === '__NEW__') && (
                <input 
                  type="text" 
                  className="cell-input" 
                  placeholder="Nombre del nuevo módulo..." 
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

const LibraryPanel: React.FC<LibraryPanelProps> = ({
  courses,
  libraryItems,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLink(URL.createObjectURL(file));
      setFileName(file.name);
      setFileType(file.type);
    }
    e.target.value = '';
  };

  const handleAddClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) return;
    onAddLibraryItem(desc.trim(), format, link.trim(), fileName, fileType);
    setDesc('');
    setLink('');
    setFileName('');
    setFileType('');
  };

  const handleClearFile = () => {
    setLink('');
    setFileName('');
    setFileType('');
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
            
            {fileName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', padding: '0.4rem 0.6rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  📁 {fileName}
                </span>
                <button 
                  type="button" 
                  onClick={handleClearFile} 
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
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
                  title="Subir archivo local"
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

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            <Plus size={16} /> Añadir a Biblioteca
          </button>
        </form>
      </div>

      {/* Biblioteca List */}
      <div className="table-wrapper glass-panel" style={{ margin: 0 }}>
        {libraryItems.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Inbox size={48} style={{ color: 'var(--text-muted)' }} />
            <h4 style={{ color: 'var(--text-secondary)', margin: 0 }}>La biblioteca está vacía</h4>
            <p className="text-muted" style={{ maxWidth: '400px', margin: 0, fontSize: '0.9rem' }}>
              Los recursos subidos aquí por el equipo de multimedia estarán disponibles para ser visualizados y luego asignados a materias y módulos por el equipo de contenidos.
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
                {libraryItems.map(item => (
                  <LibraryRow 
                    key={item.id} 
                    item={item} 
                    courses={courses} 
                    onAssign={onAssignLibraryItem} 
                    onDelete={onDeleteLibraryItem}
                    onAddTask={onAddLibraryItemTask}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default LibraryPanel;
