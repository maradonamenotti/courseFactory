import React, { useState } from 'react';
import { type CourseRow, multimediaStatusOptions } from '../types';
import { AlertCircle, ExternalLink, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';

interface MultimediaTableProps {
  rows: CourseRow[];
  updateRow: (id: string, field: keyof CourseRow, value: string) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
}

const subtitulosOptions = ['SI', 'NO'];

const estadoMultimediaOptions = [
  { value: '1-NO EMPEZADO', color: 'var(--status-not-started)' },
  { value: '2-EN PROCESO', color: 'var(--status-in-progress)' },
  { value: '3-CORREGIR', color: 'var(--status-review)' },
  { value: '4-DISPONIBLE', color: 'var(--status-available)' }
];

const MultimediaTable: React.FC<MultimediaTableProps> = ({ rows, updateRow, onAddRowTask }) => {
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

  const getStatusColor = (status: string) => {
    return multimediaStatusOptions.find(opt => opt.value === status)?.color || 'white';
  };

  const getEstadoColor = (status: string) => {
    return estadoMultimediaOptions.find(opt => opt.value === status)?.color || 'white';
  };

  // Helper: input + botón para abrir el link
  const LinkInput = ({ 
    value, placeholder, onChange 
  }: { value: string; placeholder: string; onChange: (v: string) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <input
        type="text"
        className="cell-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir enlace"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.3rem',
            borderRadius: '6px',
            color: 'var(--accent)',
            background: 'rgba(139,92,246,0.12)',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.28)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  );

  // Extract unique materias from rows
  const materias = Array.from(new Set(rows.map(r => r.materia || 'Sin materia')));

  // Check if there are any rows at all
  if (rows.length === 0) {
    return (
      <div className="table-wrapper glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Sin contenido registrado</h4>
        <p className="text-muted">
          No hay clases o temas cargados en el Panel 1 para este curso.
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrapper glass-panel">
      <div className="table-responsive">
        <table className="content-table multimedia-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '4%' }}>NRO</th>
              <th rowSpan={2} style={{ width: '15%' }}>Descripción del contenido</th>
              <th rowSpan={2} style={{ width: '8%' }}>Formato</th>
              <th colSpan={3} className="text-center group-header">VIDEOS</th>
              <th colSpan={3} className="text-center group-header">GENIALLY</th>
              <th rowSpan={2} style={{ width: '10%' }}>ESTADO</th>
              <th rowSpan={2} style={{ width: '5%' }}>TAREA</th>
            </tr>
            <tr>
              <th className="sub-header">Link de drive</th>
              <th className="sub-header">Link de vimeo</th>
              <th className="sub-header">Subtitulos</th>
              <th className="sub-header">LINK</th>
              <th className="sub-header">TEXTO</th>
              <th className="sub-header">DISEÑO</th>
            </tr>
          </thead>
          <tbody>
            {materias.map(materiaName => {
              const materiaRows = rows.filter(r => (r.materia || 'Sin materia') === materiaName);
              const modulos = Array.from(new Set(materiaRows.map(r => r.modulo || 'Sin módulo')));
              const isMateriaCollapsed = collapsedMaterias.has(materiaName);

              return (
                <React.Fragment key={`materia-${materiaName}`}>
                  {/* ── MATERIA HEADER (Level 1) ─────────────────── */}
                  <tr className="module-header-row"
                    style={{ background: 'rgba(79, 70, 229, 0.12)' }}>
                    <td colSpan={11} style={{ padding: '0.9rem 1rem', borderBottom: '2px solid rgba(79, 70, 229, 0.25)' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                          onClick={() => toggleMateria(materiaName)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary)', display: 'flex', marginRight: '0.5rem' }}
                        >
                          {isMateriaCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.8px', marginRight: '0.5rem' }}>MATERIA:</span>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>{materiaName}</span>
                      </div>
                    </td>
                  </tr>

                  {/* ── MÓDULOS within this materia ──────────────── */}
                  {!isMateriaCollapsed && modulos.map(modName => {
                    const modRows = materiaRows.filter(r => (r.modulo || 'Sin módulo') === modName);
                    const moduloKey = `${materiaName}::${modName}`;
                    const isModuloCollapsed = collapsedModulos.has(moduloKey);

                    return (
                      <React.Fragment key={moduloKey}>
                        {/* ── MÓDULO HEADER (Level 2) ──────────── */}
                        <tr className="module-header-row"
                          style={{ background: 'rgba(139, 92, 246, 0.06)' }}>
                          <td colSpan={11} style={{ padding: '0.65rem 1rem 0.65rem 2.5rem', borderBottom: '1px solid rgba(139, 92, 246, 0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <button
                                onClick={() => toggleModulo(moduloKey)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--accent)', display: 'flex', marginRight: '0.5rem' }}
                              >
                                {isModuloCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.5rem' }}>MÓDULO:</span>
                              <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)' }}>{modName}</span>
                            </div>
                          </td>
                        </tr>

                        {/* ── CONTENT ROWS (Level 3) ───────────── */}
                        {!isModuloCollapsed && modRows.map(row => {
                          const isVideo = row.formato === 'VIDEO';
                          const isGenially = row.formato === 'GENIALLY';
                          const isMultimedia = isVideo || isGenially;

                          if (isMultimedia) {
                            return (
                              <tr key={row.id}>
                                <td className="readonly-cell" style={{ paddingLeft: '1.5rem' }}>{row.nro}</td>
                                <td>
                                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                    {row.descripcion}
                                  </span>
                                </td>
                                <td>
                                  <span className={`formato-badge ${isVideo ? 'formato-badge--video' : 'formato-badge--genially'}`}>
                                    {row.formato}
                                  </span>
                                </td>

                                {/* VIDEOS — editable solo si es VIDEO */}
                                <td>
                                  {isVideo ? (
                                    <LinkInput
                                      value={row.videoDrive}
                                      placeholder="https://drive..."
                                      onChange={(v) => updateRow(row.id, 'videoDrive', v)}
                                    />
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>
                                <td>
                                  {isVideo ? (
                                    <LinkInput
                                      value={row.videoVimeo}
                                      placeholder="https://vimeo..."
                                      onChange={(v) => updateRow(row.id, 'videoVimeo', v)}
                                    />
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>
                                <td>
                                  {isVideo ? (
                                    <select
                                      className="cell-select"
                                      value={row.videoSubtitulos}
                                      onChange={(e) => updateRow(row.id, 'videoSubtitulos', e.target.value)}
                                    >
                                      {subtitulosOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>

                                {/* GENIALLY — editable solo si es GENIALLY */}
                                <td>
                                  {isGenially ? (
                                    <LinkInput
                                      value={row.geniallyUrl || ''}
                                      placeholder="https://view.genial.ly/..."
                                      onChange={(v) => updateRow(row.id, 'geniallyUrl', v)}
                                    />
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>
                                <td>
                                  {isGenially ? (
                                    <div className="status-select-wrapper">
                                      <div 
                                        className="status-indicator" 
                                        style={{ backgroundColor: getStatusColor(row.geniallyTextoStatus) }} 
                                      />
                                      <select
                                        className="cell-select status-select"
                                        value={row.geniallyTextoStatus}
                                        style={{ color: getStatusColor(row.geniallyTextoStatus) }}
                                        onChange={(e) => updateRow(row.id, 'geniallyTextoStatus', e.target.value)}
                                      >
                                        {multimediaStatusOptions.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>
                                <td>
                                  {isGenially ? (
                                    <div className="status-select-wrapper">
                                      <div 
                                        className="status-indicator" 
                                        style={{ backgroundColor: getStatusColor(row.geniallyDisenoStatus) }} 
                                      />
                                      <select
                                        className="cell-select status-select"
                                        value={row.geniallyDisenoStatus}
                                        style={{ color: getStatusColor(row.geniallyDisenoStatus) }}
                                        onChange={(e) => updateRow(row.id, 'geniallyDisenoStatus', e.target.value)}
                                      >
                                        {multimediaStatusOptions.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                                </td>

                                {/* ESTADO MULTIMEDIA — para todas las filas */}
                                <td>
                                  <div className="status-select-wrapper">
                                    <div 
                                      className="status-indicator" 
                                      style={{ backgroundColor: getEstadoColor(row.estadoMultimedia) }} 
                                    />
                                    <select
                                      className="cell-select status-select"
                                      value={row.estadoMultimedia}
                                      style={{ color: getEstadoColor(row.estadoMultimedia) }}
                                      onChange={(e) => updateRow(row.id, 'estadoMultimedia', e.target.value)}
                                    >
                                      {estadoMultimediaOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.value}</option>
                                      ))}
                                    </select>
                                  </div>
                                </td>

                                {/* TAREA */}
                                <td style={{ textAlign: 'center' }}>
                                  <button 
                                    className="icon-btn" 
                                    style={{ color: 'var(--accent)', padding: '4px' }} 
                                    onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin módulo', row.nro)}
                                    title="Crear tarea / observación"
                                  >
                                    <ClipboardList size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          } else {
                            // Fila grisada y no editable (por ejemplo TEXTO, CUESTIONARIO, etc.)
                            return (
                              <tr key={row.id} style={{ opacity: 0.45, background: 'rgba(255, 255, 255, 0.015)' }}>
                                <td className="readonly-cell" style={{ paddingLeft: '1.5rem' }}>{row.nro}</td>
                                <td>
                                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                    {row.descripcion}
                                  </span>
                                </td>
                                <td>
                                  <span className="formato-badge" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                                    {row.formato}
                                  </span>
                                </td>

                                {/* VIDEOS */}
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>

                                {/* GENIALLY */}
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>

                                {/* ESTADO */}
                                <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span></td>

                                {/* TAREA */}
                                <td style={{ textAlign: 'center' }}>
                                  <button 
                                    className="icon-btn" 
                                    style={{ color: 'var(--text-muted)', padding: '4px', cursor: 'pointer' }} 
                                    onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin módulo', row.nro)}
                                    title="Crear tarea / observación"
                                  >
                                    <ClipboardList size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          }
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
    </div>
  );
};

export default MultimediaTable;
