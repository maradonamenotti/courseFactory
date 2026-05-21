import { Plus, Trash2, ExternalLink, Upload, Eye, GripVertical, Loader2, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';
import type { CourseRow } from '../types';

interface ContentTableProps {
  rows: CourseRow[];
  addRow: (materia?: string, modulo?: string) => void;
  updateRow: (id: string, field: keyof CourseRow, value: string) => void;
  removeRow: (id: string) => void;
  updateModule: (oldName: string, newName: string) => void;
  updateMateria: (oldName: string, newName: string) => void;
  moveRow: (draggedId: string, targetId: string | null, targetModule?: string) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
}

const formatOptions = ['VIDEO', 'TEXTO', 'CUESTIONARIO', 'GENIALLY', 'PDF', 'OTRO'];
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
}

const DriveLink: React.FC<DriveLinkProps> = ({ url, storedTitle, rowId, onTitleFetched, onClear }) => {
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

  const clearBtn = (
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
const ContentTable: React.FC<ContentTableProps> = ({ rows, addRow, updateRow, removeRow, updateModule, updateMateria, moveRow, onAddRowTask }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggableRowId, setDraggableRowId] = useState<string | null>(null);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeUploadId) {
      updateRow(activeUploadId, 'links', URL.createObjectURL(file));
      updateRow(activeUploadId, 'fileName', file.name);
      updateRow(activeUploadId, 'fileType', file.type);
    }
    e.target.value = '';
    setActiveUploadId(null);
  };

  const triggerUpload = (id: string) => { setActiveUploadId(id); fileInputRef.current?.click(); };

  // Build 3-level hierarchy: Materia → Módulo → Rows
  const materias = Array.from(new Set(rows.map(r => r.materia || 'Sin materia')));

  // Helper to decide which cell to render for the links column
  const renderLinksCell = (row: CourseRow) => {
    const isFile = row.fileName && row.fileType && row.fileType !== 'link';
    const isDriveLink = row.links && isGoogleDriveUrl(row.links);

    // 1. Uploaded local file
    if (isFile) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0,
                    background: 'rgba(139,92,246,0.1)', borderRadius: '6px',
                    padding: '0.1rem 0.6rem', border: '1px solid rgba(139,92,246,0.2)' }}>
        <input type="text" value={row.fileName}
          onChange={e => updateRow(row.id, 'fileName', e.target.value)}
          style={{ background: 'transparent', border: 'none', outline: 'none',
                   fontSize: '0.85rem', color: 'var(--accent)', flex: 1, fontWeight: 500,
                   width: '100%', padding: '0.2rem 0', textOverflow: 'ellipsis' }}
          title="Haz clic para editar el nombre" />
        <button onClick={() => { updateRow(row.id, 'links', ''); updateRow(row.id, 'fileName', ''); updateRow(row.id, 'fileType', ''); }}
          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                   padding: '0 0 0 0.5rem', opacity: 0.7, fontSize: '1rem', lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
          title="Remover">×</button>
      </div>
    );

    // 2. Google Drive / Docs link → show DriveLink with fetched title
    if (isDriveLink) return (
      <DriveLink
        url={row.links}
        storedTitle={row.fileName && row.fileType === 'link' ? row.fileName : ''}
        rowId={row.id}
        onTitleFetched={(id, t) => { updateRow(id, 'fileName', t); updateRow(id, 'fileType', 'link'); }}
        onClear={() => { updateRow(row.id, 'links', ''); updateRow(row.id, 'fileName', ''); updateRow(row.id, 'fileType', ''); }}
      />
    );

    // 3. Other pasted link with a display name
    if (row.fileName && row.fileType === 'link') return (
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(139,92,246,0.1)',
                    borderRadius: '6px', padding: '0.1rem 0.6rem', flex: 1, minWidth: 0,
                    border: '1px solid rgba(139,92,246,0.2)' }}>
        <input type="text" value={row.fileName}
          onChange={e => updateRow(row.id, 'fileName', e.target.value)}
          style={{ background: 'transparent', border: 'none', outline: 'none',
                   fontSize: '0.85rem', color: 'var(--accent)', flex: 1, fontWeight: 500,
                   width: '100%', padding: '0.2rem 0', textOverflow: 'ellipsis' }} />
        <button onClick={() => { updateRow(row.id, 'links', ''); updateRow(row.id, 'fileName', ''); updateRow(row.id, 'fileType', ''); }}
          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                   padding: '0 0 0 0.5rem', opacity: 0.7, fontSize: '1rem' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          title="Remover">×</button>
      </div>
    );

    // 4. Empty → show input with placeholder
    return (
      <input type="text" className="cell-input" value={row.links}
        placeholder="https://... o subir archivo"
        onChange={e => updateRow(row.id, 'links', e.target.value)}
        onPaste={e => {
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
              const materiaRows = rows.filter(r => (r.materia || 'Sin materia') === materiaName);
              const modulos = Array.from(new Set(materiaRows.map(r => r.modulo || 'Sin módulo')));
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
                            onChange={e => updateMateria(materiaName, e.target.value)}
                            style={{ background: 'transparent', border: '1px solid transparent', fontWeight: 'bold',
                                     fontSize: '1.1rem', outline: 'none', flex: 1, padding: '0.2rem 0.5rem',
                                     borderRadius: '4px', color: 'var(--text)' }}
                            onFocus={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--border)'; }}
                            onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }} />
                        </div>
                        <button className="btn btn-sm btn-secondary" onClick={() => addRow(materiaName, `Módulo ${modulos.length + 1}`)}
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                          <Plus size={14} /> Añadir módulo
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* ── MÓDULOS within this materia ──────────────── */}
                  {!isMateriaCollapsed && modulos.map((modName, modIndex) => {
                    const modRows = materiaRows.filter(r => (r.modulo || 'Sin módulo') === modName);
                    const moduloKey = `${materiaIndex}::${modIndex}`;
                    const isModuloCollapsed = collapsedModulos.has(`${materiaName}::${modName}`);

                    return (
                      <React.Fragment key={moduloKey}>
                        {/* ── MÓDULO HEADER (Level 2) ──────────── */}
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
                                <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MÓDULO:</span>
                                <input type="text" value={modName}
                                  onChange={e => updateModule(modName, e.target.value)}
                                  style={{ background: 'transparent', border: '1px solid transparent', fontWeight: 'bold',
                                           fontSize: '1rem', outline: 'none', flex: 1, padding: '0.2rem 0.5rem',
                                           borderRadius: '4px', color: 'var(--text)' }}
                                  onFocus={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--border)'; }}
                                  onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }} />
                              </div>
                              <button className="btn btn-sm btn-secondary" onClick={() => addRow(materiaName, modName)}
                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}>
                                <Plus size={13} /> Añadir contenido
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* ── CONTENT ROWS (Level 3) ───────────── */}
                        {!isModuloCollapsed && modRows.map(row => (
                          <tr key={row.id}
                            draggable={draggableRowId === row.id}
                            onDragStart={e => handleDragStart(e, row.id)}
                            onDragOver={handleDragOver}
                            onDrop={e => handleDropOnRow(e, row.id)}
                            onDragEnd={() => { setDraggedId(null); setDraggableRowId(null); }}
                            style={{ opacity: draggedId === row.id ? 0.5 : 1, transition: 'opacity 0.2s',
                                     background: draggedId === row.id ? 'var(--surface)' : 'transparent' }}>
                            {/* NRO */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '1.5rem' }}>
                                <div onMouseEnter={() => setDraggableRowId(row.id)} onMouseLeave={() => setDraggableRowId(null)}
                                  style={{ display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                                  <GripVertical size={16} style={{ color: '#94a3b8', cursor: 'grab', flexShrink: 0 }} />
                                </div>
                                <input type="text" className="cell-input" value={row.nro}
                                  onChange={e => updateRow(row.id, 'nro', e.target.value)}
                                  style={{ width: '100%' }} />
                              </div>
                            </td>
                            {/* Descripción */}
                            <td>
                              <input type="text" className="cell-input" value={row.descripcion}
                                placeholder="Descripción del contenido..."
                                onChange={e => updateRow(row.id, 'descripcion', e.target.value)} />
                            </td>
                            {/* Formato */}
                            <td>
                              <select className="cell-select" value={row.formato}
                                onChange={e => updateRow(row.id, 'formato', e.target.value)}>
                                {formatOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </td>
                            {/* Links */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {renderLinksCell(row)}

                                {/* Upload button (hidden when Google Drive link active) */}
                                {!isGoogleDriveUrl(row.links) && (
                                  <button className="icon-btn"
                                    style={{ padding: '0.3rem', color: 'var(--accent)', flexShrink: 0 }}
                                    onClick={() => triggerUpload(row.id)}
                                    title="Subir Archivo (.doc, .pdf, .mp4)">
                                    <Upload size={14} />
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
                                  style={{ color: 'var(--accent)', padding: '4px', cursor: 'pointer' }} 
                                  onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin módulo', row.nro)}
                                  title="Crear tarea / observación"
                                >
                                  <ClipboardList size={16} />
                                </button>
                                <button 
                                  className="icon-btn danger" 
                                  style={{ padding: '4px', cursor: 'pointer' }} 
                                  onClick={() => removeRow(row.id)}
                                  title="Eliminar contenido"
                                >
                                  <Trash2 size={16} />
                                </button>
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

      <div className="table-footer" style={{ display: 'flex', gap: '1rem' }}>
        <button className="btn btn-primary" onClick={() => addRow(`Materia ${materias.length + 1}`, 'Módulo 1')}>
          <Plus size={16} /> Añadir Materia
        </button>
      </div>

      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload}
        accept=".pdf,.doc,.docx,.mp4,video/mp4,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
    </div>
  );
};

export default ContentTable;
