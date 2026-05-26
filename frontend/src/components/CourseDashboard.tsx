import React, { useState } from 'react';
import { Plus, Search, BookOpen, LayoutGrid, FileText, User as UserIcon, LogOut, Layout, BarChart2, Users, Trash2, Sun, Moon, ChevronLeft, ChevronRight, Folder as FolderIcon, Edit, FolderSymlink, ClipboardList, Pencil } from 'lucide-react';
import { type Course, type User, type Folder, type Task } from '../types';
import { foldersApi, tasksApi } from '../services/api';
import type { ApiTask } from '../services/api';
import AnalyticsPanel from './AnalyticsPanel';
import UserManagement from './UserManagement';
import TaskModal from './TaskModal';
import { useDialog } from './CustomDialog';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';

interface CourseDashboardProps {
  courses: Course[];
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  user: User;
  onSelectCourse: (id: string) => void;
  onCreateCourse: (folderId?: string) => void;
  onDeleteCourse?: (id: string) => void;
  onDeleteFolder?: (id: string) => void;
  onMoveCourse: (courseId: string, folderId: string) => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onNavigateToTaskSource?: (courseId: string, panelName: string) => void;
}

const CourseDashboard: React.FC<CourseDashboardProps> = ({ 
  courses, 
  folders,
  setFolders,
  user, 
  onSelectCourse, 
  onCreateCourse,
  onDeleteCourse,
  onDeleteFolder,
  onMoveCourse,
  onLogout,
  theme,
  onToggleTheme,
  users,
  setUsers,
  tasks,
  setTasks,
  onNavigateToTaskSource
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'courses' | 'analytics' | 'users' | 'tasks'>('courses');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const { showAlert, showConfirm, showPrompt, showSelect, DialogRenderer } = useDialog();
  
  // Task Tab States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [calendarClickedDate, setCalendarClickedDate] = useState<string | undefined>(undefined);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'TODAS' | 'PENDIENTE' | 'EN_PROCESO' | 'RESUELTO'>('TODAS');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('MY_TASKS');
  const [taskCourseFilter, setTaskCourseFilter] = useState<string>('ALL');
  const [taskViewMode, setTaskViewMode] = useState<'kanban' | 'calendar'>('kanban');

  const mapApiTask = (t: ApiTask): Task => ({
    id: t.id,
    title: t.title,
    description: t.description,
    courseId: t.courseId ?? undefined,
    courseName: t.courseName ?? undefined,
    rowId: t.rowId ?? undefined,
    rowNro: t.rowNro ?? undefined,
    rowModulo: t.rowModulo ?? undefined,
    panelName: t.panelName,
    createdBy: t.createdBy,
    createdByName: t.createdByName,
    assignedTo: t.assignedTo,
    assignedToName: t.assignedToName,
    status: t.status as Task['status'],
    createdAt: t.createdAt,
    dueDate: t.dueDate ?? undefined,
  });

  const handleCreateTask = async (taskData: {
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
  }) => {
    try {
      const saved = await tasksApi.create({ ...taskData, createdByName: user.name });
      setTasks(prev => [...prev, mapApiTask(saved)]);
    } catch (err) { console.error(err); }
  };

  const handleUpdateTask = async (taskId: string, updatedData: {
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
  }) => {
    try {
      const saved = await tasksApi.update(taskId, updatedData);
      setTasks(prev => prev.map(t => t.id === taskId ? mapApiTask(saved) : t));
    } catch (err) { console.error(err); }
  };

  const handleToggleTaskStatus = async (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const nextStatus = t.status === 'PENDIENTE' ? 'EN_PROCESO' : t.status === 'EN_PROCESO' ? 'RESUELTO' : 'PENDIENTE';
      return { ...t, status: nextStatus };
    }));
    try {
      const saved = await tasksApi.cycleStatus(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? mapApiTask(saved) : t));
    } catch (err) { console.error(err); }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await tasksApi.delete(taskId);
    } catch (err) { console.error(err); }
  };

  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDrop = (e: React.DragEvent, targetStatus: 'PENDIENTE' | 'EN_PROCESO' | 'RESUELTO') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetStatus } : t));
      tasksApi.update(taskId, { status: targetStatus }).catch(console.error);
    }
  };
  
  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null;

  // Helper counts
  const getLicenseCount = (careerId: string) => {
    return folders.filter(f => f.type === 'licencia' && f.parentId === careerId).length;
  };

  const getCourseCount = (licenseId: string) => {
    return courses.filter(c => c.folderId === licenseId).length;
  };

  const getCareerCourseCount = (careerId: string) => {
    const licenses = folders.filter(f => f.type === 'licencia' && f.parentId === careerId).map(f => f.id);
    return courses.filter(c => c.folderId && licenses.includes(c.folderId)).length;
  };

  const pendingTasksCount = tasks.filter(t => t.assignedTo === user.id && t.status !== 'RESUELTO').length;
  
  // Global visibility check: Admin sees all, others see their own or assigned tasks.
  const visibleTasks = tasks.filter(t => user.role === 'admin' || t.assignedTo === user.id || t.createdBy === user.id);

  // Breadcrumbs path
  const getBreadcrumbs = () => {
    const path: { id: string | null; name: string }[] = [{ id: null, name: 'Inicio' }];
    if (!currentFolderId) return path;
    
    const folder = folders.find(f => f.id === currentFolderId);
    if (!folder) return path;
    
    if (folder.type === 'licencia') {
      const parentCareer = folders.find(f => f.id === folder.parentId);
      if (parentCareer) {
        path.push({ id: parentCareer.id, name: parentCareer.name });
      }
    }
    path.push({ id: folder.id, name: folder.name });
    return path;
  };

  // Actions
  const handleCreateFolder = () => {
    const folderType = currentFolderId === null ? 'carrera' : 'licencia';
    showPrompt(
      folderType === 'carrera' ? '📁 Nueva Carrera' : '📂 Nueva Licencia',
      folderType === 'carrera'
        ? 'Ingrese el nombre de la nueva Carrera (Carpeta de 1° nivel):'
        : 'Ingrese el nombre de la nueva Licencia (Carpeta de 2° nivel):',
      async (promptName) => {
        try {
          const saved = await foldersApi.create({
            name: promptName.trim(),
            type: folderType,
            parentId: currentFolderId || null,
          });
          setFolders(prev => [...prev, { ...saved, parentId: saved.parentId ?? undefined }]);
        } catch (err) {
          console.error('Error creando carpeta:', err);
          alert(err instanceof Error ? err.message : 'Error al crear la carpeta');
        }
      },
      { inputPlaceholder: 'Nombre de la carpeta...' }
    );
  };

  const handleRenameFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    showPrompt(
      '✏️ Renombrar Carpeta',
      `Ingrese el nuevo nombre para la carpeta "${folder.name}":`,
      async (promptName) => {
        if (promptName.trim() !== folder.name) {
          try {
            await foldersApi.update(id, { name: promptName.trim() });
            setFolders(prev => prev.map(f => f.id === id ? { ...f, name: promptName.trim() } : f));
          } catch (err) {
            console.error('Error renombrando carpeta:', err);
          }
        }
      },
      { defaultValue: folder.name, inputPlaceholder: 'Nuevo nombre...' }
    );
  };

  const handleDeleteFolderClick = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      '🗑️ Eliminar Carpeta',
      `¿Estás seguro de que deseas eliminar la carpeta "${name}"? Esto eliminará de forma permanente todas sus subcarpetas y cursos contenidos.`,
      () => {
        onDeleteFolder?.(id);
        if (currentFolderId === id) {
          setCurrentFolderId(null);
        } else {
          const folder = folders.find(f => f.id === id);
          if (folder && folder.type === 'carrera' && currentFolder && currentFolder.parentId === id) {
            setCurrentFolderId(null);
          }
        }
      },
      'danger',
      'Eliminar',
      'Cancelar'
    );
  };

  const handleMoveFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    if (folder.type !== 'licencia') {
      showAlert('Sin acción', 'Las carreras no se pueden mover de nivel ya que son carpetas de primer nivel.');
      return;
    }

    const careers = folders.filter(f => f.type === 'carrera');
    if (careers.length === 0) {
      showAlert('Sin carreras', 'No hay carreras creadas a las cuales mover esta licencia. Primero cree una carrera.');
      return;
    }

    const options = careers.map(c => ({ id: c.id, label: c.name }));
    showSelect(
      '📂 Mover Licencia',
      `Seleccione la Carrera a la que desea mover "${folder.name}":`,
      options,
      async (selected) => {
        try {
          await foldersApi.update(folderId, { parentId: selected.id! });
          setFolders(prev => prev.map(f => f.id === folderId ? { ...f, parentId: selected.id! } : f));
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Error al mover la carpeta');
        }
      }
    );
  };

  const handleMoveCourse = (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const options: { id: string | null; label: string }[] = [
      { id: null, label: '🏠 Inicio (Raíz)' }
    ];

    folders.forEach(f => {
      if (f.type === 'carrera') {
        options.push({ id: f.id, label: `📁 Carrera: ${f.name}` });
        folders.filter(sub => sub.type === 'licencia' && sub.parentId === f.id).forEach(l => {
          options.push({ id: l.id, label: `  ↳ 📂 ${f.name} > ${l.name}` });
        });
      }
    });

    folders.filter(f => f.type === 'licencia' && !f.parentId).forEach(l => {
      options.push({ id: l.id, label: `📂 Licencia (Sin carrera): ${l.name}` });
    });

    showSelect(
      '🚚 Mover Curso',
      'Seleccione el destino al que desea mover el curso:',
      options,
      (selected) => {
        onMoveCourse(courseId, selected.id || '');
      }
    );
  };

  // Filtering visible folders and courses
  const filteredFolders = (
    currentFolderId === null 
      ? folders.filter(f => f.type === 'carrera')
      : currentFolder?.type === 'carrera'
        ? folders.filter(f => f.type === 'licencia' && f.parentId === currentFolderId)
        : []
  ).filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (currentFolderId === null) {
      // Show loose courses at root for backwards compatibility
      return matchesSearch && (!course.folderId || !folders.some(f => f.id === course.folderId));
    } else {
      return matchesSearch && course.folderId === currentFolderId;
    }
  });

  const hasItems = filteredFolders.length > 0 || filteredCourses.length > 0;

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <button 
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="logo-container">
          <div className="logo-icon">
            <BookOpen size={24} />
          </div>
          {!isSidebarCollapsed && <h2>CourseFactory</h2>}
        </div>
        
        <div className="dashboard-sidebar-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {currentFolderId === null ? (
            <>
              <button 
                className="btn btn-primary create-course-btn" 
                onClick={handleCreateFolder}
                title="Crear Carrera"
              >
                <Plus size={20} />
                {!isSidebarCollapsed && <span>Crear Carrera</span>}
              </button>
              <button 
                className="btn btn-outline create-course-btn" 
                onClick={() => onCreateCourse(undefined)}
                title="Crear Curso (IA)"
              >
                <Plus size={20} />
                {!isSidebarCollapsed && <span>Crear Curso (IA)</span>}
              </button>
            </>
          ) : currentFolder?.type === 'carrera' ? (
            <>
              <button 
                className="btn btn-primary create-course-btn" 
                onClick={handleCreateFolder}
                title="Crear Licencia"
              >
                <Plus size={20} />
                {!isSidebarCollapsed && <span>Crear Licencia</span>}
              </button>
              <button 
                className="btn btn-outline create-course-btn" 
                onClick={() => onCreateCourse(currentFolderId)}
                title="Crear Curso (IA)"
              >
                <Plus size={20} />
                {!isSidebarCollapsed && <span>Crear Curso (IA)</span>}
              </button>
            </>
          ) : (
            <button 
              className="btn btn-primary create-course-btn" 
              onClick={() => onCreateCourse(currentFolderId)}
              title="Crear Curso (IA)"
            >
              <Plus size={20} />
              {!isSidebarCollapsed && <span>Crear Curso (IA)</span>}
            </button>
          )}
        </div>
        
        <nav className="dashboard-nav">
          <button 
            className={`dashboard-nav-item ${activeTab === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveTab('courses')}
            title={isSidebarCollapsed ? "Todos los Cursos" : ""}
          >
            <LayoutGrid size={18} />
            {!isSidebarCollapsed && <span>Todos los Cursos</span>}
          </button>
          
          <button 
            className={`dashboard-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
            title={isSidebarCollapsed ? "Estadísticas" : ""}
          >
            <BarChart2 size={18} />
            {!isSidebarCollapsed && <span>Estadísticas</span>}
          </button>



          {(user.role === 'admin') && (
            <button 
              className={`dashboard-nav-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
              title={isSidebarCollapsed ? "Usuarios" : ""}
            >
              <Users size={18} />
              {!isSidebarCollapsed && <span>Usuarios</span>}
            </button>
          )}
        </nav>
        
        <div style={{ flex: 1 }}></div>

        <button 
          className={`dashboard-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
          title={isSidebarCollapsed ? "Tareas y Observaciones" : ""}
          style={{ position: 'relative', margin: '0 1rem', width: 'calc(100% - 2rem)' }}
        >
          <ClipboardList size={18} />
          {!isSidebarCollapsed && <span>Mis Tareas</span>}
          {pendingTasksCount > 0 && (
            <span style={{
              position: 'absolute',
              top: isSidebarCollapsed ? '2px' : '50%',
              right: isSidebarCollapsed ? '2px' : '12px',
              transform: isSidebarCollapsed ? 'none' : 'translateY(-50%)',
              background: '#ef4444',
              color: 'white',
              fontSize: '0.72rem',
              fontWeight: 600,
              borderRadius: '50px',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--bg-secondary)'
            }}>
              {pendingTasksCount}
            </span>
          )}
        </button>

        <div className="sidebar-footer" style={{ borderTop: 'none', padding: 0 }}>
          <div className="user-profile">
            <div className="user-info">
              <UserIcon size={16} className="text-muted" />
              {!isSidebarCollapsed && (
                <div className="user-details">
                  <span className="user-name">{user.name}</span>
                  <span className="user-role">{user.role}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                className="btn btn-icon" 
                onClick={onToggleTheme} 
                title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button 
                className="logout-button" 
                onClick={onLogout} 
                title="Cerrar sesión"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {activeTab === 'courses' && (
          <>
            <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
              <div className="search-container" style={{ maxWidth: '400px', width: '100%' }}>
                <Search size={18} className="search-icon text-muted" />
                <input 
                  type="text" 
                  placeholder="Buscar contenido..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </header>

            <div className="dashboard-scrollable-content">
              <div className="dashboard-content">
                {/* Breadcrumbs */}
                <div className="breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {getBreadcrumbs().map((bc, idx, arr) => (
                    <React.Fragment key={bc.id || 'root'}>
                      <span 
                        style={{ 
                          cursor: bc.id !== currentFolderId ? 'pointer' : 'default', 
                          fontWeight: bc.id === currentFolderId ? '600' : '500',
                          color: bc.id === currentFolderId ? 'var(--primary)' : 'var(--text-muted)',
                          textDecoration: bc.id !== currentFolderId ? 'underline' : 'none'
                        }}
                        onClick={() => bc.id !== currentFolderId && setCurrentFolderId(bc.id)}
                        className="breadcrumb-item"
                      >
                        {bc.name}
                      </span>
                      {idx < arr.length - 1 && <span style={{ color: 'var(--border)' }}>/</span>}
                    </React.Fragment>
                  ))}
                </div>

                <h1 className="dashboard-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {currentFolderId !== null && (
                    <button 
                      className="btn btn-outline btn-icon-circle"
                      onClick={() => {
                        if (currentFolder?.type === 'licencia') {
                          setCurrentFolderId(currentFolder.parentId || null);
                        } else {
                          setCurrentFolderId(null);
                        }
                      }}
                      title="Volver"
                      style={{ width: '36px', height: '36px', padding: 0 }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  {currentFolderId === null ? 'Todos los Cursos' : currentFolder?.name}
                </h1>
                
                {hasItems ? (
                  <div className="course-grid">
                    {/* Render folders first */}
                    {filteredFolders.map(folder => {
                      const isCarrera = folder.type === 'carrera';
                      const licenseCount = getLicenseCount(folder.id);
                      const courseCount = isCarrera ? getCareerCourseCount(folder.id) : getCourseCount(folder.id);
                      
                      return (
                        <div 
                          key={folder.id} 
                          className="course-card folder-card" 
                          onClick={() => setCurrentFolderId(folder.id)}
                        >
                          <div className="course-card-cover folder-card-cover">
                            <div className="course-card-logo">
                               <FolderIcon size={44} className="folder-icon-img" />
                            </div>
                            
                            <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                              {folder.type === 'licencia' && (
                                <button 
                                  className="btn btn-icon" 
                                  style={{ 
                                    background: 'rgba(255, 255, 255, 0.2)', 
                                    backdropFilter: 'blur(4px)',
                                    color: 'white',
                                    border: 'none',
                                    width: '32px',
                                    height: '32px',
                                    padding: 0
                                  }}
                                  onClick={(e) => handleMoveFolder(folder.id, e)}
                                  title="Mover carpeta"
                                >
                                  <FolderSymlink size={14} />
                                </button>
                              )}
                              <button 
                                className="btn btn-icon" 
                                style={{ 
                                  background: 'rgba(255, 255, 255, 0.2)', 
                                  backdropFilter: 'blur(4px)',
                                  color: 'white',
                                  border: 'none',
                                  width: '32px',
                                  height: '32px',
                                  padding: 0
                                }}
                                onClick={(e) => handleRenameFolder(folder.id, e)}
                                title="Renombrar carpeta"
                              >
                                <Edit size={14} />
                              </button>
                              {user.role === 'admin' && (
                                <button 
                                  className="btn btn-icon delete-course-btn" 
                                  style={{ 
                                    background: 'rgba(255, 255, 255, 0.2)', 
                                    backdropFilter: 'blur(4px)',
                                    color: 'white',
                                    border: 'none',
                                    width: '32px',
                                    height: '32px',
                                    padding: 0
                                  }}
                                  onClick={(e) => handleDeleteFolderClick(folder.id, folder.name, e)}
                                  title="Eliminar carpeta"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="course-card-content">
                            <h3 className="course-card-title" style={{ fontSize: '1.05rem', marginBottom: '0.5rem', flex: 'none' }}>{folder.name}</h3>
                            <div className="course-card-meta" style={{ marginBottom: 0 }}>
                              <span className="meta-item">
                                {isCarrera ? (
                                  <>📁 Carrera · {licenseCount} licencias · {courseCount} cursos</>
                                ) : (
                                  <>📂 Licencia · {courseCount} cursos</>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Render courses */}
                    {filteredCourses.map(course => {
                       const lessonsCount = course.rows ? course.rows.length : 0;
                       const gradients = [
                         'linear-gradient(135deg, #0f172a 0%, #334155 100%)', // Slate / Dark blue
                         'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', // Indigo dark
                         'linear-gradient(135deg, #022c22 0%, #064e3b 100%)', // Emerald dark
                         'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)', // Red dark
                         'linear-gradient(135deg, #422006 0%, #78350f 100%)'  // Amber dark
                       ];
                       
                       const hash = course.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                       const gradient = gradients[hash % gradients.length];
                       
                       const dateStr = course.createdAt 
                        ? new Date(course.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }) 
                        : 'Fecha desconocida';

                       return (
                        <div 
                          key={course.id} 
                          className="course-card" 
                          onClick={() => onSelectCourse(course.id)}
                        >
                          <div className="course-card-cover" style={{ background: gradient }}>
                            <div className="course-card-logo">
                               <Layout size={40} color="rgba(255, 255, 255, 0.4)" strokeWidth={1} />
                            </div>
                            <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                              <button 
                                className="btn btn-icon" 
                                style={{ 
                                  background: 'rgba(255, 255, 255, 0.2)', 
                                  backdropFilter: 'blur(4px)',
                                  color: 'white',
                                  border: 'none',
                                  width: '32px',
                                  height: '32px',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onClick={(e) => handleMoveCourse(course.id, e)}
                                title="Mover curso de carpeta"
                              >
                                <FolderSymlink size={14} />
                              </button>
                              {user.role === 'admin' && onDeleteCourse && (
                                <button 
                                  className="btn btn-icon delete-course-btn" 
                                  style={{ 
                                    background: 'rgba(255, 255, 255, 0.2)', 
                                    backdropFilter: 'blur(4px)',
                                    color: 'white',
                                    border: 'none',
                                    width: '32px',
                                    height: '32px',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showConfirm(
                                      '🗑️ Eliminar Curso',
                                      '¿Estás seguro de que deseas eliminar este curso? Esta acción no se puede deshacer.',
                                      () => onDeleteCourse(course.id),
                                      'danger',
                                      'Eliminar',
                                      'Cancelar'
                                    );
                                  }}
                                  title="Eliminar curso"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="course-card-content">
                            <div className="course-card-author">
                              <div className="author-avatar">MM</div>
                              <span className="author-name">Escuela Maradona Menotti</span>
                            </div>
                            <h3 className="course-card-title">{course.name}</h3>
                            <div className="course-card-meta">
                              <span className="meta-item"><FileText size={14}/> Curso · {lessonsCount} clases</span>
                            </div>
                            <div className="course-card-footer">
                              <span className="updated-at">Actualizado el {dateStr}</span>
                            </div>
                          </div>
                        </div>
                       );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '5rem 3rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                    <FolderIcon size={48} style={{ margin: '0 auto 1.5rem', color: 'var(--text-muted)', opacity: 0.6 }} />
                    <p style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>Esta carpeta está vacía</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {currentFolderId === null 
                        ? 'Creá una carrera para empezar a organizar los contenidos.'
                        : currentFolder?.type === 'carrera'
                          ? 'Creá una licencia dentro de esta carrera.'
                          : 'Creá un nuevo curso dentro de esta licencia.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}


        {activeTab === 'analytics' && (
          <div className="dashboard-scrollable-content" style={{ padding: '2rem' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
              <AnalyticsPanel courses={courses} />
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="dashboard-scrollable-content">
            <UserManagement users={users} setUsers={setUsers} />
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="dashboard-scrollable-content" style={{ padding: '2rem' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
              {/* Task Board Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, var(--text-main) 0%, var(--accent) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      Mis Tareas y Observaciones
                    </h2>
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <button 
                        onClick={() => setTaskViewMode('kanban')}
                        style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', background: taskViewMode === 'kanban' ? 'var(--accent)' : 'transparent', color: taskViewMode === 'kanban' ? 'white' : 'var(--text-secondary)' }}
                      >
                        Tablero
                      </button>
                      <button 
                        onClick={() => setTaskViewMode('calendar')}
                        style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', background: taskViewMode === 'calendar' ? 'var(--accent)' : 'transparent', color: taskViewMode === 'calendar' ? 'white' : 'var(--text-secondary)' }}
                      >
                        Calendario
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
                    Administrá y realizá el seguimiento de las tareas y observaciones.
                  </p>
                </div>
                <button 
                  className="btn btn-primary"
                  onClick={() => setIsTaskModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={20} /> Crear Tarea
                </button>
              </div>

              {/* Task Board Filters */}
              <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Asignación</label>
                  <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <button 
                      onClick={() => setTaskAssigneeFilter('MY_TASKS')}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        background: taskAssigneeFilter === 'MY_TASKS' ? 'var(--accent)' : 'transparent',
                        color: taskAssigneeFilter === 'MY_TASKS' ? 'white' : 'var(--text-secondary)'
                      }}
                    >
                      Asignadas a mí
                    </button>
                    <button 
                      onClick={() => setTaskAssigneeFilter('BY_ME')}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        background: taskAssigneeFilter === 'BY_ME' ? 'var(--accent)' : 'transparent',
                        color: taskAssigneeFilter === 'BY_ME' ? 'white' : 'var(--text-secondary)'
                      }}
                    >
                      Creadas por mí
                    </button>
                    <button 
                      onClick={() => setTaskAssigneeFilter('ALL')}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        background: taskAssigneeFilter === 'ALL' ? 'var(--accent)' : 'transparent',
                        color: taskAssigneeFilter === 'ALL' ? 'white' : 'var(--text-secondary)'
                      }}
                    >
                      Todas las tareas
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Estado</label>
                  <select 
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value as any)}
                    className="cell-select"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 1rem', minWidth: '160px', color: 'var(--text-main)', height: '38px' }}
                  >
                    <option value="TODAS">Todos los Estados</option>
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="EN_PROCESO">En Proceso</option>
                    <option value="RESUELTO">Resueltas</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Curso</label>
                  <select 
                    value={taskCourseFilter}
                    onChange={(e) => setTaskCourseFilter(e.target.value)}
                    className="cell-select"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 1rem', minWidth: '220px', color: 'var(--text-main)', height: '38px' }}
                  >
                    <option value="ALL">Todos los Cursos</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Content Body based on ViewMode */}
              {taskViewMode === 'kanban' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', minHeight: '500px' }}>
                    {(['PENDIENTE', 'EN_PROCESO', 'RESUELTO'] as const).map(colStatus => {
                      const filtered = visibleTasks.filter(t => {
                        // Status match
                        if (taskStatusFilter !== 'TODAS' && t.status !== taskStatusFilter) return false;
                        if (t.status !== colStatus) return false;
                        // Assignee match
                        if (taskAssigneeFilter === 'MY_TASKS' && t.assignedTo !== user.id) return false;
                        if (taskAssigneeFilter === 'BY_ME' && t.createdBy !== user.id) return false;
                        // Course match
                        if (taskCourseFilter !== 'ALL' && t.courseId !== taskCourseFilter) return false;
                        return true;
                      });

                  const colTitle = colStatus === 'PENDIENTE' ? 'Pendiente' : colStatus === 'EN_PROCESO' ? 'En Proceso' : 'Resuelta';
                  const colColor = colStatus === 'PENDIENTE' ? '#f59e0b' : colStatus === 'EN_PROCESO' ? '#3b82f6' : '#10b981';

                  return (
                    <div 
                      key={colStatus} 
                      className="glass-panel" 
                      style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', height: '100%', minHeight: '400px' }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={(e) => handleTaskDrop(e, colStatus)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: `2px solid ${colColor}`, paddingBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)' }}>{colTitle}</span>
                        <span style={{ background: 'var(--border)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 }}>{filtered.length}</span>
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            Sin tareas en esta columna.
                          </div>
                        ) : (
                          filtered.map(t => (
                            <div 
                              key={t.id} 
                              className="glass-panel animate-fade-in" 
                              draggable
                              onDragStart={(e) => handleTaskDragStart(e, t.id)}
                              style={{
                                padding: '1rem',
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                background: 'var(--bg-primary)',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                cursor: 'grab'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', wordBreak: 'break-word' }}>
                                  {t.title}
                                </span>
                                {(user.role === 'admin' || t.createdBy === user.id) && (
                                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    {onNavigateToTaskSource && t.courseId && t.panelName && (
                                      <button
                                        onClick={() => onNavigateToTaskSource(t.courseId!, t.panelName)}
                                        style={{ background: 'rgba(139, 92, 246, 0.1)', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, marginRight: '4px' }}
                                        title="Ir al origen de la tarea"
                                      >
                                        Ir al origen
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setTaskToEdit(t);
                                        setIsTaskModalOpen(true);
                                      }}
                                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '2px' }}
                                      title="Editar tarea"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        showConfirm(
                                          '🗑️ Eliminar Tarea',
                                          '¿Estás seguro de eliminar esta tarea? Esta acción no se puede deshacer.',
                                          () => handleDeleteTask(t.id),
                                          'danger',
                                          'Eliminar',
                                          'Cancelar'
                                        );
                                      }}
                                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                      title="Eliminar tarea"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {t.description && (
                                <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                  {t.description}
                                </p>
                              )}

                              {t.courseName && (
                                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>
                                  📚 {t.courseName}
                                </div>
                              )}

                              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <span style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '4px' }}>
                                  📍 {t.panelName}
                                </span>
                                {t.rowNro && (
                                  <span style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '4px' }}>
                                    Clase {t.rowNro}
                                  </span>
                                )}
                              </div>

                              {/* Dates Info */}
                              <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                <span>📅 Creada: {new Date(t.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}</span>
                                {t.dueDate && (() => {
                                  const dueDateObj = new Date(t.dueDate + 'T00:00:00');
                                  const today = new Date();
                                  today.setHours(0,0,0,0);
                                  const isOverdue = dueDateObj < today && t.status !== 'RESUELTO';
                                  const dueDateStr = dueDateObj.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
                                  return (
                                    <span style={{ 
                                      color: isOverdue ? '#ef4444' : 'var(--text-secondary)',
                                      fontWeight: isOverdue ? 700 : 500,
                                      background: isOverdue ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                      padding: isOverdue ? '1px 5px' : '0',
                                      borderRadius: '4px'
                                    }}>
                                      🏁 Plazo: {dueDateStr} {isOverdue ? ' (VENCIDO)' : ''}
                                    </span>
                                  );
                                })()}
                              </div>

                              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px', fontSize: '0.72rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>👤 {t.assignedToName}</span>
                                <button 
                                  className="btn btn-sm"
                                  onClick={() => handleToggleTaskStatus(t.id)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.72rem',
                                    background: colStatus === 'PENDIENTE' ? '#3b82f6' : colStatus === 'EN_PROCESO' ? '#10b981' : 'var(--border)',
                                    color: colStatus === 'RESUELTO' ? 'var(--text-main)' : 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {colStatus === 'PENDIENTE' ? 'Proceso' : colStatus === 'EN_PROCESO' ? 'Resolver' : 'Reabrir'}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            ) : (
              <div className="glass-panel" style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '16px', minHeight: '600px', border: '1px solid var(--border)' }}>
                <style dangerouslySetInnerHTML={{__html: `
                  .fc {
                    --fc-page-bg-color: var(--bg-primary);
                    --fc-neutral-bg-color: var(--bg-secondary);
                    --fc-border-color: var(--border);
                  }
                  .fc-theme-standard td, .fc-theme-standard th, .fc-theme-standard .fc-scrollgrid { border-color: var(--border); }
                  .fc-theme-standard th { background-color: var(--bg-secondary); color: var(--text-main); }
                  .fc-theme-standard td, .fc-day-other, .fc-multimonth-day-other { background-color: var(--bg-primary) !important; }
                  .fc .fc-toolbar-title { color: var(--text-main); font-size: 1.25rem; font-weight: 700; }
                  .fc .fc-button-primary { background-color: var(--bg-secondary); border-color: var(--border); color: var(--text-main); }
                  .fc .fc-button-primary:hover { background-color: var(--accent); border-color: var(--accent); color: white; }
                  .fc .fc-button-primary:disabled { background-color: var(--bg-secondary); opacity: 0.5; }
                  .fc .fc-button-active { background-color: var(--accent) !important; border-color: var(--accent) !important; }
                  .fc .fc-col-header-cell-cushion, .fc .fc-daygrid-day-number, .fc .fc-multimonth-title { color: var(--text-main) !important; text-decoration: none; }
                  .fc-day-today { background: rgba(139, 92, 246, 0.08) !important; }
                  .fc-event { border: none; padding: 2px 6px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.78rem; }
                  /* Hover on day cells */
                  .fc .fc-daygrid-day:hover, .fc .fc-timegrid-slot:hover {
                    background-color: rgba(139, 92, 246, 0.12) !important;
                    cursor: pointer;
                    transition: background-color 0.15s ease;
                  }
                  .fc .fc-daygrid-day {
                    transition: background-color 0.15s ease;
                    position: relative;
                  }
                  .fc .fc-daygrid-day:hover .fc-daygrid-day-number::after {
                    content: ' +';
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--accent);
                    opacity: 0.8;
                  }
                `}} />
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay'
                  }}
                  locale="es"
                  buttonText={{
                    today: 'Hoy',
                    year: 'Año',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día'
                  }}
                  events={(() => {
                    // Build a deterministic color palette per user
                    const USER_PALETTE = [
                      '#6366f1', // indigo
                      '#f59e0b', // amber
                      '#10b981', // emerald
                      '#ef4444', // red
                      '#8b5cf6', // violet
                      '#06b6d4', // cyan
                      '#f97316', // orange
                      '#ec4899', // pink
                      '#84cc16', // lime
                      '#14b8a6', // teal
                    ];
                    const userColorMap: Record<string, string> = {};
                    users.forEach((u, idx) => {
                      userColorMap[u.id] = USER_PALETTE[idx % USER_PALETTE.length];
                    });

                    return visibleTasks.flatMap(t => {
                    
                      const color = userColorMap[t.assignedTo] || '#6366f1';

                      const evs: any[] = [
                        {
                          id: t.id + '-start',
                          title: 'Inicio: ' + t.title,
                          start: t.createdAt,
                          backgroundColor: color,
                          allDay: true,
                          extendedProps: { task: t }
                        }
                      ];

                      if (t.dueDate) {
                        evs.push({
                          id: t.id + '-end',
                          title: 'Vence: ' + t.title,
                          start: t.dueDate,
                          backgroundColor: color,
                          allDay: true,
                          extendedProps: { task: t }
                        });
                      }

                      return evs;
                    });
                  })()}
                  eventClick={(info) => {
                    const task = info.event.extendedProps.task;
                    setTaskToEdit(task);
                    setIsTaskModalOpen(true);
                  }}
                  dateClick={(info) => {
                    setCalendarClickedDate(info.dateStr);
                    setIsTaskModalOpen(true);
                  }}
                  height="auto"
                />
              </div>
            )}
            </div>
          </div>
        )}
      </main>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setTaskToEdit(undefined); setCalendarClickedDate(undefined); }}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        users={users}
        courses={courses}
        currentUser={user}
        taskToEdit={taskToEdit}
        prefilledDueDate={calendarClickedDate}
      />
      {DialogRenderer}
    </div>
  );
};

export default CourseDashboard;
