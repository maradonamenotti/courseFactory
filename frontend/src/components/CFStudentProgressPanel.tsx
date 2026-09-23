import React, { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  BarChart2,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Loader2,
  Calendar,
  Lock,
  Unlock,
  GraduationCap
} from 'lucide-react';
import { reportsApi } from '../services/api';

interface CFCourseItem {
  id: string;
  name: string;
  shortname?: string;
}

interface CFStudentClassProgress {
  modulo: string;
  materia: string;
  status: 'Realizada' | 'En Curso' | 'Pendiente';
  availabilityStatus?: 'Realizada' | 'En Curso' | 'Disponible' | 'Bloqueada';
  diasDisponibilidad?: number | null;
  fechaDisponibilidad?: string | null;
  calculatedReleaseDate?: string | null;
  firstAccessAt?: string | null;
  secondsActive: number;
  timeSpentFormatted: string;
  redeemedCode?: string | null;
}

interface CFStudentProgressItem {
  alumnoId: string;
  alumnoNombre: string;
  completedClassesCount: number;
  totalClassesCount: number;
  progressPercent: number;
  totalActiveMinutes: number;
  lastActivity: string;
  enrolledAt?: string | null;
  redeemedCode?: string | null;
  classes: CFStudentClassProgress[];
}

interface Student360Course {
  courseId: string;
  courseName: string;
  moodleCourseId?: string | null;
  completedClassesCount: number;
  totalClassesCount: number;
  progressPercent: number;
  enrolledAt?: string | null;
  redeemedCode?: string | null;
  classes: CFStudentClassProgress[];
}

interface Student360Item {
  alumnoId: string;
  alumnoNombre: string;
  email?: string | null;
  totalCourses: number;
  totalActiveMinutes: number;
  lastActivity: string;
  courses: Student360Course[];
}

interface CFStudentProgressPanelProps {
  courses?: Array<{ id: string; name: string }>;
  initialCourseId?: string;
}

export const CFStudentProgressPanel: React.FC<CFStudentProgressPanelProps> = ({
  courses = [],
  initialCourseId = ''
}) => {
  // Navigation mode: 'course' vs 'student360'
  const [viewMode, setViewMode] = useState<'course' | 'student360'>('course');

  // Course-centric view states
  const [cfCourses, setCfCourses] = useState<CFCourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<CFStudentProgressItem[]>([]);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Stats KPIs
  const [kpis, setKpis] = useState({
    totalStudents: 0,
    activeStudents: 0,
    averageProgress: 0,
    completedClassesTotal: 0
  });

  // Filters & Search for Course View
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all');

  // Main table sorting
  const [sortField, setSortField] = useState<'name' | 'progress' | 'classes' | 'time' | 'lastActivity' | 'enrolledAt'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Detail table sorting (Avance Clase por Clase)
  const [classSortField, setClassSortField] = useState<'modulo' | 'materia' | 'status' | 'secondsActive'>('modulo');
  const [classSortDirection, setClassSortDirection] = useState<'asc' | 'desc'>('asc');

  const [activeViewMode, setActiveViewMode] = useState<{ [studentId: string]: 'progress' | 'schedule' }>({});

  // 360 Student view states
  const [students360, setStudents360] = useState<Student360Item[]>([]);
  const [loading360, setLoading360] = useState<boolean>(false);
  const [search360, setSearch360] = useState<string>('');
  const [expanded360StudentId, setExpanded360StudentId] = useState<string | null>(null);
  const [expanded360CourseId, setExpanded360CourseId] = useState<{ [studentId: string]: string | null }>({});
  const [active360SubView, setActive360SubView] = useState<{ [key: string]: 'progress' | 'schedule' }>({});

  const handleSort = (field: 'name' | 'progress' | 'classes' | 'time' | 'lastActivity' | 'enrolledAt') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      if (field === 'progress' || field === 'classes' || field === 'time' || field === 'lastActivity' || field === 'enrolledAt') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const handleClassSort = (field: 'modulo' | 'materia' | 'status' | 'secondsActive') => {
    if (classSortField === field) {
      setClassSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setClassSortField(field);
      if (field === 'secondsActive' || field === 'status') {
        setClassSortDirection('desc');
      } else {
        setClassSortDirection('asc');
      }
    }
  };

  // Load CF courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const res = await reportsApi.getMoodleCourses();
        const localList: CFCourseItem[] = (res.localCourses || []).map(c => ({
          id: c.id,
          name: c.name
        }));

        const mergedCourses = localList.length > 0 ? localList : courses;
        setCfCourses(mergedCourses);

        if (mergedCourses.length > 0 && !selectedCourseId) {
          setSelectedCourseId(String(mergedCourses[0].id));
        }
      } catch (err) {
        console.error('Error fetching CF courses:', err);
        if (courses.length > 0) {
          setCfCourses(courses);
          if (!selectedCourseId) setSelectedCourseId(courses[0].id);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [courses]);

  // Load progress for selected course (Course view)
  useEffect(() => {
    if (viewMode !== 'course' || !selectedCourseId) return;

    const fetchProgress = async () => {
      try {
        setLoadingProgress(true);
        setError(null);

        const res = await reportsApi.getCFStudentProgress(selectedCourseId);
        setStudents(res.students || []);
        setKpis({
          totalStudents: res.totalStudents || 0,
          activeStudents: res.activeStudents || 0,
          averageProgress: res.averageProgress || 0,
          completedClassesTotal: res.completedClassesTotal || 0
        });
      } catch (err: any) {
        console.error('Error loading CF student progress:', err);
        setError('No se pudo obtener el informe de avance de CourseFactory.');
      } finally {
        setLoadingProgress(false);
      }
    };

    fetchProgress();
  }, [selectedCourseId, viewMode]);

  // Load 360 Student View
  useEffect(() => {
    if (viewMode !== 'student360') return;

    const fetch360Progress = async () => {
      try {
        setLoading360(true);
        setError(null);

        const res = await reportsApi.getCFStudent360Progress(search360);
        setStudents360(res.students || []);
      } catch (err: any) {
        console.error('Error loading 360 student progress:', err);
        setError('No se pudo obtener el informe 360 de alumnos.');
      } finally {
        setLoading360(false);
      }
    };

    const timer = setTimeout(() => {
      fetch360Progress();
    }, 300);

    return () => clearTimeout(timer);
  }, [viewMode, search360]);

  // Filter students (Course View)
  const filteredStudents = students.filter(s => {
    const query = searchTerm.toLowerCase();
    const matchesQuery = s.alumnoNombre.toLowerCase().includes(query) || s.alumnoId.toLowerCase().includes(query) || (s.redeemedCode || '').toLowerCase().includes(query);

    if (!matchesQuery) return false;

    if (statusFilter === 'completed') return s.progressPercent === 100;
    if (statusFilter === 'in_progress') return s.progressPercent > 0 && s.progressPercent < 100;
    if (statusFilter === 'not_started') return s.progressPercent === 0;

    return true;
  });

  // Sort main table (Course View)
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.alumnoNombre.localeCompare(b.alumnoNombre);
    } else if (sortField === 'progress') {
      cmp = a.progressPercent - b.progressPercent;
    } else if (sortField === 'classes') {
      cmp = a.completedClassesCount - b.completedClassesCount;
    } else if (sortField === 'time') {
      cmp = a.totalActiveMinutes - b.totalActiveMinutes;
    } else if (sortField === 'lastActivity') {
      const tA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const tB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      cmp = tA - tB;
    } else if (sortField === 'enrolledAt') {
      const tA = a.enrolledAt ? new Date(a.enrolledAt).getTime() : 0;
      const tB = b.enrolledAt ? new Date(b.enrolledAt).getTime() : 0;
      cmp = tA - tB;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  // Sort detail classes table
  const getSortedClasses = (classList: CFStudentClassProgress[]) => {
    return [...classList].sort((a, b) => {
      let cmp = 0;
      if (classSortField === 'modulo') {
        cmp = a.modulo.localeCompare(b.modulo);
      } else if (classSortField === 'materia') {
        cmp = a.materia.localeCompare(b.materia);
      } else if (classSortField === 'status') {
        const order = { 'Realizada': 3, 'En Curso': 2, 'Pendiente': 1 };
        cmp = (order[a.status] || 0) - (order[b.status] || 0);
      } else if (classSortField === 'secondsActive') {
        cmp = a.secondsActive - b.secondsActive;
      }
      return classSortDirection === 'asc' ? cmp : -cmp;
    });
  };

  const handleExportCSV = () => {
    if (students.length === 0) return;

    const headers = ['ID Moodle', 'Nombre Alumno', 'Fecha Matriculacion', 'Codigo Canjeado', 'Progreso CF (%)', 'Clases Realizadas CF', 'Clases Totales', 'Tiempo Activo CF (min)', 'Ultima Actividad'];
    const rows = sortedStudents.map(s => [
      `"${s.alumnoId}"`,
      `"${s.alumnoNombre.replace(/"/g, '""')}"`,
      `"${s.enrolledAt ? new Date(s.enrolledAt).toLocaleString('es-AR') : 'Sin registro'}"`,
      `"${s.redeemedCode || '-'}"`,
      s.progressPercent,
      s.completedClassesCount,
      s.totalClassesCount,
      s.totalActiveMinutes,
      `"${s.lastActivity ? new Date(s.lastActivity).toLocaleString('es-AR') : 'Sin registro'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `seguimiento_cf_curso_${selectedCourseId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="animate-spin text-primary" />
        <span>Cargando datos de CourseFactory...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* View Mode Switcher Header */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setViewMode('course')}
          className={`btn ${viewMode === 'course' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600, padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem' }}
        >
          <BookOpen size={18} /> 📘 Vista por Curso
        </button>
        <button
          onClick={() => setViewMode('student360')}
          className={`btn ${viewMode === 'student360' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600, padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem' }}
        >
          <Users size={18} /> 👤 Vista 360° por Alumno
        </button>
      </div>

      {/* VIEW 1: COURSE CENTRIC VIEW */}
      {viewMode === 'course' && (
        <>
          {/* Header & Description */}
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Dashboard de Seguimiento de CourseFactory (Vista por Curso)
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Análisis de uso, retención y avance de alumnos por curso directamente en los reproductores e iframes embebidos.
            </p>
          </div>

          {/* Selectors, Filters & Actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Seleccionar Curso CourseFactory
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600, minWidth: '240px' }}
                >
                  {cfCourses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.shortname ? `(${c.shortname})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ position: 'relative', marginTop: '1.1rem' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar por alumno, ID o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ padding: '0.5rem 0.5rem 0.5rem 2.2rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem', width: '260px' }}
                />
              </div>

              <div style={{ marginTop: '1.1rem' }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                >
                  <option value="all">Estado: Todos los Alumnos</option>
                  <option value="completed">Completados (100%)</option>
                  <option value="in_progress">En Curso (&gt;0%)</option>
                  <option value="not_started">Sin Iniciar (0%)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleExportCSV}
              disabled={students.length === 0}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem 1rem', borderRadius: '8px', marginTop: '1.1rem' }}
            >
              <Download size={16} /> Exportar CSV
            </button>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.75rem', borderRadius: '10px' }}>
                <Users size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Alumnos Registrados CF</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.totalStudents}</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.75rem', borderRadius: '10px' }}>
                <BarChart2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Progreso Promedio CF</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.averageProgress}%</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: '#fef3c7', color: '#d97706', padding: '0.75rem', borderRadius: '10px' }}>
                <CheckCircle size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Clases Realizadas CF</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.completedClassesTotal}</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: '#fae8ff', color: '#c026d3', padding: '0.75rem', borderRadius: '10px' }}>
                <Clock size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Alumnos Activos CF</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.activeStudents}</div>
              </div>
            </div>
          </div>

          {/* Main Student Progress Table */}
          {loadingProgress ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Loader2 size={28} className="animate-spin text-primary" />
              <span>Cargando avance de los alumnos...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '1.5rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '0.9rem' }}>
              {error}
            </div>
          ) : sortedStudents.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              No se encontraron alumnos registrados para este curso o filtro.
            </div>
          ) : (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                      <th style={{ width: '40px', padding: '0.75rem 0.5rem', textAlign: 'center' }}></th>
                      <th
                        onClick={() => handleSort('name')}
                        style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none', color: sortField === 'name' ? 'var(--primary)' : 'inherit' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Alumno / ID Moodle {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('enrolledAt')}
                        style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none', color: sortField === 'enrolledAt' ? 'var(--primary)' : 'inherit' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Fecha Matriculación {sortField === 'enrolledAt' ? (sortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('progress')}
                        style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none', color: sortField === 'progress' ? 'var(--primary)' : 'inherit' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Progreso CF {sortField === 'progress' ? (sortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('classes')}
                        style={{ padding: '0.75rem 1rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', color: sortField === 'classes' ? 'var(--primary)' : 'inherit' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Clases Realizadas {sortField === 'classes' ? (sortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('time')}
                        style={{ padding: '0.75rem 1rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', color: sortField === 'time' ? 'var(--primary)' : 'inherit' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Tiempo Activo CF {sortField === 'time' ? (sortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('lastActivity')}
                        style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none', color: sortField === 'lastActivity' ? 'var(--primary)' : 'inherit' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Última Actividad {sortField === 'lastActivity' ? (sortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                        </span>
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map(student => {
                      const isExpanded = expandedStudentId === student.alumnoId;
                      const sortedClasses = getSortedClasses(student.classes || []);

                      return (
                        <React.Fragment key={student.alumnoId}>
                          <tr style={{ borderBottom: '1px solid var(--border)', background: isExpanded ? 'var(--bg-tertiary)' : 'transparent' }}>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                              <button
                                onClick={() => setExpandedStudentId(isExpanded ? null : student.alumnoId)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                              >
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                            </td>

                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {student.alumnoNombre}
                                {student.redeemedCode && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '4px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 600 }}>
                                    <Unlock size={10} /> {student.redeemedCode}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {student.alumnoId}</div>
                            </td>

                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                              {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin registro'}
                            </td>

                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 700, width: '36px', textAlign: 'right', color: student.progressPercent === 100 ? '#10b981' : 'var(--text-main)' }}>
                                  {student.progressPercent}%
                                </span>
                                <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                                  <div
                                    style={{
                                      width: `${student.progressPercent}%`,
                                      height: '100%',
                                      background: student.progressPercent === 100 ? '#10b981' : student.progressPercent > 0 ? 'var(--primary)' : 'transparent',
                                      borderRadius: '3px',
                                      transition: 'width 0.3s ease'
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                              {student.completedClassesCount} / {student.totalClassesCount}
                            </td>

                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                              {student.totalActiveMinutes} min
                            </td>

                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {student.lastActivity ? new Date(student.lastActivity).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>

                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                <button
                                  onClick={() => {
                                    const currentView = activeViewMode[student.alumnoId] || 'progress';
                                    if (isExpanded && currentView === 'progress') {
                                      setExpandedStudentId(null);
                                    } else {
                                      setExpandedStudentId(student.alumnoId);
                                      setActiveViewMode(prev => ({ ...prev, [student.alumnoId]: 'progress' }));
                                    }
                                  }}
                                  className={`btn btn-xs ${isExpanded && (activeViewMode[student.alumnoId] || 'progress') === 'progress' ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px' }}
                                >
                                  {isExpanded && (activeViewMode[student.alumnoId] || 'progress') === 'progress' ? 'Ocultar' : 'Ver Desglose'}
                                </button>
                                <button
                                  onClick={() => {
                                    const currentView = activeViewMode[student.alumnoId] || 'progress';
                                    if (isExpanded && currentView === 'schedule') {
                                      setExpandedStudentId(null);
                                    } else {
                                      setExpandedStudentId(student.alumnoId);
                                      setActiveViewMode(prev => ({ ...prev, [student.alumnoId]: 'schedule' }));
                                    }
                                  }}
                                  className={`btn btn-xs ${isExpanded && (activeViewMode[student.alumnoId] || 'progress') === 'schedule' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                  style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Calendar size={12} /> Calendarización
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Breakdown / Calendarization View */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} style={{ padding: '1rem 1.5rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem' }}>
                                  
                                  {/* Tab Selector Header */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                      <button
                                        onClick={() => setActiveViewMode(prev => ({ ...prev, [student.alumnoId]: 'progress' }))}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          borderBottom: (activeViewMode[student.alumnoId] || 'progress') === 'progress' ? '2px solid var(--primary)' : '2px solid transparent',
                                          color: (activeViewMode[student.alumnoId] || 'progress') === 'progress' ? 'var(--primary)' : 'var(--text-muted)',
                                          fontWeight: (activeViewMode[student.alumnoId] || 'progress') === 'progress' ? 700 : 500,
                                          padding: '4px 8px',
                                          cursor: 'pointer',
                                          fontSize: '0.85rem',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px'
                                        }}
                                      >
                                        <BookOpen size={16} /> Avance Clase por Clase
                                      </button>
                                      <button
                                        onClick={() => setActiveViewMode(prev => ({ ...prev, [student.alumnoId]: 'schedule' }))}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          borderBottom: (activeViewMode[student.alumnoId] || 'progress') === 'schedule' ? '2px solid var(--primary)' : '2px solid transparent',
                                          color: (activeViewMode[student.alumnoId] || 'progress') === 'schedule' ? 'var(--primary)' : 'var(--text-muted)',
                                          fontWeight: (activeViewMode[student.alumnoId] || 'progress') === 'schedule' ? 700 : 500,
                                          padding: '4px 8px',
                                          cursor: 'pointer',
                                          fontSize: '0.85rem',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px'
                                        }}
                                      >
                                        <Calendar size={16} /> Informe de Calendarización Programada
                                      </button>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      Alumno: <strong>{student.alumnoNombre}</strong> (ID: {student.alumnoId})
                                    </span>
                                  </div>

                                  {(activeViewMode[student.alumnoId] || 'progress') === 'progress' ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                          <th
                                            onClick={() => handleClassSort('modulo')}
                                            style={{ padding: '0.5rem', cursor: 'pointer', userSelect: 'none', color: classSortField === 'modulo' ? 'var(--primary)' : 'inherit' }}
                                          >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                              Módulo / Clase CF {classSortField === 'modulo' ? (classSortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                                            </span>
                                          </th>
                                          <th
                                            onClick={() => handleClassSort('materia')}
                                            style={{ padding: '0.5rem', cursor: 'pointer', userSelect: 'none', color: classSortField === 'materia' ? 'var(--primary)' : 'inherit' }}
                                          >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                              Materia {classSortField === 'materia' ? (classSortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                                            </span>
                                          </th>
                                          <th
                                            onClick={() => handleClassSort('status')}
                                            style={{ padding: '0.5rem', cursor: 'pointer', userSelect: 'none', color: classSortField === 'status' ? 'var(--primary)' : 'inherit' }}
                                          >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                              Estado {classSortField === 'status' ? (classSortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                                            </span>
                                          </th>
                                          <th
                                            onClick={() => handleClassSort('secondsActive')}
                                            style={{ padding: '0.5rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: classSortField === 'secondsActive' ? 'var(--primary)' : 'inherit' }}
                                          >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                              Tiempo Activo {classSortField === 'secondsActive' ? (classSortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                                            </span>
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sortedClasses.map((cls, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>{cls.modulo}</td>
                                            <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{cls.materia || '-'}</td>
                                            <td style={{ padding: '0.5rem' }}>
                                              {cls.status === 'Realizada' ? (
                                                <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                  <CheckCircle size={14} /> Realizada
                                                </span>
                                              ) : cls.status === 'En Curso' ? (
                                                <span style={{ color: '#f59e0b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                  <Clock size={14} /> En Curso
                                                </span>
                                              ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>Pendiente</span>
                                              )}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                                              {cls.timeSpentFormatted}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    /* Calendarization Report Sub-Table */
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                          <th style={{ padding: '0.5rem' }}>Módulo / Clase CF</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Día de inicio (Panel 1)</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Fecha Disponibilización</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Fecha Primer Ingreso</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Estado</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sortedClasses.map((cls, idx) => {
                                          const availStatus = cls.availabilityStatus || (cls.status === 'Realizada' ? 'Realizada' : cls.status === 'En Curso' ? 'En Curso' : 'Disponible');
                                          const releaseDateStr = cls.calculatedReleaseDate
                                            ? new Date(cls.calculatedReleaseDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                            : (cls.fechaDisponibilidad || '-');

                                          const firstAccessStr = cls.firstAccessAt
                                            ? new Date(cls.firstAccessAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                            : '- Sin ingreso';

                                          return (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                              <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                {cls.modulo}
                                                {cls.materia && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{cls.materia}</div>}
                                              </td>
                                              <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>
                                                {cls.diasDisponibilidad != null ? `${cls.diasDisponibilidad} días` : (cls.fechaDisponibilidad || 'Día 0')}
                                              </td>
                                              <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                {releaseDateStr}
                                              </td>
                                              <td style={{ padding: '0.5rem', textAlign: 'center', color: cls.firstAccessAt ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                {firstAccessStr}
                                              </td>
                                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                {availStatus === 'Realizada' ? (
                                                  <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <CheckCircle size={13} /> Realizada
                                                  </span>
                                                ) : availStatus === 'En Curso' ? (
                                                  <span style={{ color: '#d97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fffbeb', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <Clock size={13} /> En Curso
                                                  </span>
                                                ) : availStatus === 'Disponible' ? (
                                                  <span style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <Unlock size={13} /> Disponible
                                                  </span>
                                                ) : (
                                                  <span style={{ color: '#6b7280', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <Lock size={13} /> Bloqueada
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* VIEW 2: STUDENT 360° CENTRIC VIEW */}
      {viewMode === 'student360' && (
        <>
          {/* Header & Description */}
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Dashboard de Seguimiento 360° por Alumno
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Inspección integral por alumno: visualiza todos los cursos inscriptos, progreso global, desglose por materias y calendarización programada.
            </p>
          </div>

          {/* Search Bar */}
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por Nombre del alumno, ID Moodle o Email..."
                value={search360}
                onChange={(e) => setSearch360(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.9rem' }}
              />
            </div>
            {loading360 && <Loader2 size={20} className="animate-spin text-primary" />}
          </div>

          {/* Student 360 Accordion List */}
          {loading360 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Loader2 size={28} className="animate-spin text-primary" />
              <span>Cargando perfil 360 de los alumnos...</span>
            </div>
          ) : students360.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              No se encontraron alumnos que coincidan con la búsqueda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {students360.map(st => {
                const isStudentExpanded = expanded360StudentId === st.alumnoId;

                return (
                  <div key={st.alumnoId} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                    {/* Student Row Header */}
                    <div
                      onClick={() => setExpanded360StudentId(isStudentExpanded ? null : st.alumnoId)}
                      style={{
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isStudentExpanded ? 'var(--bg-tertiary)' : 'transparent',
                        transition: 'background 0.2s ease',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '50%', padding: '8px', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <GraduationCap size={22} />
                        </div>
                        <div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {st.alumnoNombre}
                            <span style={{ fontSize: '0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              ID Moodle: {st.alumnoId}
                            </span>
                          </div>
                          {st.email && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{st.email}</div>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Cursos inscriptos: </span>
                          <strong style={{ color: 'var(--primary)' }}>{st.totalCourses} curso(s)</strong>
                        </div>

                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Tiempo Activo Total: </span>
                          <strong>{st.totalActiveMinutes} min</strong>
                        </div>

                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Última actividad: </span>
                          <span>{st.lastActivity ? new Date(st.lastActivity).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</span>
                        </div>

                        <div style={{ color: 'var(--text-muted)' }}>
                          {isStudentExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* Student Expanded Courses View */}
                    {isStudentExpanded && (
                      <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Cursos del Alumno ({st.courses.length})
                        </h4>

                        {st.courses.map(crs => {
                          const courseKey = `${st.alumnoId}_${crs.courseId}`;
                          const isCourseExpanded = expanded360CourseId[st.alumnoId] === crs.courseId;
                          const subViewMode = active360SubView[courseKey] || 'progress';
                          const sortedClasses = getSortedClasses(crs.classes || []);

                          return (
                            <div key={crs.courseId} style={{ border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                              {/* Course Card Header */}
                              <div style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderBottom: isCourseExpanded ? '1px solid var(--border)' : 'none' }}>
                                <div>
                                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <BookOpen size={18} className="text-primary" />
                                    {crs.courseName}
                                    {crs.moodleCourseId && (
                                      <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                                        Moodle: {crs.moodleCourseId}
                                      </span>
                                    )}
                                    {crs.redeemedCode && (
                                      <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', border: '1px solid #86efac' }}>
                                        <Unlock size={11} /> {crs.redeemedCode}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Fecha Matriculación en este curso: <strong>{crs.enrolledAt ? new Date(crs.enrolledAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin registro'}</strong>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                  {/* Progress Bar */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', width: '36px', textAlign: 'right', color: crs.progressPercent === 100 ? '#10b981' : 'var(--text-main)' }}>
                                      {crs.progressPercent}%
                                    </span>
                                    <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          width: `${crs.progressPercent}%`,
                                          height: '100%',
                                          background: crs.progressPercent === 100 ? '#10b981' : crs.progressPercent > 0 ? 'var(--primary)' : 'transparent',
                                          borderRadius: '3px'
                                        }}
                                      />
                                    </div>
                                  </div>

                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                    {crs.completedClassesCount} / {crs.totalClassesCount} clases
                                  </div>

                                  {/* Actions */}
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      onClick={() => {
                                        if (isCourseExpanded && subViewMode === 'progress') {
                                          setExpanded360CourseId(prev => ({ ...prev, [st.alumnoId]: null }));
                                        } else {
                                          setExpanded360CourseId(prev => ({ ...prev, [st.alumnoId]: crs.courseId }));
                                          setActive360SubView(prev => ({ ...prev, [courseKey]: 'progress' }));
                                        }
                                      }}
                                      className={`btn btn-xs ${isCourseExpanded && subViewMode === 'progress' ? 'btn-primary' : 'btn-secondary'}`}
                                      style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '6px' }}
                                    >
                                      {isCourseExpanded && subViewMode === 'progress' ? 'Ocultar' : 'Ver Desglose'}
                                    </button>

                                    <button
                                      onClick={() => {
                                        if (isCourseExpanded && subViewMode === 'schedule') {
                                          setExpanded360CourseId(prev => ({ ...prev, [st.alumnoId]: null }));
                                        } else {
                                          setExpanded360CourseId(prev => ({ ...prev, [st.alumnoId]: crs.courseId }));
                                          setActive360SubView(prev => ({ ...prev, [courseKey]: 'schedule' }));
                                        }
                                      }}
                                      className={`btn btn-xs ${isCourseExpanded && subViewMode === 'schedule' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                      style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Calendar size={13} /> Calendarización
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Course Sub-Tables */}
                              {isCourseExpanded && (
                                <div style={{ padding: '1rem', background: 'var(--bg-primary)' }}>
                                  {/* Sub-view switcher */}
                                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                    <button
                                      onClick={() => setActive360SubView(prev => ({ ...prev, [courseKey]: 'progress' }))}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: subViewMode === 'progress' ? '2px solid var(--primary)' : '2px solid transparent',
                                        color: subViewMode === 'progress' ? 'var(--primary)' : 'var(--text-muted)',
                                        fontWeight: subViewMode === 'progress' ? 700 : 500,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <BookOpen size={14} /> Avance Clase por Clase
                                    </button>
                                    <button
                                      onClick={() => setActive360SubView(prev => ({ ...prev, [courseKey]: 'schedule' }))}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: subViewMode === 'schedule' ? '2px solid var(--primary)' : '2px solid transparent',
                                        color: subViewMode === 'schedule' ? 'var(--primary)' : 'var(--text-muted)',
                                        fontWeight: subViewMode === 'schedule' ? 700 : 500,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <Calendar size={14} /> Informe de Calendarización Programada
                                    </button>
                                  </div>

                                  {subViewMode === 'progress' ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                          <th style={{ padding: '0.5rem' }}>Módulo / Clase CF</th>
                                          <th style={{ padding: '0.5rem' }}>Materia</th>
                                          <th style={{ padding: '0.5rem' }}>Estado</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Tiempo Activo</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sortedClasses.map((cls, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>{cls.modulo}</td>
                                            <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{cls.materia || '-'}</td>
                                            <td style={{ padding: '0.5rem' }}>
                                              {cls.status === 'Realizada' ? (
                                                <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                  <CheckCircle size={14} /> Realizada
                                                </span>
                                              ) : cls.status === 'En Curso' ? (
                                                <span style={{ color: '#f59e0b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                  <Clock size={14} /> En Curso
                                                </span>
                                              ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>Pendiente</span>
                                              )}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                                              {cls.timeSpentFormatted}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                          <th style={{ padding: '0.5rem' }}>Módulo / Clase CF</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Día de inicio (Panel 1)</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Fecha Disponibilización</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Fecha Primer Ingreso</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Estado</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sortedClasses.map((cls, idx) => {
                                          const availStatus = cls.availabilityStatus || (cls.status === 'Realizada' ? 'Realizada' : cls.status === 'En Curso' ? 'En Curso' : 'Disponible');
                                          const releaseDateStr = cls.calculatedReleaseDate
                                            ? new Date(cls.calculatedReleaseDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                            : (cls.fechaDisponibilidad || '-');

                                          const firstAccessStr = cls.firstAccessAt
                                            ? new Date(cls.firstAccessAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                            : '- Sin ingreso';

                                          return (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                              <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                {cls.modulo}
                                                {cls.materia && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{cls.materia}</div>}
                                              </td>
                                              <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>
                                                {cls.diasDisponibilidad != null ? `${cls.diasDisponibilidad} días` : (cls.fechaDisponibilidad || 'Día 0')}
                                              </td>
                                              <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                {releaseDateStr}
                                              </td>
                                              <td style={{ padding: '0.5rem', textAlign: 'center', color: cls.firstAccessAt ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                {firstAccessStr}
                                              </td>
                                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                {availStatus === 'Realizada' ? (
                                                  <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <CheckCircle size={13} /> Realizada
                                                  </span>
                                                ) : availStatus === 'En Curso' ? (
                                                  <span style={{ color: '#d97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fffbeb', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <Clock size={13} /> En Curso
                                                  </span>
                                                ) : availStatus === 'Disponible' ? (
                                                  <span style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <Unlock size={13} /> Disponible
                                                  </span>
                                                ) : (
                                                  <span style={{ color: '#6b7280', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <Lock size={13} /> Bloqueada
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
