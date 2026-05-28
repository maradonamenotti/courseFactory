import { Plus, Trash2, ExternalLink, Upload, Eye, GripVertical, Loader2, ClipboardList, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';
import type { CourseRow, User, Task } from '../types';
import { filesApi } from '../services/api';
import { HistoryDrawer } from './HistoryDrawer';

interface ContentTableProps {
  rows: CourseRow[];
  tasks?: Task[];
  courseId: string;
  addRow: (materia?: string, modulo?: string) => void;
  updateRow: (id: string, field: keyof CourseRow | Partial<CourseRow>, value?: string) => void;
  removeRow: (id: string) => void;
  updateModule: (oldName: string, newName: string) => void;
  updateMateria: (oldName: string, newName: string) => void;
  moveRow: (draggedId: string, targetId: string | null, targetModule?: string) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
  user: User;
}

const formatOptions = ['VIDEO', 'TEXTO', 'CUESTIONARIO', 'GENIALLY', 'PDF', 'FLIP', 'OTRO'];
const statusOptions = [
  { value: '1-NO EMPEZADO', color: 'var(--status-not-started)' },
  { value: '2-EN PROCESO', color: 'var(--status-in-progress)' },
  { value: '3-CORREGIR', color: 'var(--status-review)' },
  { value: '4-DISPONIBLE', color: 'var(--status-available)' }
];

// ── Utilities ──────────────────────────────────────────────────────────────
const isGoogleDriveUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return ['drive.google.com', 'docs.google.com', 'sheets.google.com',
            'slides.google.com', 'forms.google.com'].includes(hostname);
  } catch { return false; }
};

const decodeHTML = (str: string): string => {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

const cleanGoogleTitle = (raw: string): string => {
  // Replace non-breaking spaces (\u00a0) and multiple spaces with a standard space
  const normalized = decodeHTML(raw).replace(/\s+/g, ' ').trim();
  
  // Check if it's an error, sign-in, or access-denied page
  const lower = normalized.toLowerCase();
  const isError = [
    'page not found', 'página no encontrada', 'error', 
    'sign in', 'iniciar sesión', 'access denied', 'acceso denegado',
    'iniciar sesión en las cuentas de google', 'google drive - virus scan warning'
  ].some(err => lower.includes(err));
  
  if (isError) {
    throw new Error('Proxy returned an error/auth page');
  }

  return normalized
    .replace(/\s*-\s*Google\s*(Docs|Sheets|Slides|Forms|Drive)$/i, '')
    .replace(/\s*-\s*(Documentos|Hojas de cálculo|Presentaciones|Formularios)\s*de\s*Google$/i, '')
    .trim();
};

const fetchTitleFromProxies = async (url: string, signal?: AbortSignal): Promise<string> => {
  const proxies = [
    {
      // Proxy 1: CodeTabs (Fast, clean, free, raw response - trailing slash required)
      getUrl: (target: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(target)}`,
      parse: (text: string) => text
    },
    {
      // Proxy 2: CORS.lol (Reliable free public proxy)
      getUrl: (target: string) => `https://api.cors.lol/?url=${encodeURIComponent(target)}`,
      parse: (text: string) => text
    },
    {
      // Proxy 3: AllOrigins (Robust, JSON wrapper as backup)
      getUrl: (target: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
      parse: (text: string) => {
        try {
          const json = JSON.parse(text);
          return json.contents || '';
        } catch {
          return text;
        }
      }
    }
  ];

  let lastError: any = new Error('No proxies succeeded');

  for (const proxy of proxies) {
    try {
      const response = await fetch(proxy.getUrl(url), { signal });
      if (!response.ok) continue;
      const text = await response.text();
      const html = proxy.parse(text);
      
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match) {
        return cleanGoogleTitle(match[1]);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
};

// ── DriveLink component ────────────────────────────────────────────────────
interface DriveLinkProps {
  url: string;
  storedTitle: string;
  rowId: string;
  onTitleFetched: (id: string, title: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

const DriveLink: React.FC<DriveLinkProps> = ({ url, storedTitle, rowId, onTitleFetched, onClear, disabled }) => {
  type Status = 'loading' | 'done' | 'manual';
  const [title, setTitle] = useState(storedTitle);
  const [status, setStatus] = useState<Status>(storedTitle ? 'done' : 'loading');
  const [editVal, setEditVal] = useState('');

  useEffect(() => {
    if (storedTitle) { setTitle(storedTitle); setStatus('done'); return; }

    setStatus('loading');
    const ctrl = new AbortController();

    fetchTitleFromProxies(url, ctrl.signal)
      .then(t => {
        setTitle(t);
        onTitleFetched(rowId, t);
        setStatus('done');
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          console.warn("Failed to fetch Drive title automatically, falling back to manual input:", err);
          setStatus('manual');
        }
      });

    return () => ctrl.abort();
  }, [url, storedTitle]);

  const confirmManual = () => {
    const val = editVal.trim();
    if (val) { setTitle(val); onTitleFetched(rowId, val); setStatus('done'); }
  };

  const chipStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    background: 'rgba(139, 92, 246, 0.1)', borderRadius: '6px',
    padding: '0.25rem 0.65rem', flex: 1, minWidth: 0,
    border: '1px solid rgba(139, 92, 246, 0.22)',
    color: 'var(--accent)', textDecoration: 'none',
    fontSize: '0.82rem', fontWeight: 500,
    overflow: 'hidden', whiteSpace: 'nowrap',
  };

  const clearBtn = !disabled && (
    <button
      onClick={onClear}
      title="Remover enlace"
      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
               padding: '0 0.3rem', opacity: 0.65, flexShrink: 0, fontSize: '1rem', lineHeight: 1 }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
    >×</button>
  );

  if (status === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
      <div style={{ ...chipStyle, color: 'var(--text-muted)', cursor: 'default', gap: '0.5rem' }}>
        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Obteniendo título...</span>
      </div>
      {clearBtn}
    </div>
  );

  if (status === 'manual') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}>
      <input
        type="text"
        className="cell-input"
        placeholder="Nombre del documento..."
        autoFocus
        value={editVal}
        disabled={disabled}
        onChange={e => setEditVal(e.target.value)}
        onBlur={confirmManual}
        onKeyDown={e => e.key === 'Enter' && confirmManual()}
        style={{ flex: 1, minWidth: 0 }}
      />
      {clearBtn}
    </div>
  );

  // status === 'done'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}>
      <a href={url} target="_blank" rel="noopener noreferrer" title={url} style={chipStyle}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}
      >
        <ExternalLink size={11} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title || url}</span>
      </a>
      {clearBtn}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const ContentTable: React.FC<ContentTableProps> = ({ rows, tasks = [], courseId, addRow, updateRow, removeRow, updateModule, updateMateria, moveRow, onAddRowTask, user }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyRow, setHistoryRow] = useState<{ id: string; label: string } | null>(null);

  // Google Drive Integration States
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(() => sessionStorage.getItem('google_access_token'));
  
  interface FileStatus {
    hasUpdate: boolean;
    checked: boolean;
    currentModifiedTime?: string;
    lastModifyingUser?: string;
    error?: boolean;
  }
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatus>>({});

  useEffect(() => {
    let checkInterval: ReturnType<typeof setTimeout>;
    
    const checkLoaded = () => {
      if ((window as any).google && (window as any).gapi) {
        setGoogleLoaded(true);
        // Pre-load picker
        (window as any).gapi.load('picker', { callback: () => console.log('Google Picker loaded') });
      } else {
        checkInterval = setTimeout(checkLoaded, 500);
      }
    };
    
    checkLoaded();
    
    return () => {
      if (checkInterval) clearTimeout(checkInterval);
    };
  }, []);

  const checkDriveFiles = async (token: string) => {
    const driveRows = rows.filter(r => r.googleFileId);
    if (driveRows.length === 0) return;

    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
    const newStatuses: Record<string, FileStatus> = { ...fileStatuses };
    let updated = false;

    for (const row of driveRows) {
      if (!row.googleFileId) continue;
      if (fileStatuses[row.id]?.checked) continue;

      try {
        const url = `https://www.googleapis.com/drive/v3/files/${row.googleFileId}?fields=modifiedTime,lastModifyingUser&supportsAllDrives=true${apiKey ? `&key=${apiKey}` : ''}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          newStatuses[row.id] = { checked: true, hasUpdate: false, error: true };
          updated = true;
          continue;
        }
        const data = await res.json();
        const currentModifiedTime = data.modifiedTime;
        const hasUpdate = currentModifiedTime && row.googleModifiedTime && (currentModifiedTime !== row.googleModifiedTime);
        newStatuses[row.id] = {
          checked: true,
          hasUpdate: !!hasUpdate,
          currentModifiedTime,
          lastModifyingUser: data.lastModifyingUser?.displayName || data.lastModifyingUser?.emailAddress || 'Desconocido'
        };
        updated = true;
      } catch (err) {
        console.error('Error checking file status:', err);
        newStatuses[row.id] = { checked: true, hasUpdate: false, error: true };
        updated = true;
      }
    }

    if (updated) {
      setFileStatuses(newStatuses);
    }
  };

  useEffect(() => {
    if (accessToken && googleLoaded) {
      checkDriveFiles(accessToken);
    }
  }, [accessToken, googleLoaded, rows]);

  const handleGoogleDrivePick = (rowId: string) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

    if (!clientId || !apiKey) {
      alert('Por favor, configura VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY en tu archivo .env para usar Google Drive.');
      return;
    }

    const showPicker = (token: string) => {
      try {
        const docsView = new (window as any).google.picker.DocsView()
          .setMimeTypes('application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/vnd.google-apps.document')
          .setIncludeFolders(true)
          .setEnableDrives(true);
          
        const picker = new (window as any).google.picker.PickerBuilder()
          .addView(docsView)
          .setOAuthToken(token)
          .setDeveloperKey(apiKey)
          .setCallback((data: any) => {
            if (data.action === (window as any).google.picker.Action.PICKED) {
              const file = data.docs[0];
              const fileId = file.id;
              importDriveFile(rowId, fileId, token);
            }
          })
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error('Error opening Google Picker:', err);
        alert('Error al abrir el selector de Google Drive.');
      }
    };

    if (accessToken) {
      showPicker(accessToken);
    } else {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              sessionStorage.setItem('google_access_token', response.access_token);
              showPicker(response.access_token);
              checkDriveFiles(response.access_token);
            }
          },
        });
        client.requestAccessToken();
      } catch (err) {
        console.error('Error initializing Google auth client:', err);
        alert('Error de conexión con Google Identity Services.');
      }
    }
  };

  const importDriveFile = async (rowId: string, fileId: string, token: string) => {
    setIsUploading(prev => ({ ...prev, [rowId]: true }));
    try {
      const res = await filesApi.importDrive(fileId, token);
      updateRow(rowId, {
        links: res.url,
        fileName: res.fileName,
        fileType: res.fileType,
        htmlContent: res.htmlContent || undefined,
        googleFileId: res.googleFileId,
        googleModifiedTime: res.googleModifiedTime,
        googleLastSyncedAt: new Date().toISOString()
      });
      setFileStatuses(prev => ({
        ...prev,
        [rowId]: { checked: true, hasUpdate: false, currentModifiedTime: res.googleModifiedTime }
      }));
    } catch (err) {
      console.error('Error importing file:', err);
      alert(err instanceof Error ? err.message : 'Error al importar el archivo de Google Drive');
    } finally {
      setIsUploading(prev => ({ ...prev, [rowId]: false }));
    }
  };

  const handleResync = async (rowId: string, fileId: string) => {
    if (!accessToken) {
      handleGoogleDrivePick(rowId);
      return;
    }
    setIsUploading(prev => ({ ...prev, [rowId]: true }));
    try {
      const res = await filesApi.importDrive(fileId, accessToken);
      updateRow(rowId, {
        links: res.url,
        fileName: res.fileName,
        fileType: res.fileType,
        htmlContent: res.htmlContent || undefined,
        googleFileId: res.googleFileId,
        googleModifiedTime: res.googleModifiedTime,
        googleLastSyncedAt: new Date().toISOString()
      });
      setFileStatuses(prev => ({
        ...prev,
        [rowId]: { checked: true, hasUpdate: false, currentModifiedTime: res.googleModifiedTime }
      }));
    } catch (err) {
      console.error('Error syncing file:', err);
      alert(err instanceof Error ? err.message : 'Error al sincronizar');
    } finally {
      setIsUploading(prev => ({ ...prev, [rowId]: false }));
    }
  };

  const handleCheckUpdates = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

    if (!clientId || !apiKey) {
      alert('Por favor, configura VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY en tu archivo .env.');
      return;
    }

    const runCheck = (token: string) => {
      setFileStatuses({});
      const driveRows = rows.filter(r => r.googleFileId);
      if (driveRows.length === 0) {
        alert('No hay archivos de Google Drive importados en este curso.');
        return;
      }
      
      const forceCheck = async (t: string) => {
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
        const newStatuses: Record<string, FileStatus> = {};
        let hasDriveFiles = false;
        
        for (const row of driveRows) {
          if (!row.googleFileId) continue;
          hasDriveFiles = true;
          try {
            const url = `https://www.googleapis.com/drive/v3/files/${row.googleFileId}?fields=modifiedTime,lastModifyingUser&supportsAllDrives=true${apiKey ? `&key=${apiKey}` : ''}`;
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${t}` }
            });
            if (!res.ok) {
              newStatuses[row.id] = { checked: true, hasUpdate: false, error: true };
              continue;
            }
            const data = await res.json();
            const currentModifiedTime = data.modifiedTime;
            const hasUpdate = currentModifiedTime && row.googleModifiedTime && (currentModifiedTime !== row.googleModifiedTime);
            newStatuses[row.id] = {
              checked: true,
              hasUpdate: !!hasUpdate,
              currentModifiedTime,
              lastModifyingUser: data.lastModifyingUser?.displayName || data.lastModifyingUser?.emailAddress || 'Desconocido'
            };
          } catch (err) {
            console.error(err);
            newStatuses[row.id] = { checked: true, hasUpdate: false, error: true };
          }
        }
        setFileStatuses(newStatuses);
        if (hasDriveFiles) {
          alert('Verificación de archivos completada.');
        }
      };
      
      forceCheck(token);
    };

    if (accessToken) {
      runCheck(accessToken);
    } else {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              sessionStorage.setItem('google_access_token', response.access_token);
              runCheck(response.access_token);
            }
          },
        });
        client.requestAccessToken();
      } catch (err) {
        console.error(err);
        alert('Error de conexión con Google Identity Services.');
      }
    }
  };

  const getTaskIconColor = (rowId: string, defaultColor: string = 'var(--accent)') => {
    const rowTasks = tasks.filter(t => t.rowId === rowId);
    if (rowTasks.length === 0) return defaultColor;
    const hasPending = rowTasks.some(t => t.status === 'PENDIENTE' || t.status === 'EN_PROCESO');
    if (hasPending) return '#f59e0b'; // orange
    const hasResolved = rowTasks.every(t => t.status === 'RESUELTO');
    if (hasResolved) return 'var(--status-available)'; // green
    return defaultColor;
  };
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggableRowId, setDraggableRowId] = useState<string | null>(null);

  const hasEditAccess = user.isAdmin || user.canEdit;
  const hasDeleteAccess = user.isAdmin || user.canDelete;
  const [collapsedMaterias, setCollapsedMaterias] = useState<Set<string>>(new Set());
  const [collapsedModulos, setCollapsedModulos] = useState<Set<string>>(new Set());

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

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDropOnRow = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) moveRow(draggedId, targetId);
    setDraggedId(null); setDraggableRowId(null);
  };
  const handleDropOnModule = (e: React.DragEvent, moduleName: string) => {
    e.preventDefault();
    if (draggedId) moveRow(draggedId, null, moduleName);
    setDraggedId(null); setDraggableRowId(null);
  };

  const getStatusColor = (status: string) => statusOptions.find(o => o.value === status)?.color || 'white';

  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const rowId = activeUploadId;
    if (file && rowId) {
      setIsUploading(prev => ({ ...prev, [rowId]: true }));
      try {
        const isDocx = file.name.toLowerCase().endsWith('.docx');
        if (isDocx) {
          const res = await filesApi.uploadDocx(file);
          updateRow(rowId, {
            links: res.url,
            fileName: res.fileName,
            fileType: res.fileType,
            htmlContent: res.htmlContent
          });
        } else {
          const res = await filesApi.upload(file);
          updateRow(rowId, {
            links: res.url,
            fileName: res.fileName,
            fileType: res.fileType,
            htmlContent: ''
          });
        }
      } catch (err) {
        console.error('Error uploading file:', err);
        alert(err instanceof Error ? err.message : 'Error al subir el archivo');
      } finally {
        setIsUploading(prev => ({ ...prev, [rowId]: false }));
      }
    }
    e.target.value = '';
    setActiveUploadId(null);
  };

  const triggerUpload = (id: string) => { setActiveUploadId(id); fileInputRef.current?.click(); };

  // Build 3-level hierarchy: Materia → Módulo → Rows
  // Use raw values (including '') so that updateMateria/updateModule pass the correct oldName to the API
  const materias = Array.from(new Set(rows.map(r => r.materia)));

  // Helper to decide which cell to render for the links column
  const renderLinksCell = (row: CourseRow) => {
    if (isUploading[row.id]) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(139, 92, 246, 0.1)', borderRadius: '6px',
            padding: '0.25rem 0.65rem', flex: 1, minWidth: 0,
            border: '1px solid rgba(139, 92, 246, 0.22)',
            color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 500,
            overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            <Loader2 size={12} className="spin" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Procesando...</span>
          </div>
        </div>
      );
    }

    const isFile = row.fileName && row.fileType && row.fileType !== 'link';
    const isDriveLink = row.links && isGoogleDriveUrl(row.links);

    // 1. Uploaded local file / Drive file
    if (isFile) {
      const status = fileStatuses[row.id];
      const showWarning = status?.hasUpdate;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0,
                        background: row.googleFileId ? 'rgba(52, 168, 83, 0.08)' : 'rgba(139,92,246,0.1)', 
                        borderRadius: '6px',
                        padding: '0.1rem 0.6rem', 
                        border: row.googleFileId ? '1px solid rgba(52, 168, 83, 0.25)' : '1px solid rgba(139,92,246,0.2)' }}>
            
            {row.googleFileId && (
              <svg viewBox="0 0 360 322" width="12" height="12" style={{ flexShrink: 0, marginRight: '2px' }}>
                <path fill="#34A853" d="M117 220 L30 322 L243 322 L330 220 Z"/>
                <path fill="#4285F4" d="M180 0 L117 220 L330 220 L270 0 Z"/>
                <path fill="#FBBC05" d="M180 0 L30 322 L117 220 L240 0 Z"/>
              </svg>
            )}

            <input type="text" value={row.fileName || ''}
              onChange={e => updateRow(row.id, 'fileName', e.target.value)}
              disabled={!hasEditAccess}
              style={{ background: 'transparent', border: 'none', outline: 'none',
                       fontSize: '0.85rem', color: row.googleFileId ? '#2e7d32' : 'var(--accent)', flex: 1, fontWeight: 500,
                       width: '100%', padding: '0.2rem 0', textOverflow: 'ellipsis' }}
              title={hasEditAccess ? "Haz clic para editar el nombre" : undefined} />
            
            {hasEditAccess && (
              <button onClick={() => { 
                updateRow(row.id, {
                  links: '',
                  fileName: '',
                  fileType: '',
                  htmlContent: '',
                  googleFileId: null,
                  googleLastSyncedAt: null,
                  googleModifiedTime: null
                });
              }}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                         padding: '0 0 0 0.5rem', opacity: 0.7, fontSize: '1rem', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
                title="Remover">×</button>
            )}
          </div>
          
          {row.googleFileId && showWarning && (
            <div 
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#d97706',
                cursor: 'help'
              }}
              title={status?.lastModifyingUser ? `Último cambio por: ${status.lastModifyingUser}\nFecha: ${new Date(status.currentModifiedTime || '').toLocaleString('es-AR')}` : 'Modificado en Drive'}
            >
              <span>⚠️ Modificado en Drive</span>
              {hasEditAccess && (
                <button 
                  onClick={() => handleResync(row.id, row.googleFileId!)}
                  style={{
                    background: '#d97706', color: '#fff', border: 'none', borderRadius: '3px',
                    padding: '1px 6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#b45309'}
                  onMouseLeave={e => e.currentTarget.style.background = '#d97706'}
                >
                  Sincronizar
                </button>
              )}
            </div>
          )}
          
          {row.googleFileId && status?.error && (
            <div style={{ fontSize: '0.72rem', color: '#ef4444', paddingLeft: '4px' }}>
              Error al verificar cambios
            </div>
          )}
        </div>
      );
    }

    // 2. Google Drive / Docs link → show DriveLink with fetched title
    if (isDriveLink) return (
      <DriveLink
        url={row.links}
        storedTitle={row.fileName && row.fileType === 'link' ? row.fileName : ''}
        rowId={row.id}
        onTitleFetched={(id, t) => { updateRow(id, 'fileName', t); updateRow(id, 'fileType', 'link'); }}
        onClear={() => { updateRow(row.id, 'links', ''); updateRow(row.id, 'fileName', ''); updateRow(row.id, 'fileType', ''); }}
        disabled={!hasEditAccess}
      />
    );

    // 3. Other pasted link with a display name
    if (row.fileName && row.fileType === 'link') return (
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(139,92,246,0.1)',
                    borderRadius: '6px', padding: '0.1rem 0.6rem', flex: 1, minWidth: 0,
                    border: '1px solid rgba(139,92,246,0.2)' }}>
        <input type="text" value={row.fileName}
          onChange={e => updateRow(row.id, 'fileName', e.target.value)}
          disabled={!hasEditAccess}
          style={{ background: 'transparent', border: 'none', outline: 'none',
                   fontSize: '0.85rem', color: 'var(--accent)', flex: 1, fontWeight: 500,
                   width: '100%', padding: '0.2rem 0', textOverflow: 'ellipsis' }} />
        {hasEditAccess && (
          <button onClick={() => { updateRow(row.id, 'links', ''); updateRow(row.id, 'fileName', ''); updateRow(row.id, 'fileType', ''); }}
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                     padding: '0 0 0 0.5rem', opacity: 0.7, fontSize: '1rem' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            title="Remover">×</button>
        )}
      </div>
    );

    // 4. Empty → show input with placeholder
    return (
      <input type="text" className="cell-input" value={row.links}
        placeholder="https://... o subir archivo"
        disabled={!hasEditAccess}
        onChange={e => updateRow(row.id, 'links', e.target.value)}
        onPaste={e => {
          if (!hasEditAccess) return;
          const text = e.clipboardData.getData('text');
          if (!text.startsWith('http')) return;
          try {
            const url = new URL(text);
            let name = '';
            if (isGoogleDriveUrl(text)) {
              // Don't set name yet — DriveLink will fetch the real title
              e.preventDefault();
              updateRow(row.id, 'links', text);
              updateRow(row.id, 'fileType', 'link');
              return;
            } else if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
              name = 'Video de YouTube';
            } else {
              const segs = url.pathname.split('/').filter(Boolean);
              name = segs.length > 0 ? decodeURIComponent(segs[segs.length - 1]) : url.hostname;
            }
            e.preventDefault();
            updateRow(row.id, 'links', text);
            updateRow(row.id, 'fileName', name);
            updateRow(row.id, 'fileType', 'link');
          } catch { /* fallback: normal paste */ }
        }}
        title={row.links}
      />
    );
  };

  return (
    <div className="table-wrapper glass-panel">
      <div className="table-responsive">
        <table className="content-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>NRO</th>
              <th style={{ width: '40%' }}>Descripción del contenido</th>
              <th style={{ width: '15%' }}>Formato de salida</th>
              <th style={{ width: '25%' }}>Links del contenido</th>
              <th style={{ width: '10%' }}>ESTADO</th>
              <th style={{ width: '5%' }}></th>
            </tr>
          </thead>
          <tbody>
            {materias.map((materiaName, materiaIndex) => {
              const materiaRows = rows.filter(r => r.materia === materiaName);
              const modulos = Array.from(new Set(materiaRows.map(r => r.modulo)));
              const isMateriaCollapsed = collapsedMaterias.has(materiaName);

              return (
                <React.Fragment key={`materia-${materiaIndex}`}>
                  {/* ── MATERIA HEADER (Level 1) ─────────────────── */}
                  <tr className="module-header-row"
                    style={{ background: 'rgba(79, 70, 229, 0.12)' }}>
                    <td colSpan={6} style={{ padding: '0.9rem 1rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                          <button
                            onClick={() => toggleMateria(materiaName)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary)', display: 'flex' }}
                          >
                            {isMateriaCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                          </button>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>MATERIA:</span>
                          <input type="text" value={materiaName}
                            placeholder="Sin materia"
                            disabled={!hasEditAccess}
                            onChange={e => updateMateria(materiaName, e.target.value)}
                            style={{ background: 'transparent', border: '1px solid transparent', fontWeight: 'bold',
                                     fontSize: '1.1rem', outline: 'none', flex: 1, padding: '0.2rem 0.5rem',
                                     borderRadius: '4px', color: 'var(--text)' }}
                            onFocus={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--border)'; }}
                            onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }} />
                        </div>
                        {hasEditAccess && (
                          <button className="btn btn-sm btn-secondary" onClick={() => addRow(materiaName, `Clase ${modulos.length + 1}`)}
                            title="Agregar clase"
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                            <Plus size={14} /> Añadir clase
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ── CLASES within this materia ──────────────── */}
                  {!isMateriaCollapsed && modulos.map((modName, modIndex) => {
                    const modRows = materiaRows.filter(r => r.modulo === modName);
                    const moduloKey = `${materiaIndex}::${modIndex}`;
                    const isModuloCollapsed = collapsedModulos.has(`${materiaName}::${modName}`);

                    return (
                      <React.Fragment key={moduloKey}>
                        {/* ── CLASE HEADER (Level 2) ──────────── */}
                        <tr className="module-header-row"
                          style={{ background: 'rgba(139, 92, 246, 0.06)' }}
                          onDragOver={handleDragOver}
                          onDrop={e => handleDropOnModule(e, modName)}>
                          <td colSpan={6} style={{ padding: '0.65rem 1rem 0.65rem 2.5rem', borderBottom: '1px solid rgba(139, 92, 246, 0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                <button
                                  onClick={() => toggleModulo(`${materiaName}::${modName}`)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--accent)', display: 'flex' }}
                                >
                                  {isModuloCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                </button>
                                <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLASE:</span>
                                <input type="text" value={modName}
                                  placeholder="Sin clase"
                                  disabled={!hasEditAccess}
                                  onChange={e => updateModule(modName, e.target.value)}
                                  style={{ background: 'transparent', border: '1px solid transparent', fontWeight: 'bold',
                                           fontSize: '1rem', outline: 'none', flex: 1, padding: '0.2rem 0.5rem',
                                           borderRadius: '4px', color: 'var(--text)' }}
                                  onFocus={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--border)'; }}
                                  onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }} />
                              </div>
                              {hasEditAccess && (
                                <button className="btn btn-sm btn-secondary" onClick={() => addRow(materiaName, modName)}
                                  style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}>
                                  <Plus size={13} /> Añadir contenido
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ── CONTENT ROWS (Level 3) ───────────── */}
                        {!isModuloCollapsed && modRows.map(row => (
                          <tr key={row.id}
                            draggable={hasEditAccess && draggableRowId === row.id}
                            onDragStart={e => handleDragStart(e, row.id)}
                            onDragOver={handleDragOver}
                            onDrop={e => handleDropOnRow(e, row.id)}
                            onDragEnd={() => { setDraggedId(null); setDraggableRowId(null); }}
                            style={{ opacity: draggedId === row.id ? 0.5 : 1, transition: 'opacity 0.2s',
                                     background: draggedId === row.id ? 'var(--surface)' : 'transparent' }}>
                            {/* NRO */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '1.5rem' }}>
                                {hasEditAccess && (
                                  <div onMouseEnter={() => setDraggableRowId(row.id)} onMouseLeave={() => setDraggableRowId(null)}
                                    style={{ display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                                    <GripVertical size={16} style={{ color: '#94a3b8', cursor: 'grab', flexShrink: 0 }} />
                                  </div>
                                )}
                                <input type="text" className="cell-input" value={row.nro}
                                  disabled={!hasEditAccess}
                                  onChange={e => updateRow(row.id, 'nro', e.target.value)}
                                  style={{ width: '100%' }} />
                              </div>
                            </td>
                            {/* Descripción */}
                            <td>
                              <input type="text" className="cell-input" value={row.descripcion}
                                placeholder="Descripción del contenido..."
                                disabled={!hasEditAccess}
                                onChange={e => updateRow(row.id, 'descripcion', e.target.value)} />
                            </td>
                            {/* Formato */}
                            <td>
                              <select className="cell-select" value={row.formato}
                                disabled={!hasEditAccess}
                                onChange={e => updateRow(row.id, 'formato', e.target.value)}>
                                {formatOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </td>
                            {/* Links */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {renderLinksCell(row)}

                                {/* Upload button (hidden when Google Drive link active) */}
                                {hasEditAccess && !isGoogleDriveUrl(row.links) && (
                                  <button className="icon-btn"
                                    style={{ padding: '0.3rem', color: 'var(--accent)', flexShrink: 0 }}
                                    onClick={() => triggerUpload(row.id)}
                                    title="Subir Archivo (.doc, .pdf, .mp4)">
                                    <Upload size={14} />
                                  </button>
                                )}

                                {/* Google Drive Picker button */}
                                {hasEditAccess && googleLoaded && (
                                  <button className="icon-btn"
                                    style={{ padding: '0.3rem', color: '#34a853', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={() => handleGoogleDrivePick(row.id)}
                                    title="Importar desde Google Drive">
                                    <svg viewBox="0 0 360 322" width="14" height="14" style={{ flexShrink: 0 }}>
                                      <path fill="#34A853" d="M117 220 L30 322 L243 322 L330 220 Z"/>
                                      <path fill="#4285F4" d="M180 0 L117 220 L330 220 L270 0 Z"/>
                                      <path fill="#FBBC05" d="M180 0 L30 322 L117 220 L240 0 Z"/>
                                    </svg>
                                  </button>
                                )}

                                {/* External link button for non-drive, non-file links */}
                                {row.links && !isGoogleDriveUrl(row.links) && (
                                  <a href={row.links} target="_blank" rel="noopener noreferrer"
                                    title={row.fileName ? 'Ver Archivo' : 'Abrir enlace'}
                                    style={{ display: 'flex', alignItems: 'center', padding: '0.3rem',
                                             borderRadius: '6px', color: 'var(--accent)',
                                             background: 'rgba(139,92,246,0.12)', transition: 'background 0.2s', flexShrink: 0 }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.28)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}>
                                    {row.fileName && row.fileType !== 'link' ? <Eye size={14} /> : <ExternalLink size={14} />}
                                  </a>
                                )}
                              </div>
                            </td>
                            {/* Estado */}
                            <td>
                              <div className="status-select-wrapper">
                                <div className="status-indicator" style={{ backgroundColor: getStatusColor(row.estado) }} />
                                <select className="cell-select status-select" value={row.estado}
                                  disabled={!hasEditAccess}
                                  style={{ color: getStatusColor(row.estado) }}
                                  onChange={e => updateRow(row.id, 'estado', e.target.value)}>
                                  {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.value}</option>)}
                                </select>
                              </div>
                            </td>
                            {/* Acciones */}
                            <td className="actions-cell" style={{ borderBottom: 'none', verticalAlign: 'middle', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                <button 
                                  className="icon-btn" 
                                  style={{ color: getTaskIconColor(row.id), padding: '4px', cursor: 'pointer' }} 
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
                                {hasDeleteAccess && (
                                  <button 
                                    className="icon-btn danger" 
                                    style={{ padding: '4px', cursor: 'pointer' }} 
                                    onClick={() => removeRow(row.id)}
                                    title="Eliminar contenido"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="table-footer" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => addRow(`Materia ${materias.length + 1}`, 'Clase 1')}>
          <Plus size={16} /> Añadir Materia
        </button>
        {googleLoaded && rows.some(r => r.googleFileId) && (
          <button className="btn btn-secondary" onClick={handleCheckUpdates} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={16} /> Verificar actualizaciones de Drive
          </button>
        )}
      </div>

      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload}
        accept=".pdf,.doc,.docx,.mp4,video/mp4,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />

      {historyRow && (
        <HistoryDrawer
          rowId={historyRow.id}
          courseId={courseId}
          rowLabel={historyRow.label}
          panel={1}
          onRestored={() => {}}
          onClose={() => setHistoryRow(null)}
        />
      )}
    </div>
  );
};

export default ContentTable;
