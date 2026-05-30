import { Plus, Trash2, ExternalLink, Upload, Pencil, GripVertical, Loader2, ClipboardList, ChevronDown, ChevronRight, Clock, Eye, EyeOff } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CourseRow, User, Task } from '../types';
import { filesApi } from '../services/api';
import { HistoryDrawer } from './HistoryDrawer';
import { useDialog } from './CustomDialog';

interface ContentTableProps {
  rows: CourseRow[];
  tasks?: Task[];
  courseId: string;
  addRow: (materia?: string, modulo?: string) => void;
  updateRow: (id: string, field: keyof CourseRow | Partial<CourseRow>, value?: string) => void;
  removeRow: (id: string) => void;
  updateModule: (oldName: string, newName: string) => void;
  updateModuloNumero?: (moduloName: string, numero: string) => void;
  updateMateria: (oldName: string, newName: string) => void;
  moveRow: (draggedId: string, targetId: string | null, targetModule?: string) => void;
  moveModule?: (sourceMateria: string, sourceModule: string, targetMateria: string, targetModule: string | null) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
  user: User;
}
const formatOptions = ['VIDEO', 'TEXTO', 'CUESTIONARIO', 'GENIALLY', 'PDF', 'FLIP', 'OTRO'];


const configEstados = [
  { value: '1-NO EMPEZADO', label: 'Pendiente', color: '#ffb300', glow: 'rgba(255, 179, 0, 0.4)' },
  { value: '2-EN PROCESO', label: 'En Proceso', color: '#ff6f00', glow: 'rgba(255, 111, 0, 0.4)' },
  { value: '3-CORREGIR', label: 'Corregir', color: '#e53935', glow: 'rgba(229, 57, 53, 0.4)' },
  { value: '4-DISPONIBLE', label: 'Disponible', color: '#00c853', glow: 'rgba(0, 200, 83, 0.4)' }
];

// ── Utilities ──────────────────────────────────────────────────────────────
const renderMateriaProgress = (materiaRows: CourseRow[]) => {
  const total = materiaRows.length;
  if (total === 0) return null;

  const countPending = materiaRows.filter(r => r.estado === '1-NO EMPEZADO').length;
  const countInProgress = materiaRows.filter(r => r.estado === '2-EN PROCESO').length;
  const countCorrection = materiaRows.filter(r => r.estado === '3-CORREGIR').length;
  const countAvailable = materiaRows.filter(r => r.estado === '4-DISPONIBLE').length;

  const pctPending = (countPending / total) * 100;
  const pctInProgress = (countInProgress / total) * 100;
  const pctCorrection = (countCorrection / total) * 100;
  const pctAvailable = (countAvailable / total) * 100;
  

  return (
    <div 
      style={{
        position: 'relative',
        height: '10px',
        width: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '5px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
        minWidth: '110px'
      }} 
      title={`Disponible: ${Math.round(pctAvailable)}% | En Proceso: ${Math.round(pctInProgress)}% | Corregir: ${Math.round(pctCorrection)}% | Pendiente: ${Math.round(pctPending)}%`}
    >
      {/* Segmento Pendiente */}
      {pctPending > 0 && (
        <div 
          title={`Pendiente: ${Math.round(pctPending)}%`}
          style={{
            height: '100%',
            width: `${pctPending}%`,
            backgroundColor: '#ffb300',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento En Proceso */}
      {pctInProgress > 0 && (
        <div 
          title={`En Proceso: ${Math.round(pctInProgress)}%`}
          style={{
            height: '100%',
            width: `${pctInProgress}%`,
            backgroundColor: '#ff6f00',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Corregir */}
      {pctCorrection > 0 && (
        <div 
          title={`Corregir: ${Math.round(pctCorrection)}%`}
          style={{
            height: '100%',
            width: `${pctCorrection}%`,
            backgroundColor: '#e53935',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Disponible */}
      {pctAvailable > 0 && (
        <div 
          title={`Disponible: ${Math.round(pctAvailable)}%`}
          style={{
            height: '100%',
            width: `${pctAvailable}%`,
            backgroundColor: '#00c853',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}

    </div>
  );
};

const renderModuloProgress = (moduloRows: CourseRow[]) => {
  const total = moduloRows.length;
  if (total === 0) return null;

  const countPending = moduloRows.filter(r => r.estado === '1-NO EMPEZADO').length;
  const countInProgress = moduloRows.filter(r => r.estado === '2-EN PROCESO').length;
  const countCorrection = moduloRows.filter(r => r.estado === '3-CORREGIR').length;
  const countAvailable = moduloRows.filter(r => r.estado === '4-DISPONIBLE').length;

  const pctPending = (countPending / total) * 100;
  const pctInProgress = (countInProgress / total) * 100;
  const pctCorrection = (countCorrection / total) * 100;
  const pctAvailable = (countAvailable / total) * 100;

  return (
    <div 
      style={{
        position: 'relative',
        height: '6px',
        width: '60px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '3px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
        flexShrink: 0
      }} 
      title={`Disponible: ${Math.round(pctAvailable)}% | En Proceso: ${Math.round(pctInProgress)}% | Corregir: ${Math.round(pctCorrection)}% | Pendiente: ${Math.round(pctPending)}%`}
    >
      {/* Segmento Pendiente */}
      {pctPending > 0 && (
        <div 
          style={{
            height: '100%',
            width: `${pctPending}%`,
            backgroundColor: '#ffb300',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento En Proceso */}
      {pctInProgress > 0 && (
        <div 
          style={{
            height: '100%',
            width: `${pctInProgress}%`,
            backgroundColor: '#ff6f00',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Corregir */}
      {pctCorrection > 0 && (
        <div 
          style={{
            height: '100%',
            width: `${pctCorrection}%`,
            backgroundColor: '#e53935',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
      {/* Segmento Disponible */}
      {pctAvailable > 0 && (
        <div 
          style={{
            height: '100%',
            width: `${pctAvailable}%`,
            backgroundColor: '#00c853',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      )}
    </div>
  );
};

const isGoogleDriveUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return ['drive.google.com', 'docs.google.com', 'sheets.google.com',
            'slides.google.com', 'forms.google.com'].includes(hostname);
  } catch { return false; }
};

const getExternalEditUrl = (row: CourseRow): string => {
  if (row.googleFileId) {
    const isPdf = (row.links && row.links.toLowerCase().endsWith('.pdf')) || row.fileType === 'application/pdf';
    if (isPdf) {
      return `https://drive.google.com/file/d/${row.googleFileId}/view`;
    }
    return `https://docs.google.com/document/d/${row.googleFileId}/edit`;
  }
  if (row.links && isGoogleDriveUrl(row.links)) {
    return row.links;
  }
  return row.links || '';
};

const extractGoogleFileId = (url: string): string | null => {
  if (!url) return null;
  try {
    const dMatch = url.match(/\/d\/([^/]+)/);
    if (dMatch) return dMatch[1];
    const idMatch = url.match(/[?&]id=([^&]+)/);
    if (idMatch) return idMatch[1];
    return null;
  } catch {
    return null;
  }
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
  onEdit?: () => void;
  onPreview?: () => void;
  disabled?: boolean;
}

const DriveLink: React.FC<DriveLinkProps> = ({ url, storedTitle, rowId, onTitleFetched, onClear, onEdit, onPreview, disabled }) => {
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
      {onPreview && (
        <button
          onClick={onPreview}
          title="Previsualizar documento"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                   padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
        >
          <Eye size={13} />
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          title="Editar documento"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                   padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
        >
          <Pencil size={13} />
        </button>
      )}
      {clearBtn}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const ContentTable: React.FC<ContentTableProps> = ({ rows, tasks = [], courseId, addRow, updateRow, removeRow, updateModule, updateModuloNumero, updateMateria, moveRow, moveModule, onAddRowTask, user }) => {
  const { showAlert, DialogRenderer } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyRow, setHistoryRow] = useState<{ id: string; label: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CourseRow | null>(null);

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
          if (res.status === 401) {
            setAccessToken(null);
            sessionStorage.removeItem('google_access_token');
          }
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
      showAlert('Configuración faltante', 'Por favor, configura VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY en tu archivo .env para usar Google Drive.', 'warning');
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
        showAlert('Error', 'Error al abrir el selector de Google Drive.', 'danger');
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
        showAlert('Error de conexión', 'Error de conexión con Google Identity Services.', 'danger');
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
      showAlert('Error al importar', err instanceof Error ? err.message : 'Error al importar el archivo de Google Drive', 'danger');
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
      showAlert('Error al sincronizar', err instanceof Error ? err.message : 'Error al sincronizar', 'danger');
    } finally {
      setIsUploading(prev => ({ ...prev, [rowId]: false }));
    }
  };

  const handleCheckUpdates = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

    if (!clientId || !apiKey) {
      showAlert('Configuración faltante', 'Por favor, configura VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY en tu archivo .env.', 'warning');
      return;
    }

    const runCheck = (token: string) => {
      setFileStatuses({});
      const driveRows = rows.filter(r => r.googleFileId);
      if (driveRows.length === 0) {
        showAlert('Sin archivos', 'No hay archivos de Google Drive importados en este curso.', 'info');
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
              if (res.status === 401) {
                setAccessToken(null);
                sessionStorage.removeItem('google_access_token');
              }
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
          showAlert('Verificación completa', 'Verificación de archivos completada.', 'success');
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
        showAlert('Error de conexión', 'Error de conexión con Google Identity Services.', 'danger');
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

  const [draggedModule, setDraggedModule] = useState<{ materia: string; modulo: string } | null>(null);
  const [draggableModuleKey, setDraggableModuleKey] = useState<string | null>(null);

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

  const handleModuleDragStart = (e: React.DragEvent, materia: string, modulo: string) => {
    setDraggedModule({ materia, modulo });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `module:${materia}::${modulo}`);
  };

  const handleModuleDragEnd = () => {
    setDraggedModule(null);
    setDraggableModuleKey(null);
  };

  const handleModuleDrop = (e: React.DragEvent, targetMateria: string, targetModule: string) => {
    e.preventDefault();
    if (draggedModule) {
      if (moveModule) {
        moveModule(draggedModule.materia, draggedModule.modulo, targetMateria, targetModule);
      }
      setDraggedModule(null);
      setDraggableModuleKey(null);
    } else if (draggedId) {
      handleDropOnModule(e, targetModule);
    }
  };

  const handleMateriaDrop = (e: React.DragEvent, targetMateria: string) => {
    e.preventDefault();
    if (draggedModule) {
      if (moveModule) {
        moveModule(draggedModule.materia, draggedModule.modulo, targetMateria, null);
      }
      setDraggedModule(null);
      setDraggableModuleKey(null);
    }
  };


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
        showAlert('Error al subir', err instanceof Error ? err.message : 'Error al subir el archivo', 'danger');
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
            
            {row.links && (
              <>
                <button onClick={() => setPreviewDoc(row)}
                  title="Previsualizar archivo"
                  style={{ background: 'none', border: 'none', color: row.googleFileId ? '#2e7d32' : 'var(--accent)', cursor: 'pointer',
                           padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
                  <Eye size={13} />
                </button>
                <button onClick={() => window.open(getExternalEditUrl(row), '_blank', 'noopener,noreferrer')}
                  title="Editar archivo"
                  style={{ background: 'none', border: 'none', color: row.googleFileId ? '#2e7d32' : 'var(--accent)', cursor: 'pointer',
                           padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
                  <Pencil size={13} />
                </button>
              </>
            )}
            
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
        onEdit={() => window.open(getExternalEditUrl(row), '_blank', 'noopener,noreferrer')}
        onPreview={() => setPreviewDoc(row)}
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
        {row.links && (
          <>
            <button onClick={() => setPreviewDoc(row)}
              title="Previsualizar enlace"
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                       padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
              <Eye size={13} />
            </button>
            <button onClick={() => window.open(getExternalEditUrl(row), '_blank', 'noopener,noreferrer')}
              title="Editar enlace"
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                       padding: '0 0.2rem', display: 'flex', alignItems: 'center', opacity: 0.8 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
              <Pencil size={13} />
            </button>
          </>
        )}
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
    <div className="table-wrapper glass-panel" style={{ '--sticky-header-height': '53px' } as React.CSSProperties}>
      <div className="table-responsive">
        <table className="content-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>NRO</th>
              <th style={{ width: '38%' }}>Descripción del contenido</th>
              <th style={{ width: '12%' }}>Formato de salida</th>
              <th style={{ width: '25%' }}>Links del contenido</th>
              <th style={{ width: '15%' }}>ESTADO</th>
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
                  <tr className="module-header-row materia-header-row"
                    style={{ background: 'rgba(79, 70, 229, 0.12)' }}
                    onDragOver={handleDragOver}
                    onDrop={e => handleMateriaDrop(e, materiaName)}>
                    <td colSpan={4} style={{ padding: '0.9rem 1rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)', verticalAlign: 'middle' }}>
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
                    </td>
                    <td style={{ padding: '0.9rem 1.2rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)', verticalAlign: 'middle' }}>
                      {renderMateriaProgress(materiaRows)}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)', textAlign: 'right', verticalAlign: 'middle' }}>
                      {hasEditAccess && (
                        <button className="btn btn-sm btn-secondary" onClick={() => addRow(materiaName, `Clase ${modulos.length + 1}`)}
                          title="Agregar clase"
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          <Plus size={14} /> Añadir clase
                        </button>
                      )}
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
                        {/* ── CLASE HEADER (Level 2) ──────────── */}
                        <tr className="module-header-row clase-header-row"
                          draggable={hasEditAccess && draggableModuleKey === `${materiaName}::${modName}`}
                          onDragStart={e => handleModuleDragStart(e, materiaName, modName)}
                          onDragEnd={handleModuleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={e => handleModuleDrop(e, materiaName, modName)}
                          style={{
                            background: 'rgba(139, 92, 246, 0.06)',
                            opacity: draggedModule && draggedModule.materia === materiaName && draggedModule.modulo === modName ? 0.4 : 1,
                            transition: 'opacity 0.2s',
                          }}>
                          <td colSpan={6} style={{ padding: '0.65rem 1rem 0.65rem 2.5rem', borderBottom: '1px solid rgba(139, 92, 246, 0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                {hasEditAccess && (
                                  <div
                                    onMouseEnter={() => setDraggableModuleKey(`${materiaName}::${modName}`)}
                                    onMouseLeave={() => setDraggableModuleKey(null)}
                                    style={{ display: 'flex', alignItems: 'center', padding: '0.2rem', marginRight: '2px' }}
                                  >
                                    <GripVertical size={16} style={{ color: '#94a3b8', cursor: 'grab', flexShrink: 0 }} />
                                  </div>
                                )}
                                <button
                                  onClick={() => toggleModulo(`${materiaName}::${modName}`)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--accent)', display: 'flex' }}
                                >
                                  {isModuloCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                </button>
                                <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLASE:</span>
                                {/* Campo # Número de clase */}
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                  <span style={{
                                    position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)',
                                    color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none', lineHeight: 1
                                  }}>#</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    title="Clase número"
                                    value={modRows[0]?.moduloNumero ?? ''}
                                    disabled={!hasEditAccess}
                                    placeholder="—"
                                    onChange={e => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      updateModuloNumero?.(modName, val);
                                    }}
                                    style={{
                                      width: '48px', paddingLeft: '18px', paddingRight: '4px',
                                      background: 'transparent', border: '1px solid transparent',
                                      fontWeight: 700, fontSize: '0.95rem', outline: 'none',
                                      borderRadius: '4px', color: 'var(--accent)', textAlign: 'center',
                                      cursor: hasEditAccess ? 'text' : 'default',
                                    }}
                                    onFocus={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--border)'; }}
                                    onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
                                  />
                                </div>
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {renderModuloProgress(modRows)}
                                {hasEditAccess && (
                                  <button className="btn btn-sm btn-secondary" onClick={() => addRow(materiaName, modName)}
                                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}>
                                    <Plus size={13} /> Añadir contenido
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* ── CONTENT ROWS (Level 3) ───────────── */}
                        {!isModuloCollapsed && modRows.map(row => {
                          const isRowOfDraggedModule = draggedModule && draggedModule.materia === materiaName && draggedModule.modulo === modName;
                          return (
                            <tr key={row.id}
                              draggable={hasEditAccess && draggableRowId === row.id}
                              onDragStart={e => handleDragStart(e, row.id)}
                              onDragOver={handleDragOver}
                              onDrop={e => handleDropOnRow(e, row.id)}
                              onDragEnd={() => { setDraggedId(null); setDraggableRowId(null); }}
                              style={{ opacity: (draggedId === row.id || isRowOfDraggedModule) ? 0.5 : 1, transition: 'opacity 0.2s',
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
                                  row.fileName && row.fileType !== 'link' ? (
                                    <button
                                      onClick={() => window.open(getExternalEditUrl(row), '_blank', 'noopener,noreferrer')}
                                      title="Editar archivo"
                                      style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', border: 'none', cursor: 'pointer',
                                               borderRadius: '6px', color: 'var(--accent)',
                                               background: 'rgba(139,92,246,0.12)', transition: 'background 0.2s', flexShrink: 0 }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.28)')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}>
                                      <Pencil size={14} />
                                    </button>
                                  ) : (
                                    <a href={row.links} target="_blank" rel="noopener noreferrer"
                                      title="Abrir enlace"
                                      style={{ display: 'flex', alignItems: 'center', padding: '0.3rem',
                                               borderRadius: '6px', color: 'var(--accent)',
                                               background: 'rgba(139,92,246,0.12)', transition: 'background 0.2s', flexShrink: 0 }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.28)')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}>
                                      <ExternalLink size={14} />
                                    </a>
                                  )
                                )}
                              </div>
                            </td>
                            {/* Estado */}
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  background: 'rgba(0, 0, 0, 0.3)',
                                  padding: '5px 10px',
                                  borderRadius: '20px',
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  justifyContent: 'center'
                                }}>
                                  {configEstados.map(estado => {
                                    const esActivo = row.estado === estado.value;
                                    return (
                                      <button
                                        key={estado.value}
                                        onClick={() => hasEditAccess && updateRow(row.id, 'estado', estado.value)}
                                        disabled={!hasEditAccess}
                                        title={estado.label}
                                        style={{
                                          width: esActivo ? '15px' : '10px',
                                          height: esActivo ? '15px' : '10px',
                                          borderRadius: '50%',
                                          backgroundColor: estado.color,
                                          border: 'none',
                                          padding: 0,
                                          cursor: hasEditAccess ? 'pointer' : 'default',
                                          opacity: esActivo ? 1.0 : 0.25,
                                          transform: esActivo ? 'scale(1.1)' : 'scale(1)',
                                          boxShadow: esActivo ? `0 0 10px ${estado.glow}` : 'none',
                                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                          flexShrink: 0
                                        }}
                                      />
                                    );
                                  })}
                                </div>
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
                        );
                        })}
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

      {previewDoc && (
        <DocumentPreviewModal
          row={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
      {DialogRenderer}
    </div>
  );
};

interface DocumentPreviewModalProps {
  row: CourseRow;
  onClose: () => void;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ row, onClose }) => {
  const isDrive = isGoogleDriveUrl(row.links || '');
  const fileId = row.googleFileId || (row.links ? extractGoogleFileId(row.links) : null);
  
  let contentNode = null;

  if (isDrive && fileId) {
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    contentNode = (
      <iframe
        src={previewUrl}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
        allow="autoplay"
        title="Previsualización de Google Drive"
      />
    );
  } else if (row.htmlContent) {
    contentNode = (
      <div 
        style={{ 
          width: '100%', 
          height: '100%', 
          overflowY: 'auto', 
          background: 'rgba(0, 0, 0, 0.4)', 
          padding: '2rem 1rem', 
          display: 'flex', 
          justifyContent: 'center' 
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .word-preview-page img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            margin: 1.5rem 0;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
          }
          .word-preview-page table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
            font-size: 0.9rem;
          }
          .word-preview-page th, .word-preview-page td {
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 12px;
            text-align: left;
          }
          .word-preview-page th {
            background: rgba(255, 255, 255, 0.05);
          }
        ` }} />
        <div 
          className="word-preview-page"
          style={{
            background: '#ffffff',
            color: '#333333',
            width: '100%',
            maxWidth: '800px',
            minHeight: '100%',
            padding: '3rem 4rem',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            boxSizing: 'border-box',
            fontFamily: 'Georgia, serif',
            lineHeight: 1.6,
            fontSize: '1.05rem',
            overflowX: 'hidden'
          }}
          dangerouslySetInnerHTML={{ __html: row.htmlContent }}
        />
      </div>
    );
  } else if (row.links && row.links.includes('res.cloudinary.com') && row.links.includes('/raw/upload/')) {
    contentNode = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <ClipboardList size={48} style={{ color: 'var(--primary)' }} />
        <h4 style={{ color: 'var(--text-main)', margin: 0 }}>Archivo de Servidor Multimedia</h4>
        <p style={{ maxWidth: '400px', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Este archivo ({row.fileName || 'documento'}) está almacenado en el servidor multimedia de forma segura. Para visualizarlo o descargarlo, haz clic en el botón <strong>"Abrir Externo"</strong> en la esquina superior derecha.
        </p>
      </div>
    );
  } else if (row.links && (row.links.endsWith('.pdf') || row.fileType === 'application/pdf')) {
    contentNode = (
      <iframe
        src={row.links}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
        title="Previsualización de PDF"
      />
    );
  } else if (row.links && (row.links.endsWith('.docx') || row.links.endsWith('.doc'))) {
    const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(row.links)}&embedded=true`;
    contentNode = (
      <iframe
        src={googleViewerUrl}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
        title="Previsualización de Word"
      />
    );
  } else {
    contentNode = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem' }}>
        <EyeOff size={48} />
        <span>No hay previsualización disponible para este tipo de archivo.</span>
        {row.links && (
          <a href={row.links} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
            Abrir archivo en pestaña nueva
          </a>
        )}
      </div>
    );
  }

  return createPortal(
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
    >
      {/* Floating Close Button */}
      <button 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 100000,
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#ffffff',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          transition: 'all 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        ×
      </button>

      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1200px',
          height: '85vh',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Previsualización de Documento
            </span>
            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.fileName || 'Documento sin título'}
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {row.links && (
              <a 
                href={getExternalEditUrl(row)} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  color: '#ffffff',
                  textDecoration: 'none',
                  background: 'rgba(20, 184, 166, 0.15)',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(20, 184, 166, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(20, 184, 166, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.3)';
                }}
              >
                <ExternalLink size={14} />
                Abrir Externo
              </a>
            )}
            <button 
              onClick={onClose}
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                border: 'none', 
                color: 'var(--text-main)', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div style={{ flex: 1, minHeight: 0, background: 'rgba(0, 0, 0, 0.2)' }}>
          {contentNode}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ContentTable;
