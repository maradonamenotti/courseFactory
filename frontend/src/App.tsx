import { useState, useEffect, useCallback, useRef } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { authApi, usersApi, foldersApi, coursesApi, rowsApi, tasksApi, libraryApi } from './services/api';
import type { ApiRow, ApiTask, ApiLibraryItem } from './services/api';
import PanelHeader from './components/PanelHeader';
import ContentTable from './components/ContentTable';
import MultimediaTable from './components/MultimediaTable';
import ApprovalTable from './components/ApprovalTable';
import DesignPanel from './components/DesignPanel';
import SystemsPanel from './components/SystemsPanel';
import AnalyticsPanel from './components/AnalyticsPanel';
import Login from './components/Login';
import LibraryPanel from './components/LibraryPanel';
import { BookOpen, MonitorPlay, Settings, FileText, CheckCircle, LogOut, User as UserIcon, Palette, BarChart2, Info, ChevronLeft, ChevronRight, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, ClipboardList, Plus, Trash2, Pencil, Inbox } from 'lucide-react';
import { type CourseRow, type User, type CourseTemplate, type Course, type Folder, defaultRow, defaultDesign, initialBlockCodes, mapFormatoToBlockType, DEFAULT_PASSWORD, type Task, type LibraryItem } from './types';
import HelpModal from './components/HelpModal';
import CourseDashboard from './components/CourseDashboard';
import TaskModal from './components/TaskModal';
import { useDialog } from './components/CustomDialog';

function App() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState('panel1');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // Password change modal state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useLocalStorage<string>('cf_active_course_id', '');
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('cf_theme', 'light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage<boolean>('cf_sidebar_collapsed', false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const { showConfirm, DialogRenderer } = useDialog();
  const [prefilledTaskData, setPrefilledTaskData] = useState<{
    courseId?: string;
    rowId?: string;
    rowNro?: string;
    rowModulo?: string;
    panelName?: string;
  }>({});

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await foldersApi.delete(folderId);
      const [apiFolders, apiCourses] = await Promise.all([foldersApi.getAll(), coursesApi.getAll()]);
      setFolders(apiFolders.map(f => ({ ...f, parentId: f.parentId ?? undefined })));
      const mapped = apiCourses.map(c => ({ ...c, rows: [], folderId: c.folderId ?? undefined }));
      setCourses(mapped);
      if (!mapped.find(c => c.id === activeCourseId)) {
        setActiveCourseId(mapped[0]?.id || '');
      }
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  };

  const updateRowTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const mapApiRow = (r: ApiRow, i: number): CourseRow => ({
    nro: (i + 1).toString(),
    id: r.id,
    materia: r.materia,
    modulo: r.modulo,
    descripcion: r.descripcion,
    formato: r.formato,
    links: r.links,
    fileName: r.fileName ?? undefined,
    fileType: r.fileType ?? undefined,
    estado: r.estado,
    videoDrive: r.videoDrive,
    videoVimeo: r.videoVimeo,
    videoSubtitulos: r.videoSubtitulos,
    geniallyUrl: r.geniallyUrl,
    geniallyLinkStatus: r.geniallyLinkStatus,
    geniallyTextoStatus: r.geniallyTextoStatus,
    geniallyDisenoStatus: r.geniallyDisenoStatus,
    estadoMultimedia: r.estadoMultimedia,
    aprobacionContenido: r.aprobacionContenido,
    aprobacionMultimedia: r.aprobacionMultimedia,
    comentariosRevisor: r.comentariosRevisor,
    estadoFinal: r.estadoFinal,
  });

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

  const mapApiLibraryItem = (item: ApiLibraryItem): LibraryItem => ({
    id: item.id,
    descripcion: item.descripcion,
    formato: item.formato,
    links: item.links,
    fileName: item.fileName ?? undefined,
    fileType: item.fileType ?? undefined,
    createdAt: item.createdAt,
  });

  const loadTasks = async () => {
    try {
      const apiTasks = await tasksApi.getAll();
      setTasks(apiTasks.map(mapApiTask));
    } catch (err) { console.error('Error loading tasks:', err); }
  };

  const loadLibraryItems = async () => {
    try {
      const items = await libraryApi.getAll();
      setLibraryItems(items.map(mapApiLibraryItem));
    } catch (err) { console.error('Error loading library:', err); }
  };

  const loadAppData = async (firstCourseId?: string) => {
    try {
      const [apiFolders, apiCourses] = await Promise.all([
        foldersApi.getAll(),
        coursesApi.getAll(),
      ]);
      const mappedFolders: Folder[] = apiFolders.map(f => ({
        ...f,
        parentId: f.parentId ?? undefined,
      }));
      const mappedCourses: Course[] = apiCourses.map(c => ({
        ...c,
        rows: [],
        folderId: c.folderId ?? undefined,
      }));
      setFolders(mappedFolders);
      setCourses(mappedCourses);

      const targetId = firstCourseId || mappedCourses[0]?.id;
      if (targetId) {
        setActiveCourseId(targetId);
      }
    } catch (err) {
      console.error('Error loading app data:', err);
    }
  };

  const loadCourseRows = async (courseId: string) => {
    try {
      const apiRows = await rowsApi.getAll(courseId);
      const mapped = apiRows.map(mapApiRow);
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, rows: mapped } : c));
    } catch (err) {
      console.error('Error loading rows:', err);
    }
  };

  useEffect(() => {
    if (user && activeCourseId) {
      loadCourseRows(activeCourseId);
    }
  }, [activeCourseId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const activeCourse = courses.find(c => c.id === activeCourseId) ?? courses[0];
  const rows = activeCourse?.rows ?? [];



  const [templates, setTemplates] = useLocalStorage<CourseTemplate[]>('cf_templates', [
    {
      id: 'default',
      name: 'Plantilla Base',
      design: defaultDesign,
      blocks: [
        { id: 'b1', type: 'pdf', customCode: initialBlockCodes.pdf },
        { id: 'b2', type: 'video', customCode: initialBlockCodes.video },
        { id: 'b3', type: 'text', customCode: initialBlockCodes.text }
      ],
      customBlockCodes: { ...initialBlockCodes }
    }
  ]);

  // Synchronize template blocks with the active course rows automatically
  useEffect(() => {
    if (!activeCourse || !activeCourse.rows) return;

    setTemplates((prevTemplates) => {
      let updated = false;
      const nextTemplates = prevTemplates.map((template) => {
        const currentCustomCodes = template.customBlockCodes || { ...initialBlockCodes };
        
        // Reconstruct template.blocks to mirror activeCourse.rows exactly
        const syncedBlocks = activeCourse.rows.map((row) => {
          const expectedType = mapFormatoToBlockType(row.formato);
          const existingBlock = template.blocks.find((b) => b.id === row.id);
          
          if (existingBlock) {
            if (existingBlock.type === expectedType) {
              return {
                ...existingBlock,
                customCode: existingBlock.customCode ?? currentCustomCodes[expectedType]
              };
            }
            // If type changed, reset the block code to the template's custom base code for the new type
            return {
              id: row.id,
              type: expectedType,
              customCode: currentCustomCodes[expectedType]
            };
          }
          
          // New block
          return {
            id: row.id,
            type: expectedType,
            customCode: currentCustomCodes[expectedType]
          };
        });

        // Check if blocks list changed (either order, length, types, or missing ids)
        const blocksChanged = JSON.stringify(template.blocks) !== JSON.stringify(syncedBlocks);
        if (blocksChanged) {
          updated = true;
          return {
            ...template,
            blocks: syncedBlocks
          };
        }
        return template;
      });

      return updated ? nextTemplates : prevTemplates;
    });
  }, [courses, activeCourseId, setTemplates]);

  const handleCreateCourse = async (folderId?: string) => {
    try {
      const saved = await coursesApi.create({ name: `Nuevo Curso ${courses.length + 1}`, folderId: folderId || null });
      const newCourse: Course = { ...saved, rows: [], folderId: saved.folderId ?? undefined };
      setCourses(prev => [...prev, newCourse]);
      setActiveCourseId(saved.id);
      setView('editor');
    } catch (err) {
      console.error('Error creando curso:', err);
      alert(err instanceof Error ? err.message : 'Error al crear el curso');
    }
  };

  const handleDeleteCourse = async (id: string) => {
    try {
      await coursesApi.delete(id);
      setCourses(prev => {
        const remaining = prev.filter(c => c.id !== id);
        if (activeCourseId === id) {
          setActiveCourseId(remaining[0]?.id || '');
          if (remaining.length === 0) setView('dashboard');
        }
        return remaining;
      });
    } catch (err) { console.error(err); }
  };

  const handleUpdateCourseName = async (id: string, name: string) => {
    try {
      await coursesApi.update(id, { name });
      setCourses(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    } catch (err) { console.error(err); }
  };

  const handleMoveCourse = async (courseId: string, folderId: string | undefined) => {
    try {
      await coursesApi.update(courseId, { folderId: folderId || null });
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, folderId } : c));
    } catch (err) { console.error(err); }
  };

  const addRow = async (materia?: string, modulo?: string) => {
    const materias = Array.from(new Set(rows.map(r => r.materia || 'Sin materia')));
    const rowData = {
      ...defaultRow,
      materia: materia || `Materia ${materias.length + 1}`,
      modulo: modulo || 'Módulo 1',
    };
    try {
      await rowsApi.create(activeCourseId, rowData);
      await loadCourseRows(activeCourseId);
    } catch (err) { console.error(err); }
  };

  const updateMateria = async (oldName: string, newName: string) => {
    setCourses(prev => prev.map(c =>
      c.id === activeCourseId
        ? { ...c, rows: c.rows.map(r => r.materia === oldName ? { ...r, materia: newName } : r) }
        : c
    ));
    try {
      await rowsApi.renameMateria(activeCourseId, oldName, newName);
    } catch (err) { console.error(err); }
  };

  const updateModule = async (oldName: string, newName: string) => {
    setCourses(prev => prev.map(c =>
      c.id === activeCourseId
        ? { ...c, rows: c.rows.map(r => r.modulo === oldName ? { ...r, modulo: newName } : r) }
        : c
    ));
    try {
      await rowsApi.renameModulo(activeCourseId, oldName, newName);
    } catch (err) { console.error(err); }
  };

  const updateRow = (id: string, field: keyof CourseRow, value: string) => {
    // Optimistic local update
    let apiPayload: Partial<ApiRow> = { [field]: value };

    setCourses(prevCourses => prevCourses.map(c =>
      c.id === activeCourseId
        ? { ...c, rows: c.rows.map(row => {
            if (row.id !== id) return row;
            const updated = { ...row, [field]: value };
            if (field === 'links') {
              if (row.formato === 'VIDEO') { updated.videoDrive = value; apiPayload.videoDrive = value; }
              else if (row.formato === 'GENIALLY') { updated.geniallyUrl = value; apiPayload.geniallyUrl = value; }
            } else if (field === 'videoDrive' && row.formato === 'VIDEO') {
              updated.links = value; apiPayload.links = value;
            } else if (field === 'geniallyUrl' && row.formato === 'GENIALLY') {
              updated.links = value; apiPayload.links = value;
            } else if (field === 'formato') {
              if (value === 'VIDEO') { updated.videoDrive = row.links || row.videoDrive; }
              else if (value === 'GENIALLY') { updated.geniallyUrl = row.links || row.geniallyUrl; }
            }
            return updated;
          }) }
        : c
    ));

    // Debounced API call
    const key = `${id}-${field}`;
    clearTimeout(updateRowTimers.current[key]);
    updateRowTimers.current[key] = setTimeout(() => {
      rowsApi.update(activeCourseId, id, apiPayload).catch(console.error);
    }, 600);
  };

  const moveRow = (draggedId: string, targetId: string | null, targetModule?: string) => {
    let newOrderIds: string[] = [];
    let movedRowUpdates: Partial<ApiRow> = {};

    setCourses(courses.map(c => {
      if (c.id !== activeCourseId) return c;
      const newRows = [...c.rows];
      const draggedIndex = newRows.findIndex(r => r.id === draggedId);
      if (draggedIndex === -1) return c;
      const [draggedRow] = newRows.splice(draggedIndex, 1);

      if (targetId) {
        const targetIndex = newRows.findIndex(r => r.id === targetId);
        if (targetIndex !== -1) {
          draggedRow.modulo = newRows[targetIndex].modulo;
          movedRowUpdates = { modulo: draggedRow.modulo };
          newRows.splice(targetIndex, 0, draggedRow);
        } else {
          newRows.push(draggedRow);
        }
      } else if (targetModule) {
        draggedRow.modulo = targetModule;
        movedRowUpdates = { modulo: targetModule };
        let lastIndex = -1;
        for (let i = newRows.length - 1; i >= 0; i--) {
          if (newRows[i].modulo === targetModule) { lastIndex = i; break; }
        }
        newRows.splice(lastIndex !== -1 ? lastIndex + 1 : newRows.length, 0, draggedRow);
      } else {
        newRows.push(draggedRow);
      }

      newOrderIds = newRows.map(r => r.id);
      return { ...c, rows: newRows };
    }));

    if (newOrderIds.length > 0) {
      const calls: Promise<unknown>[] = [rowsApi.reorder(activeCourseId, newOrderIds)];
      if (Object.keys(movedRowUpdates).length > 0) {
        calls.push(rowsApi.update(activeCourseId, draggedId, movedRowUpdates));
      }
      Promise.all(calls).catch(console.error);
    }
  };

  const removeRow = async (id: string) => {
    setCourses(prev => prev.map(c =>
      c.id === activeCourseId ? { ...c, rows: c.rows.filter(r => r.id !== id) } : c
    ));
    try {
      await rowsApi.delete(activeCourseId, id);
    } catch (err) { console.error(err); }
  };

  const handleAddLibraryItem = async (descripcion: string, formato: string, links: string, fileName?: string, fileType?: string) => {
    try {
      const saved = await libraryApi.create({ descripcion, formato, links, fileName, fileType });
      setLibraryItems(prev => [mapApiLibraryItem(saved), ...prev]);
    } catch (err) { console.error(err); }
  };

  const handleDeleteLibraryItem = (id: string) => {
    showConfirm(
      '🗑️ Eliminar Recurso',
      '¿Estás seguro de eliminar este recurso de la biblioteca? Esta acción no se puede deshacer.',
      async () => {
        try {
          await libraryApi.delete(id);
          setLibraryItems(prev => prev.filter(item => item.id !== id));
        } catch (err) { console.error(err); }
      },
      'danger',
      'Eliminar',
      'Cancelar'
    );
  };

  const handleAssignLibraryItem = async (itemId: string, courseId: string, materia: string, modulo: string) => {
    try {
      await libraryApi.assign(itemId, { courseId, materia, modulo });
      await Promise.all([loadCourseRows(courseId), loadLibraryItems(), loadTasks()]);
    } catch (err) { console.error(err); }
  };

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
      const saved = await tasksApi.create({ ...taskData, createdByName: user?.name });
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

  const openRowTaskModal = (rowId: string, modulo: string, nro: string) => {
    setPrefilledTaskData({
      courseId: activeCourseId,
      rowId,
      rowNro: nro,
      rowModulo: modulo,
      panelName: activeTab === 'panel1' ? 'Contenido' : activeTab === 'panel2' ? 'Multimedia' : 'Verificación'
    });
    setIsTaskModalOpen(true);
  };

  const openLibraryTaskModal = (itemId: string) => {
    setPrefilledTaskData({
      courseId: undefined,
      rowId: itemId,
      rowNro: undefined,
      rowModulo: undefined,
      panelName: 'Biblioteca'
    });
    setIsTaskModalOpen(true);
  };

  const handleLogin = (u: User) => {
    if (u.mustChangePassword) {
      setPendingUser(u);
      setNewPassword('');
      setConfirmPassword('');
      setPwError(null);
      setShowChangePassword(true);
      return;
    }
    setUser(u);
    usersApi.getAll().then(setUsers).catch(console.error);
    loadAppData().catch(console.error);
    loadTasks().catch(console.error);
    loadLibraryItems().catch(console.error);
    if (u.isAdmin) {
      setActiveTab('panel1');
    } else if (u.allowedPanels && u.allowedPanels.length > 0) {
      setActiveTab(`panel${Math.min(...u.allowedPanels)}`);
    } else {
      setActiveTab('panel1');
    }
  };

  const handleChangePassword = useCallback(async () => {
    if (!pendingUser) return;
    if (newPassword.length < 6) {
      setPwError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword === DEFAULT_PASSWORD) {
      setPwError('Debes elegir una contraseña diferente a la por defecto.');
      return;
    }
    try {
      await authApi.changePassword(newPassword);
      const updatedUser = { ...pendingUser, mustChangePassword: false };
      setUser(updatedUser);
      usersApi.getAll().then(setUsers).catch(console.error);
      loadAppData().catch(console.error);
      loadTasks().catch(console.error);
      loadLibraryItems().catch(console.error);
      setShowChangePassword(false);
      setPendingUser(null);
      setNewPassword('');
      setConfirmPassword('');
      if (updatedUser.isAdmin) {
        setActiveTab('panel1');
      } else if (updatedUser.allowedPanels && updatedUser.allowedPanels.length > 0) {
        setActiveTab(`panel${Math.min(...updatedUser.allowedPanels)}`);
      }
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    }
  }, [pendingUser, newPassword, confirmPassword]);

  const handleLogout = () => {
    authApi.logout();
    setUser(null);
    setUsers([]);
    setCourses([]);
    setFolders([]);
    setTasks([]);
    setLibraryItems([]);
  };

  if (!user) {
    return (
      <>
        <Login onLogin={handleLogin} />
        {/* Force Change Password Modal */}
        {showChangePassword && pendingUser && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <div style={{
              background: 'var(--bg-secondary)', width: '100%', maxWidth: '440px',
              borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border)'
            }}>
              {/* Header */}
              <div style={{
                padding: '1.5rem', background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white'
              }}>
                <ShieldCheck size={24} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'white' }}>Cambio de Contraseña Obligatorio</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.9 }}>Hola {pendingUser.name}, debes actualizar tu clave.</p>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pwError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(220, 38, 38, 0.1)', color: '#ef4444',
                    padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem',
                    border: '1px solid rgba(220, 38, 38, 0.2)'
                  }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{pwError}</span>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    Nueva Contraseña
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPwError(null); }}
                      placeholder="Mínimo 6 caracteres"
                      className="input-field"
                      style={{ paddingLeft: '38px', background: 'var(--bg-primary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex'
                    }}>
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    Confirmar Contraseña
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPwError(null); }}
                      placeholder="Repetí la contraseña"
                      className="input-field"
                      style={{ paddingLeft: '38px', background: 'var(--bg-primary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }}
                    />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex'
                    }}>
                      {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '1rem 1.5rem', background: 'var(--bg-primary)',
                borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end'
              }}>
                <button
                  className="btn btn-primary"
                  onClick={handleChangePassword}
                  style={{ minWidth: '180px' }}
                >
                  Guardar Nueva Contraseña
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const canAccess = (panel: string) => {
    if (user.isAdmin) return true;
    if (panel === 'panel0') {
      return user.role === 'admin' || user.role === 'multimedia' || user.role === 'autor' || (user.allowedPanels && user.allowedPanels.includes(0));
    }
    const panelNumber = parseInt(panel.replace('panel', ''), 10);
    return user.allowedPanels && user.allowedPanels.includes(panelNumber);
  };

  if (view === 'dashboard') {
    return (
      <CourseDashboard 
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        courses={courses}
        folders={folders}
        setFolders={setFolders}
        user={user}
        onSelectCourse={(id) => {
          setActiveCourseId(id);
          setView('editor');
        }}
        onCreateCourse={handleCreateCourse}
        onDeleteCourse={handleDeleteCourse}
        onDeleteFolder={handleDeleteFolder}
        onMoveCourse={handleMoveCourse}
        onLogout={handleLogout}
        users={users}
        setUsers={setUsers}
        tasks={tasks}
        setTasks={setTasks}
        onNavigateToTaskSource={(courseId, panelName) => {
          setActiveCourseId(courseId);
          setView('editor');
          const panelMap: Record<string, string> = {
            'Biblioteca': 'panel0',
            'Contenido': 'panel1',
            'Multimedia': 'panel2',
            'Verificación': 'panel3',
            'Maquetado': 'panel4',
            'Sistemas': 'panel5',
            'Analítica': 'panel6'
          };
          if (panelMap[panelName]) {
            setActiveTab(panelMap[panelName]);
          }
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <button 
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div 
          className="logo-container" 
          onClick={() => setView('dashboard')} 
          style={{ cursor: 'pointer', transition: 'opacity 0.2s' }} 
          title="Volver al inicio"
        >
          <div className="logo-icon">
            <BookOpen size={24} />
          </div>
          {!isSidebarCollapsed && <h2>CourseFactory</h2>}
        </div>

        <nav className="nav-menu">
          {canAccess('panel0') && (
            <button 
              className={`nav-item ${activeTab === 'panel0' ? 'active' : ''}`}
              onClick={() => setActiveTab('panel0')}
              title={isSidebarCollapsed ? "Biblioteca" : ""}
            >
              <Inbox size={20} />
              {!isSidebarCollapsed && <span>Biblioteca</span>}
            </button>
          )}

          {canAccess('panel1') && (
            <button 
              className={`nav-item ${activeTab === 'panel1' ? 'active' : ''}`}
              onClick={() => setActiveTab('panel1')}
              title={isSidebarCollapsed ? "Panel 1: Contenido" : ""}
            >
              <FileText size={20} />
              {!isSidebarCollapsed && <span>Panel 1: Contenido</span>}
            </button>
          )}
          
          {canAccess('panel2') && (
            <button 
              className={`nav-item ${activeTab === 'panel2' ? 'active' : ''}`}
              onClick={() => setActiveTab('panel2')}
              title={isSidebarCollapsed ? "Panel 2: Multimedia" : ""}
            >
              <MonitorPlay size={20} />
              {!isSidebarCollapsed && <span>Panel 2: Multimedia</span>}
            </button>
          )}
          
          {canAccess('panel3') && (
            <button 
              className={`nav-item ${activeTab === 'panel3' ? 'active' : ''}`}
              onClick={() => setActiveTab('panel3')}
              title={isSidebarCollapsed ? "Panel 3: Verificación" : ""}
            >
              <CheckCircle size={20} />
              {!isSidebarCollapsed && <span>Panel 3: Verificación</span>}
            </button>
          )}

          {canAccess('panel4') && (
            <button 
              className={`nav-item ${activeTab === 'panel4' ? 'active' : ''}`}
              onClick={() => setActiveTab('panel4')}
              title={isSidebarCollapsed ? "Panel 4: Maquetado" : ""}
            >
              <Palette size={20} />
              {!isSidebarCollapsed && <span>Panel 4: Maquetado</span>}
            </button>
          )}

          {canAccess('panel5') && (
            <button 
              className={`nav-item ${activeTab === 'panel5' ? 'active' : ''}`}
              onClick={() => setActiveTab('panel5')}
              title={isSidebarCollapsed ? "Panel 5: Sistemas" : ""}
            >
              <Settings size={20} />
              {!isSidebarCollapsed && <span>Panel 5: Sistemas</span>}
            </button>
          )}

          {canAccess('panel6') && (
            <button 
              className={`nav-item ${activeTab === 'panel6' ? 'active' : ''}`}
              onClick={() => setActiveTab('panel6')}
              title={isSidebarCollapsed ? "Panel 6: Analítica" : ""}
            >
              <BarChart2 size={20} />
              {!isSidebarCollapsed && <span>Panel 6: Analítica</span>}
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
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
            <button className="logout-button" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-header glass-panel" style={{ zIndex: 10 }}>
          <PanelHeader 
            theme={theme}
            onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            courses={courses}
            folders={folders}
            activeCourseId={activeCourseId}
            user={user}
            onSelectCourse={setActiveCourseId}
            onCreateCourse={(folderId?: string) => {
              const targetFolderId = folderId || activeCourse?.folderId;
              handleCreateCourse(targetFolderId);
            }}
            onUpdateCourseName={handleUpdateCourseName}
            onDeleteCourse={handleDeleteCourse}
          />
        </header>

        <div className="content-area animate-fade-in" style={{ marginRight: isTaskDrawerOpen ? '380px' : '0', transition: 'margin-right 0.3s ease-out' }}>
          {activeTab === 'panel0' && (
            <div className="panel-container">
              <div className="panel-header">
                <h3>Biblioteca de Recursos Temporales</h3>
                <p className="text-muted">Carga de recursos multimedia sin destino inicial para posterior asignación a cursos.</p>
              </div>
              <LibraryPanel 
                courses={courses} 
                libraryItems={libraryItems} 
                onAddLibraryItem={handleAddLibraryItem} 
                onDeleteLibraryItem={handleDeleteLibraryItem} 
                onAssignLibraryItem={handleAssignLibraryItem} 
                onAddLibraryItemTask={openLibraryTaskModal}
              />
            </div>
          )}
          {activeTab === 'panel1' && (
            <div className="panel-container">
              <div className="panel-header">
                <h3>Carga de Unidades y Temas</h3>
                <p className="text-muted">Gestión de contenido, redacción de guiones y estructuración de clases.</p>
              </div>
              <ContentTable rows={rows} addRow={addRow} updateRow={updateRow} removeRow={removeRow} updateModule={updateModule} updateMateria={updateMateria} moveRow={moveRow} onAddRowTask={openRowTaskModal} />
            </div>
          )}
          {activeTab === 'panel2' && (
            <div className="panel-container animate-fade-in">
              <div className="panel-header">
                <h3>Departamento de Edición (Multimedia)</h3>
                <p className="text-muted">Asignación de links, control de videos y estado de recursos interactivos.</p>
              </div>
              <MultimediaTable rows={rows} updateRow={updateRow} onAddRowTask={openRowTaskModal} />
            </div>
          )}
          {activeTab === 'panel3' && (
            <div className="panel-container animate-fade-in">
              <div className="panel-header">
                <h3>Verificación y Aprobación de Calidad</h3>
                <p className="text-muted">Revisión final de los contenidos y multimedia antes de exportar a Moodle.</p>
              </div>
              <ApprovalTable rows={rows} updateRow={updateRow} onAddRowTask={openRowTaskModal} />
            </div>
          )}
          {activeTab === 'panel4' && (
            <div className="panel-container animate-fade-in" style={{ padding: '0' }}>
              <DesignPanel templates={templates} setTemplates={setTemplates} rows={rows} />
            </div>
          )}
          {activeTab === 'panel5' && (
            <div className="panel-container animate-fade-in" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <SystemsPanel rows={rows} templates={templates} />
            </div>
          )}
          {activeTab === 'panel6' && (
            <div className="panel-container animate-fade-in" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <AnalyticsPanel courses={courses} />
            </div>
          )}
        </div>
      </main>

      {/* Task Drawer */}
      {isTaskDrawerOpen && (
        <aside style={{
          position: 'fixed',
          top: '70px',
          right: 0,
          width: '380px',
          height: 'calc(100vh - 70px)',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          boxSizing: 'border-box'
        }}>
          {/* Drawer Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>Tareas y Observaciones</h4>
            <button 
              className="btn btn-sm btn-primary"
              onClick={() => {
                setPrefilledTaskData({
                  courseId: activeTab === 'panel0' ? undefined : activeCourseId,
                  panelName: activeTab === 'panel0' ? 'Biblioteca' : activeTab === 'panel1' ? 'Contenido' : activeTab === 'panel2' ? 'Multimedia' : activeTab === 'panel3' ? 'Verificación' : activeTab === 'panel4' ? 'Maquetado' : activeTab === 'panel5' ? 'Sistemas' : 'Analítica'
                });
                setIsTaskModalOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              <Plus size={14} /> Nueva
            </button>
          </div>

          {/* Drawer Tasks List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
            {(() => {
              const activeTasks = activeTab === 'panel0'
                ? tasks.filter(t => t.panelName === 'Biblioteca')
                : tasks.filter(t => t.courseId === activeCourseId);

              if (activeTasks.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {activeTab === 'panel0' 
                      ? 'No hay observaciones ni tareas creadas en la biblioteca.'
                      : 'No hay observaciones ni tareas creadas en este curso.'}
                  </div>
                );
              }

              return activeTasks.map(t => (
                <div key={t.id} className="glass-panel" style={{
                  padding: '0.8rem',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  background: t.status === 'RESUELTO' ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-primary)',
                  boxShadow: 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                      <input 
                        type="checkbox" 
                        checked={t.status === 'RESUELTO'} 
                        onChange={() => handleToggleTaskStatus(t.id)} 
                        style={{ cursor: 'pointer', marginTop: '3px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ 
                          fontWeight: 600, 
                          fontSize: '0.88rem',
                          textDecoration: t.status === 'RESUELTO' ? 'line-through' : 'none',
                          color: t.status === 'RESUELTO' ? 'var(--text-muted)' : 'var(--text-main)',
                          wordBreak: 'break-word'
                        }}>
                          {t.title}
                        </span>
                        {t.description && (
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                            {t.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {(user?.isAdmin || t.createdBy === user?.id) && (
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button 
                          onClick={() => {
                            setTaskToEdit(t);
                            setPrefilledTaskData({});
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
                  
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                    <span style={{ background: 'rgba(139, 92, 246, 0.08)', color: 'var(--accent)', padding: '1px 5px', borderRadius: '4px', fontWeight: 500 }}>
                      {t.panelName}
                    </span>
                    {t.rowNro && (
                      <span style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '4px' }}>
                        Clase {t.rowNro}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>👤 {t.assignedToName}</span>
                  </div>

                  {/* Dates Info */}
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span>📅 Creada: {new Date(t.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}</span>
                    {t.dueDate && (() => {
                      const dueDateObj = new Date(t.dueDate + 'T00:00:00');
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const isOverdue = dueDateObj < today && t.status !== 'RESUELTO';
                      const dueDateStr = dueDateObj.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                      return (
                        <span style={{ 
                          color: isOverdue ? '#ef4444' : 'var(--text-secondary)',
                          fontWeight: isOverdue ? 700 : 500,
                          background: isOverdue ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                          padding: isOverdue ? '1px 4px' : '0',
                          borderRadius: '3px'
                        }}>
                          🏁 Plazo: {dueDateStr} {isOverdue ? ' (VENCIDO)' : ''}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              ));
            })()}
          </div>
        </aside>
      )}

      {/* Floating Buttons */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', gap: '12px', zIndex: 100 }}>
        {/* Floating Tasks Button */}
        {view === 'editor' && (
          <button
            className="btn"
            onClick={() => setIsTaskDrawerOpen(!isTaskDrawerOpen)}
            style={{
              borderRadius: '50px',
              padding: '0.75rem 1.25rem',
              background: isTaskDrawerOpen ? 'var(--accent)' : 'var(--bg-secondary)',
              color: isTaskDrawerOpen ? 'white' : 'var(--text-main)',
              border: '1px solid var(--border)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600
            }}
          >
            <ClipboardList size={20} />
            <span>Tareas ({tasks.filter(t => (activeTab === 'panel0' ? t.panelName === 'Biblioteca' : t.courseId === activeCourseId) && t.status !== 'RESUELTO').length})</span>
          </button>
        )}

        {/* Floating Help Button */}
        <button
          className="btn btn-primary"
          onClick={() => setIsHelpOpen(true)}
          style={{
            borderRadius: '50px',
            padding: '0.75rem 1.25rem',
            boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600
          }}
        >
          <Info size={20} />
          <span>Ayuda</span>
        </button>
      </div>

      <HelpModal 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
        activeTab={activeTab} 
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setTaskToEdit(undefined); }}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        users={users}
        courses={courses}
        currentUser={user}
        prefilledCourseId={prefilledTaskData.courseId}
        prefilledRowId={prefilledTaskData.rowId}
        prefilledRowNro={prefilledTaskData.rowNro}
        prefilledRowModulo={prefilledTaskData.rowModulo}
        prefilledPanelName={prefilledTaskData.panelName}
        taskToEdit={taskToEdit}
      />
      {DialogRenderer}
    </div>
  );
}

export default App;
