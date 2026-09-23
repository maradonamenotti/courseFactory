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
  Loader2
} from 'lucide-react';
import { reportsApi } from '../services/api';

interface MoodleCourseItem {
  id: number | string;
  name: string;
  shortname?: string;
}

interface StudentClassProgress {
  modulo: string;
  materia: string;
  status: 'Realizada' | 'En Curso' | 'Pendiente';
  secondsActive: number;
  timeSpentFormatted: string;
}

interface StudentProgressItem {
  alumnoId: string;
  alumnoNombre: string;
  completedClassesCount: number;
  totalClassesCount: number;
  progressPercent: number;
  totalActiveMinutes: number;
  lastActivity: string;
  enrolledAt?: string | null;
  classes: StudentClassProgress[];
}

interface StudentProgressPanelProps {
  courses?: Array<{ id: string; name: string }>;
  initialCourseId?: string;
}

export const StudentProgressPanel: React.FC<StudentProgressPanelProps> = ({
  courses = [],
  initialCourseId = ''
}) => {
  const [moodleCourses, setMoodleCourses] = useState<MoodleCourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentProgressItem[]>([]);
  const [totalClasses, setTotalClasses] = useState<number>(0);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all');

  // Main table sorting
  const [sortField, setSortField] = useState<'name' | 'progress' | 'classes' | 'time' | 'lastActivity' | 'enrolledAt'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Detail table sorting (Avance Clase por Clase)
  const [classSortField, setClassSortField] = useState<'modulo' | 'materia' | 'status' | 'secondsActive'>('modulo');
  const [classSortDirection, setClassSortDirection] = useState<'asc' | 'desc'>('asc');

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

  // Load courses list
  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoading(true);
        const res = await reportsApi.getMoodleCourses();
        const combined: MoodleCourseItem[] = [];

        // Add local courses first
        if (courses.length > 0) {
          courses.forEach(c => combined.push({ id: c.id, name: c.name }));
        } else if (res.localCourses && res.localCourses.length > 0) {
          res.localCourses.forEach(c => combined.push({ id: c.id, name: c.name }));
        }

        // Add Moodle WS courses
        if (res.moodleCourses && res.moodleCourses.length > 0) {
          res.moodleCourses.forEach(mc => {
            if (!combined.some(c => String(c.id) === String(mc.id))) {
              combined.push({ id: String(mc.id), name: mc.fullname, shortname: mc.shortname });
            }
          });
        }

        setMoodleCourses(combined);

        // Select initial course
        if (!selectedCourseId && combined.length > 0) {
          setSelectedCourseId(String(combined[0].id));
        }
      } catch (err: any) {
        console.error('Error loading Moodle courses:', err);
        setError('No se pudieron cargar los cursos de Moodle.');
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  // Load student progress for selected course
  useEffect(() => {
    if (!selectedCourseId) return;

    const loadProgress = async () => {
      try {
        setLoadingProgress(true);
        setError(null);
        const res = await reportsApi.getMoodleStudentProgress(selectedCourseId);
        setStudents(res.students || []);
        setTotalClasses(res.totalClasses || 0);
      } catch (err: any) {
        console.error('Error loading student progress:', err);
        setError('Error al obtener el avance de los alumnos para este curso.');
      } finally {
        setLoadingProgress(false);
      }
    };

    loadProgress();
  }, [selectedCourseId]);

  const toggleExpandStudent = (alumnoId: string) => {
    setExpandedStudentId(prev => (prev === alumnoId ? null : alumnoId));
  };

  // Filtering
  const filteredStudents = students.filter(s => {
    const matchesSearch =
      s.alumnoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.alumnoId.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'completed') return s.progressPercent === 100;
    if (statusFilter === 'in_progress') return s.progressPercent > 0 && s.progressPercent < 100;
    if (statusFilter === 'not_started') return s.progressPercent === 0;

    return true;
  });

  // Sorting main student list
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = (a.alumnoNombre || a.alumnoId || '').localeCompare(b.alumnoNombre || b.alumnoId || '', undefined, { sensitivity: 'base' });
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

  // Helper for sorting class-by-class breakdown
  const getSortedClasses = (classes: StudentClassProgress[]) => {
    return [...classes].sort((a, b) => {
      let cmp = 0;
      if (classSortField === 'modulo') {
        cmp = (a.modulo || '').localeCompare(b.modulo || '', undefined, { numeric: true, sensitivity: 'base' });
      } else if (classSortField === 'materia') {
        cmp = (a.materia || 'General').localeCompare(b.materia || 'General', undefined, { sensitivity: 'base' });
      } else if (classSortField === 'status') {
        const statusWeight = (s: string) => {
          if (s === 'Realizada') return 3;
          if (s === 'En Curso') return 2;
          return 1;
        };
        cmp = statusWeight(a.status) - statusWeight(b.status);
      } else if (classSortField === 'secondsActive') {
        let secA = a.secondsActive || 0;
        let secB = b.secondsActive || 0;
        if (secA === 0 && a.status === 'Realizada') secA = 0.5;
        if (secB === 0 && b.status === 'Realizada') secB = 0.5;
        cmp = secA - secB;
      }

      if (cmp === 0) {
        cmp = (a.modulo || '').localeCompare(b.modulo || '', undefined, { numeric: true, sensitivity: 'base' });
      }

      return classSortDirection === 'asc' ? cmp : -cmp;
    });
  };

  // KPIs
  const totalStudents = students.length;
  const avgProgress =
    totalStudents > 0
      ? Math.round(students.reduce((acc, s) => acc + s.progressPercent, 0) / totalStudents)
      : 0;
  const totalClassesCompletedSum = students.reduce((acc, s) => acc + s.completedClassesCount, 0);
  const activeStudents = students.filter(s => s.progressPercent > 0).length;

  // CSV Export
  const handleExportCSV = () => {
    if (students.length === 0) return;

    const headers = ['ID Moodle', 'Nombre Alumno', 'Fecha Matriculacion', 'Progreso (%)', 'Clases Realizadas', 'Clases Totales', 'Tiempo Activo (min)', 'Ultima Actividad'];
    const rows = sortedStudents.map(s => [
      `"${s.alumnoId}"`,
      `"${s.alumnoNombre.replace(/"/g, '""')}"`,
      `"${s.enrolledAt ? new Date(s.enrolledAt).toLocaleString('es-AR') : 'Sin registro'}"`,
      s.progressPercent,
      s.completedClassesCount,
      s.totalClassesCount,
      s.totalActiveMinutes,
      `"${new Date(s.lastActivity).toLocaleString('es-AR')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `avance_alumnos_curso_${selectedCourseId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 size={40} className="spin text-primary" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
        <h3>Cargando Panel de Alumnos Moodle...</h3>
        <p style={{ color: 'var(--text-muted)' }}>Obteniendo nómina de cursos y alumnos...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', padding: '1rem 0' }}>
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ minWidth: '280px', flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Seleccionar Curso Moodle
            </label>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            >
              {moodleCourses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.shortname ? `(${c.shortname})` : ''}
                </option>
              ))}
            </select>
            {totalClasses > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginLeft: '0.75rem' }}>
                {totalClasses} clases en este curso
              </span>
            )}
          </div>

          <div style={{ position: 'relative', minWidth: '220px', flex: 1, marginTop: '1.25rem' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por alumno o ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                fontSize: '0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ minWidth: '160px', marginTop: '1.25rem' }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            >
              <option value="all">Estado: Todos los Alumnos</option>
              <option value="completed">Estado: Completados (100%)</option>
              <option value="in_progress">Estado: En Avance (1-99%)</option>
              <option value="not_started">Estado: Sin Iniciar (0%)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={students.length === 0}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            padding: '0.5rem 1rem',
            marginTop: '1.25rem',
            opacity: students.length === 0 ? 0.5 : 1
          }}
        >
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(20, 184, 166, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Alumnos Registrados</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{totalStudents}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <BarChart2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Progreso Promedio</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{avgProgress}%</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Clases Realizadas</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{totalClassesCompletedSum}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Alumnos Activos</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{activeStudents}</div>
          </div>
        </div>
      </div>

      {/* Error / Loading / Student Progress Table */}
      {error ? (
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#ef4444',
            textAlign: 'center'
          }}
        >
          {error}
        </div>
      ) : loadingProgress ? (
        <div style={{ height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Loader2 size={32} className="spin text-primary" style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Calculando avance clase por clase...</p>
        </div>
      ) : sortedStudents.length === 0 ? (
        <div
          style={{
            padding: '3rem',
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}
        >
          <BookOpen size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <h4>No se encontraron registros de alumnos</h4>
          <p style={{ fontSize: '0.85rem' }}>
            {searchTerm || statusFilter !== 'all'
              ? 'Intentá cambiar los criterios de búsqueda o el filtro seleccionado.'
              : 'Todavía no hay eventos registrados de alumnos en este curso Moodle.'}
          </p>
        </div>
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.5rem 0.75rem 1rem', width: '40px' }}></th>
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
                  style={{ padding: '0.75rem 1rem', width: '220px', cursor: 'pointer', userSelect: 'none', color: sortField === 'progress' ? 'var(--primary)' : 'inherit' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Progreso del Curso {sortField === 'progress' ? (sortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('classes')}
                  style={{ padding: '0.75rem 1rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', color: sortField === 'classes' ? 'var(--primary)' : 'inherit' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center', width: '100%' }}>
                    Clases Realizadas {sortField === 'classes' ? (sortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('time')}
                  style={{ padding: '0.75rem 1rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', color: sortField === 'time' ? 'var(--primary)' : 'inherit' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center', width: '100%' }}>
                    Tiempo Activo {sortField === 'time' ? (sortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
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

                return (
                  <React.Fragment key={student.alumnoId}>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isExpanded ? 'rgba(20, 184, 166, 0.04)' : 'var(--bg-primary)',
                        transition: 'background 0.2s'
                      }}
                    >
                      <td style={{ padding: '0.75rem 0.5rem 0.75rem 1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => toggleExpandStudent(student.alumnoId)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                        >
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{student.alumnoNombre}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {student.alumnoId}</div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin registro'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: student.progressPercent === 100 ? '#10b981' : 'var(--text-main)' }}>
                            {student.progressPercent}%
                          </span>
                          {student.progressPercent === 100 && (
                            <span style={{ fontSize: '0.7rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              Completo ✓
                            </span>
                          )}
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${student.progressPercent}%`,
                              height: '100%',
                              background: student.progressPercent === 100 ? '#10b981' : 'var(--primary)',
                              borderRadius: '4px',
                              transition: 'width 0.3s'
                            }}
                          />
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                        {student.completedClassesCount} / {student.totalClassesCount}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {student.totalActiveMinutes > 0 ? `${student.totalActiveMinutes} min` : '0 min'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {student.lastActivity ? new Date(student.lastActivity).toLocaleString('es-AR') : 'Sin registro'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => toggleExpandStudent(student.alumnoId)}
                          className="btn btn-sm btn-secondary"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.6rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {isExpanded ? 'Ocultar' : 'Ver Desglose'}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Class-by-Class Breakdown */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: '1rem 1.5rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <BookOpen size={16} style={{ color: 'var(--primary)' }} />
                              Avance Clase por Clase de {student.alumnoNombre}
                            </h4>

                            {student.classes.length === 0 ? (
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No hay detalle de clases cargado para este curso.</p>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    <th
                                      onClick={() => handleClassSort('modulo')}
                                      style={{ padding: '0.4rem 0.6rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', color: classSortField === 'modulo' ? 'var(--primary)' : 'inherit' }}
                                    >
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        # / Clase {classSortField === 'modulo' ? (classSortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                                      </span>
                                    </th>
                                    <th
                                      onClick={() => handleClassSort('materia')}
                                      style={{ padding: '0.4rem 0.6rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', color: classSortField === 'materia' ? 'var(--primary)' : 'inherit' }}
                                    >
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        Materia {classSortField === 'materia' ? (classSortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                                      </span>
                                    </th>
                                    <th
                                      onClick={() => handleClassSort('status')}
                                      style={{ padding: '0.4rem 0.6rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', color: classSortField === 'status' ? 'var(--primary)' : 'inherit' }}
                                    >
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center', width: '100%' }}>
                                        Estado {classSortField === 'status' ? (classSortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                                      </span>
                                    </th>
                                    <th
                                      onClick={() => handleClassSort('secondsActive')}
                                      style={{ padding: '0.4rem 0.6rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: classSortField === 'secondsActive' ? 'var(--primary)' : 'inherit' }}
                                    >
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                                        Tiempo Dedicado {classSortField === 'secondsActive' ? (classSortDirection === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>}
                                      </span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {getSortedClasses(student.classes).map((cls, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        {cls.modulo}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)' }}>
                                        {cls.materia || 'General'}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                                        {cls.status === 'Realizada' ? (
                                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.72rem' }}>
                                            Realizada ✓
                                          </span>
                                        ) : cls.status === 'En Curso' ? (
                                          <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.72rem' }}>
                                            En Curso ⏳
                                          </span>
                                        ) : (
                                          <span style={{ background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem' }}>
                                            Pendiente ⚪
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                                        {cls.timeSpentFormatted}
                                      </td>
                                    </tr>
                                  ))}
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
      )}
    </div>
  );
};
