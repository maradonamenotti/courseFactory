import React, { useState, useEffect } from 'react';
import { type Course, type Folder, type CourseRow } from '../types';
import { 
  CheckCircle, 
  BookOpen, 
  Briefcase, 
  ChevronRight, 
  ChevronDown, 
  Folder as FolderIcon, 
  Search, 
  ExternalLink,
  Layers
} from 'lucide-react';
import './AnalyticsPanel.css';
import TrackingDashboard from './TrackingDashboard';

interface AnalyticsPanelProps {
  courses: Course[];
  folders: Folder[];
  onSelectCourse?: (id: string) => void;
}

interface Segment {
  value: number;
  color: string;
  tooltip: string;
}

// Reusable Stacked Progress Bar Component
const StackedProgressBar: React.FC<{ segments: Segment[]; title: string }> = ({ segments, title }) => {
  return (
    <div 
      className="stacked-bar-container"
      title={title}
    >
      {segments.map((seg, idx) => seg.value > 0 ? (
        <div 
          key={idx}
          title={seg.tooltip}
          className="stacked-bar-segment"
          style={{
            width: `${seg.value}%`,
            backgroundColor: seg.color
          }} 
        />
      ) : null)}
    </div>
  );
};

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ courses, folders = [], onSelectCourse }) => {
  const [activeTab, setActiveTab] = useState<'development' | 'students'>('development');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCarreras, setExpandedCarreras] = useState<Record<string, boolean>>({});
  const [expandedLicencias, setExpandedLicencias] = useState<Record<string, boolean>>({});
  const [expandLooseCourses, setExpandLooseCourses] = useState(true);

  // Global counts
  const totalCarreras = folders.filter(f => f.type === 'carrera').length;
  const totalCourses = courses.length;
  const allRows = courses.flatMap(c => c.rows);
  const totalTopics = allRows.length;
  const finishedTopics = allRows.filter(r => r.estadoFinal === 'LISTO PARA MOODLE').length;

  const calculateProgressData = (rows: CourseRow[]) => {
    const total = rows.length;
    if (total === 0) return null;

    // 1. Contenido status
    const countContentPending = rows.filter(r => r.estado === '1-NO EMPEZADO').length;
    const countContentInProgress = rows.filter(r => r.estado === '2-EN PROCESO').length;
    const countContentCorrection = rows.filter(r => r.estado === '3-CORREGIR').length;
    const countContentAvailable = rows.filter(r => r.estado === '4-DISPONIBLE').length;

    // 2. Multimedia status
    const countMmPending = rows.filter(r => r.estadoMultimedia === '1-NO EMPEZADO').length;
    const countMmInProgress = rows.filter(r => r.estadoMultimedia === '2-EN PROCESO').length;
    const countMmCorrection = rows.filter(r => r.estadoMultimedia === '3-CORREGIR').length;
    const countMmAvailable = rows.filter(r => r.estadoMultimedia === '4-DISPONIBLE').length;

    // 3. Verificación status (combined Contenido + Multimedia reviews)
    let totalReviews = 0;
    let countRevPending = 0;
    let countRevRejected = 0;
    let countRevApproved = 0;

    rows.forEach(r => {
      // Contenido review
      totalReviews++;
      if (r.aprobacionContenido === 'APROBADO') {
        countRevApproved++;
      } else if (r.aprobacionContenido === 'RECHAZADO') {
        countRevRejected++;
      } else {
        countRevPending++;
      }

      // Multimedia review
      totalReviews++;
      if (r.aprobacionMultimedia === 'APROBADO') {
        countRevApproved++;
      } else if (r.aprobacionMultimedia === 'RECHAZADO') {
        countRevRejected++;
      } else {
        countRevPending++;
      }
    });

    const pctRevPending = totalReviews > 0 ? (countRevPending / totalReviews) * 100 : 0;
    const pctRevRejected = totalReviews > 0 ? (countRevRejected / totalReviews) * 100 : 0;
    const pctRevApproved = totalReviews > 0 ? (countRevApproved / totalReviews) * 100 : 0;

    return {
      total,
      content: {
        pending: countContentPending,
        inProgress: countContentInProgress,
        correction: countContentCorrection,
        available: countContentAvailable,
        pctPending: (countContentPending / total) * 100,
        pctInProgress: (countContentInProgress / total) * 100,
        pctCorrection: (countContentCorrection / total) * 100,
        pctAvailable: (countContentAvailable / total) * 100,
      },
      multimedia: {
        pending: countMmPending,
        inProgress: countMmInProgress,
        correction: countMmCorrection,
        available: countMmAvailable,
        pctPending: (countMmPending / total) * 100,
        pctInProgress: (countMmInProgress / total) * 100,
        pctCorrection: (countMmCorrection / total) * 100,
        pctAvailable: (countMmAvailable / total) * 100,
      },
      verificacion: {
        total: totalReviews,
        pending: countRevPending,
        rejected: countRevRejected,
        approved: countRevApproved,
        pctPending: pctRevPending,
        pctRejected: pctRevRejected,
        pctApproved: pctRevApproved,
      }
    };
  };

  const getContentSegments = (c: any) => [
    { value: c.pctPending, color: '#ffb300', tooltip: `Pendiente: ${Math.round(c.pctPending)}% (${c.pending}/${c.total})` },
    { value: c.pctInProgress, color: '#ff6f00', tooltip: `En Proceso: ${Math.round(c.pctInProgress)}% (${c.inProgress}/${c.total})` },
    { value: c.pctCorrection, color: '#e53935', tooltip: `Corregir: ${Math.round(c.pctCorrection)}% (${c.correction}/${c.total})` },
    { value: c.pctAvailable, color: '#00c853', tooltip: `Disponible: ${Math.round(c.pctAvailable)}% (${c.available}/${c.total})` },
  ];

  const getMultimediaSegments = (m: any) => [
    { value: m.pctPending, color: '#ffb300', tooltip: `Pendiente: ${Math.round(m.pctPending)}% (${m.pending}/${m.total})` },
    { value: m.pctInProgress, color: '#ff6f00', tooltip: `En Proceso: ${Math.round(m.pctInProgress)}% (${m.inProgress}/${m.total})` },
    { value: m.pctCorrection, color: '#e53935', tooltip: `Corregir: ${Math.round(m.pctCorrection)}% (${m.correction}/${m.total})` },
    { value: m.pctAvailable, color: '#00c853', tooltip: `Disponible: ${Math.round(m.pctAvailable)}% (${m.available}/${m.total})` },
  ];

  const getVerificacionSegments = (v: any) => [
    { value: v.pctPending, color: '#ffb300', tooltip: `Pendiente: ${Math.round(v.pctPending)}% (${v.pending}/${v.total})` },
    { value: v.pctRejected, color: '#e53935', tooltip: `Rechazado: ${Math.round(v.pctRejected)}% (${v.rejected}/${v.total})` },
    { value: v.pctApproved, color: '#00c853', tooltip: `Aprobado: ${Math.round(v.pctApproved)}% (${v.approved}/${v.total})` },
  ];

  // Filtering and tree building
  const getFilteredHierarchy = () => {
    const query = searchTerm.toLowerCase().trim();
    const carreras = folders.filter(f => f.type === 'carrera');
    const licencias = folders.filter(f => f.type === 'licencia');

    const result: any[] = [];

    carreras.forEach(carrera => {
      const directCourses = courses.filter(c => c.folderId === carrera.id);
      const childLicencias = licencias.filter(l => l.parentId === carrera.id);

      const filteredLicenciasList: any[] = [];
      childLicencias.forEach(lic => {
        const licCourses = courses.filter(c => c.folderId === lic.id);
        const filteredLicCourses = licCourses.filter(c => c.name.toLowerCase().includes(query));
        
        const isLicMatch = lic.name.toLowerCase().includes(query) || filteredLicCourses.length > 0;
        if (!query || isLicMatch) {
          filteredLicenciasList.push({
            folder: lic,
            courses: query && lic.name.toLowerCase().includes(query) ? licCourses : filteredLicCourses
          });
        }
      });

      const filteredDirectCourses = directCourses.filter(c => c.name.toLowerCase().includes(query));

      const isCarreraMatch = 
        carrera.name.toLowerCase().includes(query) || 
        filteredDirectCourses.length > 0 || 
        filteredLicenciasList.length > 0;

      if (!query || isCarreraMatch) {
        result.push({
          folder: carrera,
          licencias: query && carrera.name.toLowerCase().includes(query) ? 
            childLicencias.map(l => ({ folder: l, courses: courses.filter(c => c.folderId === l.id) })) : 
            filteredLicenciasList,
          courses: query && carrera.name.toLowerCase().includes(query) ? directCourses : filteredDirectCourses
        });
      }
    });

    const folderIds = folders.map(f => f.id);
    const looseCourses = courses.filter(c => !c.folderId || !folderIds.includes(c.folderId));
    const filteredLooseCourses = looseCourses.filter(c => c.name.toLowerCase().includes(query));

    return {
      carreras: result,
      looseCourses: filteredLooseCourses
    };
  };

  const { carreras: filteredCarreras, looseCourses: filteredLooseCourses } = getFilteredHierarchy();

  // Auto expand on search
  useEffect(() => {
    if (searchTerm.trim() !== '') {
      const carrerasToExpand: Record<string, boolean> = {};
      const licenciasToExpand: Record<string, boolean> = {};
      
      filteredCarreras.forEach(c => {
        carrerasToExpand[c.folder.id] = true;
        c.licencias.forEach((l: any) => {
          licenciasToExpand[l.folder.id] = true;
        });
      });
      
      setExpandedCarreras(carrerasToExpand);
      setExpandedLicencias(licenciasToExpand);
    }
  }, [searchTerm]);

  const toggleCarrera = (id: string) => {
    setExpandedCarreras(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleLicencia = (id: string) => {
    setExpandedLicencias(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Render a progress group (3 stacked bars side-by-side)
  const renderProgressGroup = (rows: CourseRow[]) => {
    const p = calculateProgressData(rows);
    if (!p) {
      return (
        <>
          <div className="stats-col-empty">-</div>
          <div className="stats-col-empty">-</div>
          <div className="stats-col-empty">-</div>
        </>
      );
    }

    const contentTitle = `Contenido (${p.total} temas) — Disponible: ${p.content.available}/${p.total} | En Proceso: ${p.content.inProgress}/${p.total} | Corregir: ${p.content.correction}/${p.total} | Pendiente: ${p.content.pending}/${p.total}`;
    const multimediaTitle = `Multimedia (${p.total} temas) — Disponible: ${p.multimedia.available}/${p.total} | En Proceso: ${p.multimedia.inProgress}/${p.total} | Corregir: ${p.multimedia.correction}/${p.total} | Pendiente: ${p.multimedia.pending}/${p.total}`;
    const verificacionTitle = `Verificación (${p.verificacion.total} revisiones) — Aprobado: ${p.verificacion.approved}/${p.verificacion.total} | Rechazado: ${p.verificacion.rejected}/${p.verificacion.total} | Pendiente: ${p.verificacion.pending}/${p.verificacion.total}`;

    return (
      <>
        <div className="stats-col-progress">
          <StackedProgressBar segments={getContentSegments(p.content)} title={contentTitle} />
        </div>
        <div className="stats-col-progress">
          <StackedProgressBar segments={getMultimediaSegments(p.multimedia)} title={multimediaTitle} />
        </div>
        <div className="stats-col-progress">
          <StackedProgressBar segments={getVerificacionSegments(p.verificacion)} title={verificacionTitle} />
        </div>
      </>
    );
  };

  return (
    <div className="analytics-container animate-fade-in">
      {/* Tab Switcher and Header */}
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h3>Panel de Analítica y Progreso</h3>
          <p className="text-muted">Métricas generales del desarrollo del curso y estado de avance.</p>
        </div>
        <div className="tab-buttons" style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button 
            className={`btn btn-sm ${activeTab === 'development' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ 
              padding: '0.4rem 1rem', 
              fontSize: '0.85rem', 
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'development' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'development' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveTab('development')}
          >
            Progreso de Desarrollo
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ 
              padding: '0.4rem 1rem', 
              fontSize: '0.85rem', 
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'students' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'students' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveTab('students')}
          >
            Seguimiento de Moodle
          </button>
        </div>
      </div>

      {activeTab === 'development' ? (
        <>
          {/* Top general KPIs cards */}
          <div className="metrics-grid">
            <div className="metric-card glass-panel">
              <div className="metric-icon bg-purple-100 text-purple-600">
                <Briefcase size={24} />
              </div>
              <div className="metric-info">
                <h4>Carreras</h4>
                <span className="metric-value">{totalCarreras}</span>
              </div>
            </div>

            <div className="metric-card glass-panel">
              <div className="metric-icon bg-blue-100 text-blue-600">
                <BookOpen size={24} />
              </div>
              <div className="metric-info">
                <h4>Cursos Creados</h4>
                <span className="metric-value">{totalCourses}</span>
              </div>
            </div>

            <div className="metric-card glass-panel">
              <div className="metric-icon bg-yellow-100 text-yellow-600">
                <Layers size={24} />
              </div>
              <div className="metric-info">
                <h4>Total Clases / Temas</h4>
                <span className="metric-value">{totalTopics}</span>
              </div>
            </div>

            <div className="metric-card glass-panel">
              <div className="metric-icon bg-green-100 text-green-600">
                <CheckCircle size={24} />
              </div>
              <div className="metric-info">
                <h4>Clases Listas Moodle</h4>
                <span className="metric-value">{finishedTopics}</span>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="search-bar-container glass-panel" style={{ padding: '0.8rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <Search size={16} className="text-muted" />
            <input 
              type="text" 
              placeholder="Buscar por carrera, licencia o curso..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-main)',
                width: '100%',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                Limpiar
              </button>
            )}
          </div>

          {/* Hierarchical Stats View */}
          <div className="glass-panel stats-tree-card" style={{ padding: '0', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* Grid Header */}
            <div className="stats-grid-row stats-header-row">
              <div className="stats-col-name">Nombre / Jerarquía</div>
              <div className="stats-col-header-progress">Contenido</div>
              <div className="stats-col-header-progress">Multimedia</div>
              <div className="stats-col-header-progress">Verificación</div>
            </div>

            <div className="stats-tree-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {filteredCarreras.length === 0 && filteredLooseCourses.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No se encontraron resultados para la búsqueda.
                </div>
              )}

              {/* Render Carreras */}
              {filteredCarreras.map((carreraNode) => {
                const carrera = carreraNode.folder;
                const isExpanded = !!expandedCarreras[carrera.id];
                
                // Aggregate all rows for the Carrera (Licencias + Direct Courses)
                const carreraLicIds = carreraNode.licencias.map((l: any) => l.folder.id);
                const carreraCourses = [
                  ...courses.filter(c => c.folderId && carreraLicIds.includes(c.folderId)),
                  ...carreraNode.courses
                ];
                const carreraRows = carreraCourses.flatMap(c => c.rows);

                return (
                  <React.Fragment key={carrera.id}>
                    {/* Carrera Row */}
                    <div 
                      className={`stats-grid-row stats-carrera-row ${isExpanded ? 'is-expanded' : ''}`}
                      onClick={() => toggleCarrera(carrera.id)}
                    >
                      <div className="stats-col-name stats-carrera-name">
                        <button className="stats-expand-btn">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <Briefcase size={16} style={{ color: carrera.color || 'var(--primary)' }} />
                        <span className="stats-row-title">{carrera.name}</span>
                        {carrera.year && <span className="stats-badge-year">{carrera.year}</span>}
                        {carrera.isOfficial && <span className="stats-badge-official">Oficial</span>}
                        <span className="stats-badge-count">{carreraCourses.length} cursos</span>
                      </div>
                      {renderProgressGroup(carreraRows)}
                    </div>

                    {/* Carrera Children (expanded) */}
                    {isExpanded && (
                      <div className="stats-carrera-children">
                        
                        {/* 1. Licencias */}
                        {carreraNode.licencias.map((licNode: any) => {
                          const licencia = licNode.folder;
                          const isLicExpanded = !!expandedLicencias[licencia.id];
                          const licCourses = licNode.courses;
                          const licRows = licCourses.flatMap((c: Course) => c.rows);

                          return (
                            <React.Fragment key={licencia.id}>
                              {/* Licencia Row */}
                              <div 
                                className={`stats-grid-row stats-licencia-row ${isLicExpanded ? 'is-expanded' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLicencia(licencia.id);
                                }}
                              >
                                <div className="stats-col-name stats-licencia-name" style={{ paddingLeft: '2rem' }}>
                                  <button className="stats-expand-btn">
                                    {isLicExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                  <FolderIcon size={14} className="text-muted" />
                                  <span className="stats-row-title">{licencia.name}</span>
                                  <span className="stats-badge-count-sub">{licCourses.length} cursos</span>
                                </div>
                                {renderProgressGroup(licRows)}
                              </div>

                              {/* Licencia Children (Courses) */}
                              {isLicExpanded && (
                                <div className="stats-licencia-children">
                                  {licCourses.length === 0 ? (
                                    <div className="stats-grid-row stats-empty-row" style={{ paddingLeft: '4rem' }}>
                                      <span className="text-muted text-xs">No hay cursos en esta licencia</span>
                                    </div>
                                  ) : (
                                    licCourses.map((course: Course) => (
                                      <div 
                                        key={course.id}
                                        className="stats-grid-row stats-course-row"
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(`${window.location.origin}/?courseId=${course.id}`, '_blank');
                                        }}
                                      >
                                        <div className="stats-col-name stats-course-name" style={{ paddingLeft: '4rem' }}>
                                          <BookOpen size={13} className="text-muted" />
                                          <span className="stats-row-title">{course.name}</span>
                                          {onSelectCourse && (
                                            <span className="stats-hover-link">
                                              <ExternalLink size={12} />
                                            </span>
                                          )}
                                          <span className="stats-badge-classes">{course.rows.length} clases</span>
                                        </div>
                                        {renderProgressGroup(course.rows)}
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}

                        {/* 2. Direct Courses (not under a license) */}
                        {carreraNode.courses.map((course: Course) => (
                          <div 
                            key={course.id}
                            className="stats-grid-row stats-course-row"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`${window.location.origin}/?courseId=${course.id}`, '_blank');
                            }}
                          >
                            <div className="stats-col-name stats-course-name" style={{ paddingLeft: '2.5rem' }}>
                              <BookOpen size={13} className="text-muted" />
                              <span className="stats-row-title">{course.name}</span>
                              <span className="stats-badge-direct">Directo</span>
                              {onSelectCourse && (
                                <span className="stats-hover-link">
                                  <ExternalLink size={12} />
                                </span>
                              )}
                              <span className="stats-badge-classes">{course.rows.length} clases</span>
                            </div>
                            {renderProgressGroup(course.rows)}
                          </div>
                        ))}

                        {carreraNode.licencias.length === 0 && carreraNode.courses.length === 0 && (
                          <div style={{ padding: '1rem', paddingLeft: '2.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Esta carrera no tiene licencias ni cursos.
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Render Loose / Unassigned Courses */}
              {filteredLooseCourses.length > 0 && (
                <React.Fragment>
                  <div 
                    className="stats-grid-row stats-carrera-row loose-header-row"
                    onClick={() => setExpandLooseCourses(!expandLooseCourses)}
                  >
                    <div className="stats-col-name stats-carrera-name">
                      <button className="stats-expand-btn">
                        {expandLooseCourses ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <FolderIcon size={16} className="text-muted" />
                      <span className="stats-row-title">Cursos Libres / Generales</span>
                      <span className="stats-badge-count">{filteredLooseCourses.length} cursos</span>
                    </div>
                    {renderProgressGroup(filteredLooseCourses.flatMap(c => c.rows))}
                  </div>

                  {expandLooseCourses && (
                    <div className="stats-carrera-children">
                      {filteredLooseCourses.map((course: Course) => (
                        <div 
                          key={course.id}
                          className="stats-grid-row stats-course-row"
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`${window.location.origin}/?courseId=${course.id}`, '_blank');
                          }}
                        >
                          <div className="stats-col-name stats-course-name" style={{ paddingLeft: '2.5rem' }}>
                            <BookOpen size={13} className="text-muted" />
                            <span className="stats-row-title">{course.name}</span>
                            {onSelectCourse && (
                              <span className="stats-hover-link">
                                <ExternalLink size={12} />
                              </span>
                            )}
                            <span className="stats-badge-classes">{course.rows.length} clases</span>
                          </div>
                          {renderProgressGroup(course.rows)}
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              )}
            </div>
          </div>
        </>
      ) : (
        <TrackingDashboard />
      )}
    </div>
  );
};

export default AnalyticsPanel;
