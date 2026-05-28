import { useState, useEffect, useCallback, useRef } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { authApi, usersApi, foldersApi, coursesApi, rowsApi, tasksApi, libraryApi, getToken, clearToken } from './services/api';
import type { ApiRow, ApiTask } from './services/api';
import PanelHeader from './components/PanelHeader';
import ContentTable from './components/ContentTable';
import MultimediaTable from './components/MultimediaTable';
import ApprovalTable from './components/ApprovalTable';
import DesignPanel from './components/DesignPanel';
import SystemsPanel from './components/SystemsPanel';
import AnalyticsPanel from './components/AnalyticsPanel';
import Login from './components/Login';
import { LanguagesPanel } from './components/LanguagesPanel';
import { MonitorPlay, Settings, FileText, CheckCircle, LogOut, User as UserIcon, Palette, BarChart2, Info, ChevronLeft, ChevronRight, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, ClipboardList, Plus, Trash2, Pencil, Sun, Moon, Globe, Undo2, Redo2 } from 'lucide-react';
import { type CourseRow, type User, type CourseTemplate, type Course, type Folder, defaultRow, defaultDesign, initialBlockCodes, mapFormatoToBlockType, DEFAULT_PASSWORD, type Task } from './types';
import HelpModal from './components/HelpModal';
import CourseDashboard from './components/CourseDashboard';
import TaskModal from './components/TaskModal';
import { useDialog } from './components/CustomDialog';
import logoIsotipo from './assets/isotipo.png';
import logoImg from './assets/logo-Bfsgbzr0.png';

function App() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState('panel1');
  const [dashboardTab, setDashboardTab] = useState<'courses' | 'library' | 'analytics' | 'users' | 'tasks'>('courses');
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
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useLocalStorage<boolean>('cf_header_collapsed', false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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

  const [undoStack, setUndoStack] = useState<CourseRow[][]>([]);
  const [redoStack, setRedoStack] = useState<CourseRow[][]>([]);
  const activeEditingCellRef = useRef<{ id: string; fieldKey: string } | null>(null);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    activeEditingCellRef.current = null;
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
    }
  }, [activeCourseId]);

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await foldersApi.delete(folderId);
      const [apiFolders, apiCourses] = await Promise.all([foldersApi.getAll(), coursesApi.getAll()]);
      setFolders(apiFolders.map(f => ({
        ...f,
        parentId: f.parentId ?? undefined,
        year: f.year ?? undefined,
        isOfficial: f.isOfficial ?? undefined
      })));
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
  const courseNameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapApiRow = (r: ApiRow, i: number): CourseRow => ({
    nro: (i + 1).toString(),
    id: r.id,
    courseId: r.courseId,
    materia: r.materia,
    modulo: r.modulo,
    descripcion: r.descripcion,
    formato: r.formato,
    links: r.links,
    fileName: r.fileName ?? undefined,
    fileType: r.fileType ?? undefined,
    htmlContent: r.htmlContent ?? undefined,
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
    generatedHtml: r.generatedHtml ?? undefined,
    aprobacionDiseno: r.aprobacionDiseno,
    aprobacionTraduccion: r.aprobacionTraduccion,
    googleFileId: r.googleFileId,
    googleLastSyncedAt: r.googleLastSyncedAt,
    googleModifiedTime: r.googleModifiedTime,
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


  const loadTasks = async () => {
    try {
      const apiTasks = await tasksApi.getAll();
      setTasks(apiTasks.map(mapApiTask));
    } catch (err) { console.error('Error loading tasks:', err); }
  };


  const loadAppData = async (firstCourseId?: string): Promise<string | undefined> => {
    try {
      const [apiFolders, apiCourses] = await Promise.all([
        foldersApi.getAll(),
        coursesApi.getAll(),
      ]);
      const mappedFolders: Folder[] = apiFolders.map(f => ({
        ...f,
        parentId: f.parentId ?? undefined,
        year: f.year ?? undefined,
        isOfficial: f.isOfficial ?? undefined,
      }));
      const mappedCourses: Course[] = apiCourses.map(c => ({
        ...c,
        rows: [],
        folderId: c.folderId ?? undefined,
        languages: c.languages || 'ES',
      }));
      setFolders(mappedFolders);
      setCourses(mappedCourses);

      const targetId = firstCourseId || mappedCourses[0]?.id;
      if (targetId) {
        setActiveCourseId(targetId);
      }
      return targetId;
    } catch (err) {
      console.error('Error loading app data:', err);
      return undefined;
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
  }, [activeCourseId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (getToken()) {
      authApi.getMe()
        .then(async u => {
          if (u.mustChangePassword) {
            setPendingUser(u as User);
            setShowChangePassword(true);
            return;
          }
          setUser(u as User);
          usersApi.getAll().then(setUsers).catch(console.error);
          const targetId = await loadAppData();
          if (targetId) loadCourseRows(targetId).catch(console.error);
          loadTasks().catch(console.error);
        })
        .catch(() => {
          clearToken();
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCourse = courses.find(c => c.id === activeCourseId) ?? courses[0];
  const rows = activeCourse?.rows ?? [];
  const pendingTaskCount = tasks.filter(t => t.assignedTo === user?.id && t.status !== 'RESUELTO').length;



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
          const isDocx = (row.fileType && row.fileType.includes('docx')) || (row.fileName && row.fileName.toLowerCase().endsWith('.docx'));
          const expectedType = (isDocx && (row.formato === 'PDF' || row.formato === 'TEXTO'))
            ? 'text'
            : mapFormatoToBlockType(row.formato);
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

  const handleUpdateCourseName = (id: string, name: string) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    if (courseNameTimer.current) clearTimeout(courseNameTimer.current);
    courseNameTimer.current = setTimeout(() => {
      coursesApi.update(id, { name }).catch(console.error);
    }, 600);
  };

  const handleMoveCourse = async (courseId: string, folderId: string | undefined) => {
    try {
      await coursesApi.update(courseId, { folderId: folderId || null });
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, folderId } : c));
    } catch (err) { console.error(err); }
  };

  const addRow = async (materia?: string, modulo?: string) => {
    const materias = Array.from(new Set(rows.map(r => r.materia)));
    const rowData = {
      ...defaultRow,
      materia: materia !== undefined ? materia : `Materia ${materias.length + 1}`,
      modulo: modulo !== undefined ? modulo : 'Clase 1',
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

  const pushToUndoStack = (currentRows: CourseRow[]) => {
    const snapshot = JSON.parse(JSON.stringify(currentRows));
    setUndoStack(prev => {
      const next = [...prev, snapshot];
      if (next.length > 5) {
        next.shift();
      }
      return next;
    });
    setRedoStack([]);
  };

  const handleCellEditHistory = (rowId: string, fieldKey: string, currentRows: CourseRow[]) => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
    }
    const activeEditing = activeEditingCellRef.current;
    if (!activeEditing || activeEditing.id !== rowId || activeEditing.fieldKey !== fieldKey) {
      pushToUndoStack(currentRows);
      activeEditingCellRef.current = { id: rowId, fieldKey };
    }
    historyTimerRef.current = setTimeout(() => {
      activeEditingCellRef.current = null;
    }, 1500);
  };

  const syncRowsWithBackend = async (currentRows: CourseRow[], targetRows: CourseRow[]) => {
    try {
      const currentIds = currentRows.map(r => r.id);
      const targetIds = targetRows.map(r => r.id);
      const orderChanged = JSON.stringify(currentIds) !== JSON.stringify(targetIds);

      if (orderChanged) {
        await rowsApi.reorder(activeCourseId, targetIds);
      }

      const updates: Promise<any>[] = [];
      targetRows.forEach(targetRow => {
        const currentRow = currentRows.find(r => r.id === targetRow.id);
        if (!currentRow) return;

        const payload: Partial<ApiRow> = {};
        let hasChanges = false;
        const fieldsToCompare: (keyof CourseRow)[] = [
          'materia', 'modulo', 'descripcion', 'formato', 'links', 
          'fileName', 'fileType', 'estado', 'videoDrive', 'videoVimeo', 
          'videoSubtitulos', 'geniallyUrl', 'geniallyLinkStatus', 
          'geniallyTextoStatus', 'geniallyDisenoStatus', 'estadoMultimedia', 
          'aprobacionContenido', 'aprobacionMultimedia', 'aprobacionDiseno', 
          'aprobacionTraduccion', 'comentariosRevisor', 'estadoFinal', 'nro',
          'googleFileId', 'googleLastSyncedAt', 'googleModifiedTime'
        ];

        fieldsToCompare.forEach(field => {
          if (targetRow[field] !== currentRow[field]) {
            payload[field as keyof ApiRow] = targetRow[field] as any;
            hasChanges = true;
          }
        });

        if (hasChanges) {
          updates.push(rowsApi.update(activeCourseId, targetRow.id, payload));
        }
      });

      if (updates.length > 0) {
        await Promise.all(updates);
      }
    } catch (err) {
      console.error('Error synchronizing undo/redo with backend:', err);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const previousRows = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    const currentSnapshot = JSON.parse(JSON.stringify(rows));
    setRedoStack(prev => {
      const next = [...prev, currentSnapshot];
      if (next.length > 5) next.shift();
      return next;
    });

    activeEditingCellRef.current = null;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);

    setCourses(prevCourses => prevCourses.map(c => 
      c.id === activeCourseId ? { ...c, rows: previousRows } : c
    ));

    await syncRowsWithBackend(rows, previousRows);
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const nextRows = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));

    const currentSnapshot = JSON.parse(JSON.stringify(rows));
    setUndoStack(prev => {
      const next = [...prev, currentSnapshot];
      if (next.length > 5) next.shift();
      return next;
    });

    activeEditingCellRef.current = null;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);

    setCourses(prevCourses => prevCourses.map(c => 
      c.id === activeCourseId ? { ...c, rows: nextRows } : c
    ));

    await syncRowsWithBackend(rows, nextRows);
  };

  const updateRow = (id: string, field: keyof CourseRow | Partial<CourseRow>, value?: string) => {
    const fieldKey = typeof field === 'object' ? 'bulk' : (field as string);
    handleCellEditHistory(id, fieldKey, rows);

    // Optimistic local update
    let apiPayload: Partial<ApiRow> = {};
    let localUpdates: Partial<CourseRow> = {};

    if (typeof field === 'object') {
      localUpdates = field;
      apiPayload = field as Partial<ApiRow>;
    } else {
      localUpdates = { [field]: value as string };
      apiPayload = { [field]: value as string };
    }

    setCourses(prevCourses => prevCourses.map(c =>
      c.id === activeCourseId
        ? { ...c, rows: c.rows.map(row => {
            if (row.id !== id) return row;
            const updated = { ...row, ...localUpdates };
            if (localUpdates.links !== undefined) {
              if (row.formato === 'VIDEO') { updated.videoDrive = localUpdates.links; apiPayload.videoDrive = localUpdates.links; }
              else if (row.formato === 'GENIALLY') { updated.geniallyUrl = localUpdates.links; apiPayload.geniallyUrl = localUpdates.links; }
            } else if (localUpdates.videoDrive !== undefined && row.formato === 'VIDEO') {
              updated.links = localUpdates.videoDrive; apiPayload.links = localUpdates.videoDrive;
            } else if (localUpdates.geniallyUrl !== undefined && row.formato === 'GENIALLY') {
              updated.links = localUpdates.geniallyUrl; apiPayload.links = localUpdates.geniallyUrl;
            } else if (localUpdates.formato !== undefined) {
              if (localUpdates.formato === 'VIDEO') { updated.videoDrive = row.links || row.videoDrive; }
              else if (localUpdates.formato === 'GENIALLY') { updated.geniallyUrl = row.links || row.geniallyUrl; }
            }
            return updated;
          }) }
        : c
    ));

    // Debounced API call
    const key = typeof field === 'object' ? `${id}-bulk` : `${id}-${field}`;
    clearTimeout(updateRowTimers.current[key]);
    updateRowTimers.current[key] = setTimeout(() => {
      rowsApi.update(activeCourseId, id, apiPayload)
        .then(() => {
          if (apiPayload.googleLastSyncedAt) {
            loadTasks().catch(console.error);
          }
        })
        .catch(console.error);
    }, 600);
  };

  const moveRow = (draggedId: string, targetId: string | null, targetModule?: string) => {
    pushToUndoStack(rows);
    activeEditingCellRef.current = null;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);

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

  const handleAddLibraryItem = async (
    descripcion: string,
    formato: string,
    links: string,
    fileName?: string,
    fileType?: string,
    fileUrl?: string,
    videoDrive?: string,
    videoVimeo?: string,
    videoSubtitulos?: string
  ) => {
    try {
      await libraryApi.create({
        descripcion,
        formato,
        links,
        fileName,
        fileType,
        fileUrl,
        videoDrive,
        videoVimeo,
        videoSubtitulos
      });
    } catch (err) { console.error(err); }
  };

  const handleDeleteLibraryItem = (id: string) => {
    showConfirm(
      '🗑️ Eliminar Recurso',
      '¿Estás seguro de eliminar este recurso de la biblioteca? Esta acción no se puede deshacer.',
      async () => {
        try {
          await libraryApi.delete(id);
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
      await Promise.all([loadCourseRows(courseId), loadTasks()]);
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


  const handleLogin = async (u: User) => {
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
    const targetId = await loadAppData();
    if (targetId) loadCourseRows(targetId).catch(console.error);
    loadTasks().catch(console.error);
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
      const targetId = await loadAppData();
      if (targetId) loadCourseRows(targetId).catch(console.error);
      loadTasks().catch(console.error);
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

  const hasNoPanels = user && !user.isAdmin && (
    !user.allowedPanels ||
    !Array.isArray(user.allowedPanels) ||
    user.allowedPanels.length === 0 ||
    user.allowedPanels.filter(p => typeof p === 'number').length === 0
  );

  if (hasNoPanels) {
    return (
      <div className={`login-container ${theme}`} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <div className="login-glass-panel" style={{ maxWidth: '480px', textAlign: 'center', padding: '2.5rem 3rem' }}>
          <div className="login-header">
            <div className="login-logo">
              <img src={logoImg} alt="Maradona Menotti" />
            </div>
            <div className="login-badge" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
              Acceso en Espera
            </div>
          </div>

          <div style={{ margin: '1.5rem 0', color: 'var(--text-main)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Hola, {user.name} 👋
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
              Tu cuenta ha sido creada y registrada correctamente en el sistema.
            </p>
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '12px',
              padding: '1rem',
              fontSize: '0.85rem',
              color: '#f59e0b',
              textAlign: 'left',
              marginBottom: '1.5rem',
              lineHeight: '1.4'
            }}>
              <strong>Permisos pendientes:</strong> Para comenzar a utilizar CourseFactory, un administrador debe asignar los permisos y los paneles correspondientes a tu usuario.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={async () => {
                try {
                  const updatedUser = await authApi.getMe();
                  setUser(updatedUser as User);
                } catch (err) {
                  console.error('Error al actualizar estado:', err);
                }
              }}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              Comprobar mi Estado
            </button>

            <button
              onClick={handleLogout}
              className="btn btn-outline"
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderColor: 'rgba(255,255,255,0.15)',
                color: 'white'
              }}
            >
              Cerrar Sesión
            </button>
          </div>

          <div className="login-help" style={{ marginTop: '1.5rem' }}>
            Comunícate con soporte o tu administrador para habilitar tu acceso.
          </div>
        </div>
      </div>
    );
  }

  const canAccess = (panel: string) => {
    if (user.isAdmin) return true;
    if (panel === 'panel0') {
      return user.role === 'admin' || user.role === 'multimedia' || user.role === 'autor' || (user.allowedPanels && user.allowedPanels.includes(0));
    }
    if (panel === 'panel7') {
      return true; // Acceso global para configuración de idiomas
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
        activeTab={dashboardTab}
        setActiveTab={setDashboardTab}
        onAddLibraryItem={handleAddLibraryItem}
        onDeleteLibraryItem={handleDeleteLibraryItem}
        onAssignLibraryItem={handleAssignLibraryItem}
        onNavigateToTaskSource={(courseId, panelName) => {
          if (panelName === 'Biblioteca') {
            setDashboardTab('library');
            setView('dashboard');
          } else {
            setActiveCourseId(courseId);
            setView('editor');
            const panelMap: Record<string, string> = {
              'Contenido': 'panel1',
              'Multimedia': 'panel2',
              'Verificación': 'panel3',
              'Maquetado': 'panel4',
              'Sistemas': 'panel5',
              'Analítica': 'panel6',
              'Idiomas': 'panel7'
            };
            if (panelMap[panelName]) {
              setActiveTab(panelMap[panelName]);
            }
          }
        }}
      />
    );
  }

  const renderHistoryButtons = () => {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          title="Deshacer (Atrás) - Máximo 5 movimientos"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            opacity: undoStack.length === 0 ? 0.5 : 1,
            cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer',
            padding: '0.4rem 0.8rem',
            borderRadius: '8px',
            fontSize: '0.85rem'
          }}
        >
          <Undo2 size={14} />
          <span>Deshacer ({undoStack.length})</span>
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          title="Rehacer (Adelante)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            opacity: redoStack.length === 0 ? 0.5 : 1,
            cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer',
            padding: '0.4rem 0.8rem',
            borderRadius: '8px',
            fontSize: '0.85rem'
          }}
        >
          <Redo2 size={14} />
          <span>Rehacer ({redoStack.length})</span>
        </button>
      </div>
    );
  };

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
  <div className="logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <img src={logoIsotipo} alt="Logo Maradona Menotti" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
  </div>
          {!isSidebarCollapsed && <h2>CourseFactory</h2>}
        </div>

        <nav className="nav-menu">
          {/* Biblioteca reubicada al menú superior */}

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

          {canAccess('panel7') && (
            <button 
              className={`nav-item ${activeTab === 'panel7' ? 'active' : ''}`}
              onClick={() => setActiveTab('panel7')}
              title={isSidebarCollapsed ? "Panel 7: Idiomas" : ""}
            >
              <Globe size={20} />
              {!isSidebarCollapsed && <span>Panel 7: Idiomas</span>}
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            className={`nav-item ${isTaskDrawerOpen ? 'active' : ''}`}
            onClick={() => setIsTaskDrawerOpen(!isTaskDrawerOpen)}
            title={isSidebarCollapsed ? `Mis Tareas (${pendingTaskCount} pendientes)` : ''}
            style={{ position: 'relative', width: '100%', marginBottom: '8px' }}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <ClipboardList size={20} />
              {pendingTaskCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-6px', right: '-8px',
                  background: '#ef4444', color: 'white', borderRadius: '50%',
                  minWidth: '16px', height: '16px', fontSize: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, padding: '0 2px', lineHeight: 1
                }}>
                  {pendingTaskCount}
                </span>
              )}
            </div>
            {!isSidebarCollapsed && <span>Mis Tareas</span>}
          </button>

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
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '6px' }}
              >
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <button className="logout-button" onClick={handleLogout} title="Cerrar sesión">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-header glass-panel" style={{ 
          zIndex: 10,
          height: isHeaderCollapsed ? '0px' : 'auto',
          minHeight: isHeaderCollapsed ? '0px' : '70px',
          overflow: 'hidden',
          padding: isHeaderCollapsed ? '0px 1.5rem' : '1.5rem',
          borderBottom: isHeaderCollapsed ? 'none' : '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
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

        {/* Collapsible toggle tab */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: isHeaderCollapsed ? '0px' : '-8px',
          marginBottom: '8px',
          zIndex: 11,
          position: 'relative'
        }}>
          <button
            onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
            style={{
              background: 'rgba(20, 184, 166, 0.9)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(20, 184, 166, 0.3)',
              borderTop: 'none',
              borderBottomLeftRadius: '8px',
              borderBottomRightRadius: '8px',
              color: '#ffffff',
              padding: '4px 14px',
              fontSize: '0.65rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-color)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(20, 184, 166, 0.9)'}
          >
            {isHeaderCollapsed ? '▼ Mostrar Cabecera' : '▲ Minimizar Cabecera'}
          </button>
        </div>

        <div className="content-area animate-fade-in" style={{ marginRight: isTaskDrawerOpen ? '380px' : '0', transition: 'margin-right 0.3s ease-out' }}>
          {/* panel0 (Biblioteca) reubicado al menú superior */}
          {activeTab === 'panel1' && canAccess('panel1') && (
            <div className="panel-container">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3>Carga de Unidades y Temas</h3>
                  <p className="text-muted">Gestión de contenido, redacción de guiones y estructuración de clases.</p>
                </div>
                {renderHistoryButtons()}
              </div>
              <ContentTable rows={rows} tasks={tasks} courseId={activeCourse?.id || ''} addRow={addRow} updateRow={updateRow} removeRow={removeRow} updateModule={updateModule} updateMateria={updateMateria} moveRow={moveRow} onAddRowTask={openRowTaskModal} user={user!} />
            </div>
          )}
          {activeTab === 'panel2' && canAccess('panel2') && (
            <div className="panel-container animate-fade-in">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3>Departamento de Edición (Multimedia)</h3>
                  <p className="text-muted">Asignación de links, control de videos y estado de recursos interactivos.</p>
                </div>
                {renderHistoryButtons()}
              </div>
              <MultimediaTable rows={rows} tasks={tasks} courseId={activeCourse?.id || ''} updateRow={updateRow} onAddRowTask={openRowTaskModal} user={user!} />
            </div>
          )}
          {activeTab === 'panel3' && canAccess('panel3') && (
            <div className="panel-container animate-fade-in">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3>Verificación y Aprobación de Calidad</h3>
                  <p className="text-muted">Revisión final de los contenidos y multimedia antes de exportar a Moodle.</p>
                </div>
                {renderHistoryButtons()}
              </div>
              <ApprovalTable rows={rows} tasks={tasks} courseId={activeCourse?.id || ''} updateRow={updateRow} onAddRowTask={openRowTaskModal} templates={templates} languages={activeCourse?.languages || 'ES'} user={user!} />
            </div>
          )}
          {activeTab === 'panel4' && canAccess('panel4') && (
            <div className="panel-container animate-fade-in" style={{ padding: '0' }}>
              <DesignPanel templates={templates} setTemplates={setTemplates} rows={rows} />
            </div>
          )}
          {activeTab === 'panel5' && canAccess('panel5') && (
            <div className="panel-container animate-fade-in" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <SystemsPanel rows={rows} templates={templates} />
            </div>
          )}
          {activeTab === 'panel6' && canAccess('panel6') && (
            <div className="panel-container animate-fade-in" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <AnalyticsPanel courses={courses} />
            </div>
          )}
          {activeTab === 'panel7' && canAccess('panel7') && (
            <div className="panel-container animate-fade-in">
              <div className="panel-header">
                <h3>Gestión y Configuración de Idiomas</h3>
                <p className="text-muted">Administración global y selección de idiomas disponibles para la traducción de contenidos.</p>
              </div>
              <LanguagesPanel 
                activeCourse={activeCourse} 
                onUpdateCourse={(updatedCourse) => {
                  setCourses(prev => prev.map(c => c.id === updatedCourse.id ? { ...c, ...updatedCourse } : c));
                }}
                userRole={user?.role}
              />
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
                const panelMap: Record<string, string> = {
                  'panel1': 'Contenido',
                  'panel2': 'Multimedia',
                  'panel3': 'Verificación',
                  'panel4': 'Maquetado',
                  'panel5': 'Sistemas',
                  'panel6': 'Analítica',
                  'panel7': 'Idiomas'
                };
                setPrefilledTaskData({
                  courseId: activeCourseId,
                  panelName: panelMap[activeTab] || 'Contenido'
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
              const activeTasks = tasks.filter(t => t.courseId === activeCourseId);

              if (activeTasks.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No hay observaciones ni tareas creadas en este curso.
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
            <span>Tareas ({tasks.filter(t => t.courseId === activeCourseId && t.status !== 'RESUELTO').length})</span>
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
