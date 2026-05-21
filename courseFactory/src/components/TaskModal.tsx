import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { User, Course, Task } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: {
    title: string;
    description: string;
    courseId?: string;
    courseName?: string;
    rowId?: string;
    rowNro?: string;
    rowModulo?: string;
    panelName: string;
    assignedTo: string;
    assignedToName: string;
    dueDate?: string;
  }) => void;
  onUpdateTask?: (taskId: string, updatedData: {
    title: string;
    description: string;
    courseId?: string;
    courseName?: string;
    rowId?: string;
    rowNro?: string;
    rowModulo?: string;
    panelName: string;
    assignedTo: string;
    assignedToName: string;
    dueDate?: string;
  }) => void;
  users: User[];
  courses: Course[];
  currentUser: User;
  prefilledCourseId?: string;
  prefilledRowId?: string;
  prefilledRowNro?: string;
  prefilledRowModulo?: string;
  prefilledPanelName?: string;
  prefilledDueDate?: string;
  taskToEdit?: Task;
}

const PANELS = ['Biblioteca', 'Contenido', 'Multimedia', 'Verificación', 'Maquetado', 'Sistemas', 'Analítica'];

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  onUpdateTask,
  users,
  courses,
  currentUser,
  prefilledCourseId,
  prefilledRowId,
  prefilledRowNro,
  prefilledRowModulo,
  prefilledPanelName,
  prefilledDueDate,
  taskToEdit
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState(prefilledCourseId || '');
  const [panelName, setPanelName] = useState(prefilledPanelName || 'Contenido');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync state with prefilled values when modal opens
  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setTitle(taskToEdit.title);
        setDescription(taskToEdit.description);
        setCourseId(taskToEdit.courseId || '');
        setPanelName(taskToEdit.panelName);
        setAssignedTo(taskToEdit.assignedTo);
        setDueDate(taskToEdit.dueDate || '');
      } else {
        setTitle('');
        setDescription('');
        setCourseId(prefilledCourseId || (prefilledPanelName === 'Biblioteca' ? '' : (courses.length > 0 ? courses[0].id : '')));
        setPanelName(prefilledPanelName || 'Contenido');
        setDueDate(prefilledDueDate || '');
        setAssignedTo('');
      }
      setError(null);
    }
  }, [isOpen, prefilledCourseId, prefilledPanelName, prefilledDueDate, courses, taskToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Por favor, ingresa un título para la tarea.');
      return;
    }
    if (!assignedTo) {
      setError('Por favor, selecciona un usuario para asignar la tarea.');
      return;
    }

    const selectedUser = users.find(u => u.id === assignedTo);
    if (!selectedUser) {
      setError('Usuario asignado no es válido.');
      return;
    }

    const selectedCourse = courses.find(c => c.id === courseId);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      courseId: courseId || undefined,
      courseName: selectedCourse ? selectedCourse.name : undefined,
      rowId: taskToEdit ? taskToEdit.rowId : prefilledRowId,
      rowNro: taskToEdit ? taskToEdit.rowNro : prefilledRowNro,
      rowModulo: taskToEdit ? taskToEdit.rowModulo : prefilledRowModulo,
      panelName,
      assignedTo,
      assignedToName: selectedUser.name,
      dueDate: dueDate || undefined
    };

    if (taskToEdit && onUpdateTask) {
      onUpdateTask(taskToEdit.id, payload);
    } else {
      onCreateTask(payload);
    }

    onClose();
  };

  const selectedCourse = courses.find(c => c.id === courseId);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '520px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)'
        }}>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 600 }}>
            {taskToEdit ? '✏️ Editar Tarea' : '📋 Nueva Observación / Tarea'}
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '4px',
              borderRadius: '6px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Context Info (if prefilled from a row) */}
          {(prefilledRowId || prefilledCourseId) && (
            <div style={{
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)'
            }}>
              <strong>Detalles del origen:</strong>
              <div style={{ marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                {selectedCourse && <span>📖 Curso: {selectedCourse.name}</span>}
                {prefilledPanelName && <span>🖥️ Panel: {prefilledPanelName}</span>}
                {prefilledRowModulo && <span>📁 Módulo: {prefilledRowModulo}</span>}
                {prefilledRowNro && <span>📝 Clase Nro: {prefilledRowNro}</span>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Title */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Título / Asunto
              </label>
              <input
                type="text"
                placeholder="Ej: Corregir link del video, revisar ortografía..."
                value={title}
                onChange={e => { setTitle(e.target.value); setError(null); }}
                className="input-field"
                style={{ width: '100%', background: 'var(--bg-primary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Observación / Detalles
              </label>
              <textarea
                placeholder="Describe el problema o el cambio que se debe realizar..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  height: '100px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.8rem',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Course Selector (if not prefilled) */}
              {!prefilledCourseId && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Curso
                  </label>
                  <select
                    value={courseId}
                    onChange={e => setCourseId(e.target.value)}
                    className="cell-select"
                    style={{ width: '100%', height: '40px', padding: '0 0.5rem' }}
                  >
                    <option value="">-- General (Sin curso) --</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Panel Selector (if not prefilled) */}
              {!prefilledPanelName && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Panel Asociado
                  </label>
                  <select
                    value={panelName}
                    onChange={e => setPanelName(e.target.value)}
                    className="cell-select"
                    style={{ width: '100%', height: '40px', padding: '0 0.5rem' }}
                  >
                    {PANELS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Assignee */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Asignar a
                </label>
                <select
                  value={assignedTo}
                  onChange={e => { setAssignedTo(e.target.value); setError(null); }}
                  className="cell-select"
                  style={{ width: '100%', height: '40px', padding: '0 0.5rem' }}
                  required
                >
                  <option value="">-- Seleccionar usuario --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.toUpperCase()}) {u.id === currentUser.id ? ' - Mí' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Fecha Límite / Plazo
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', height: '40px', background: 'var(--bg-primary)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0 0.75rem' }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '2rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border)'
          }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
            >
              {taskToEdit ? 'Guardar Cambios' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
