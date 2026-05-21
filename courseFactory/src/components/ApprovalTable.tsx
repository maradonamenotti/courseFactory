import { ExternalLink, ClipboardList } from 'lucide-react';
import { type CourseRow, approvalOptions, finalStatusOptions } from '../types';

interface ApprovalTableProps {
  rows: CourseRow[];
  updateRow: (id: string, field: keyof CourseRow, value: string) => void;
  onAddRowTask?: (rowId: string, modulo: string, nro: string) => void;
}

const ApprovalTable: React.FC<ApprovalTableProps> = ({ rows, updateRow, onAddRowTask }) => {
  const getApprovalColor = (status: string) => {
    return approvalOptions.find(opt => opt.value === status)?.color || 'white';
  };

  const getFinalStatusColor = (status: string) => {
    return finalStatusOptions.find(opt => opt.value === status)?.color || 'white';
  };

  return (
    <div className="table-wrapper glass-panel">
      <div className="table-responsive">
        <table className="content-table approval-table">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>NRO</th>
              <th style={{ width: '14%' }}>Módulo / Clase</th>
              <th style={{ width: '10%' }}>Ver Material</th>
              <th style={{ width: '13%' }}>Rev. Contenido</th>
              <th style={{ width: '13%' }}>Rev. Multimedia</th>
              <th style={{ width: '30%' }}>Comentarios del Revisor</th>
              <th style={{ width: '12%' }}>Visto Bueno Final</th>
              <th style={{ width: '4%' }}>Tarea</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isAvailable = row.estado === '4-DISPONIBLE';
              
              return (
                <tr 
                  key={row.id} 
                  className={row.estadoFinal === 'LISTO PARA MOODLE' ? 'row-approved' : ''}
                  style={!isAvailable ? { opacity: 0.55, background: 'rgba(255, 255, 255, 0.02)', filter: 'grayscale(80%)' } : {}}
                  title={!isAvailable ? "Este contenido aún no está DISPONIBLE para verificación" : ""}
                >
                  <td className="readonly-cell">{row.nro}</td>
                  <td className="readonly-cell">
                    <div><strong>{row.modulo || 'Sin módulo'}</strong></div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>{row.descripcion}</div>
                  </td>

                  {/* Ver Material — links de acceso rápido */}
                  <td style={{ pointerEvents: !isAvailable ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {row.links && (
                        <a
                          href={row.links}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Contenido: ${row.links}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: 'rgba(139,92,246,0.15)',
                            color: 'var(--accent)',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <ExternalLink size={11} /> Contenido
                        </a>
                      )}
                      {row.videoDrive && (
                        <a
                          href={row.videoDrive}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Drive: ${row.videoDrive}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: 'rgba(239,68,68,0.12)',
                            color: '#ef4444',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <ExternalLink size={11} /> Drive
                        </a>
                      )}
                      {row.videoVimeo && (
                        <a
                          href={row.videoVimeo}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Vimeo: ${row.videoVimeo}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: 'rgba(16,185,129,0.12)',
                            color: '#10b981',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <ExternalLink size={11} /> Vimeo
                        </a>
                      )}
                      {row.geniallyUrl && (
                        <a
                          href={row.geniallyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Genially: ${row.geniallyUrl}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: 'rgba(59,130,246,0.12)',
                            color: '#3b82f6',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <ExternalLink size={11} /> Genially
                        </a>
                      )}
                      {!row.links && !row.videoDrive && !row.videoVimeo && !row.geniallyUrl && (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>Sin links</span>
                      )}
                    </div>
                  </td>

                  {/* Aprobación Contenido */}
                  <td>
                    <div className="status-select-wrapper">
                      <div 
                        className="status-indicator" 
                        style={{ backgroundColor: getApprovalColor(row.aprobacionContenido) }} 
                      />
                      <select
                        className="cell-select status-select"
                        value={row.aprobacionContenido}
                        style={{ color: getApprovalColor(row.aprobacionContenido) }}
                        onChange={(e) => updateRow(row.id, 'aprobacionContenido', e.target.value)}
                        disabled={!isAvailable}
                      >
                        {approvalOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                        ))}
                      </select>
                    </div>
                  </td>

                  {/* Aprobación Multimedia */}
                  <td>
                    <div className="status-select-wrapper">
                      <div 
                        className="status-indicator" 
                        style={{ backgroundColor: getApprovalColor(row.aprobacionMultimedia) }} 
                      />
                      <select
                        className="cell-select status-select"
                        value={row.aprobacionMultimedia}
                        style={{ color: getApprovalColor(row.aprobacionMultimedia) }}
                        onChange={(e) => updateRow(row.id, 'aprobacionMultimedia', e.target.value)}
                        disabled={!isAvailable}
                      >
                        {approvalOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                        ))}
                      </select>
                    </div>
                  </td>

                  {/* Comentarios */}
                  <td>
                    <input
                      type="text"
                      className="cell-input"
                      value={row.comentariosRevisor}
                      placeholder="Escribir feedback o correcciones..."
                      onChange={(e) => updateRow(row.id, 'comentariosRevisor', e.target.value)}
                      disabled={!isAvailable}
                    />
                  </td>

                  {/* Estado Final */}
                  <td>
                    <div className="status-select-wrapper">
                      <div 
                        className="status-indicator" 
                        style={{ backgroundColor: getFinalStatusColor(row.estadoFinal) }} 
                      />
                      <select
                        className="cell-select status-select"
                        value={row.estadoFinal}
                        style={{ color: getFinalStatusColor(row.estadoFinal) }}
                        onChange={(e) => updateRow(row.id, 'estadoFinal', e.target.value)}
                        disabled={!isAvailable}
                      >
                        {finalStatusOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                        ))}
                      </select>
                    </div>
                  </td>

                  {/* Tarea */}
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="icon-btn" 
                      style={{ color: 'var(--accent)', padding: '4px' }} 
                      onClick={() => onAddRowTask?.(row.id, row.modulo || 'Sin módulo', row.nro)}
                      title="Crear tarea / observación"
                      disabled={!isAvailable}
                    >
                      <ClipboardList size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApprovalTable;
