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
  Filter,
  Loader2,
  GraduationCap
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

    const headers = ['ID Moodle', 'Nombre Alumno', 'Progreso (%)', 'Clases Realizadas', 'Clases Totales', 'Tiempo Activo (min)', 'Última Actividad'];
    const rows = filteredStudents.map(s => [
      `"${s.alumnoId}"`,
      `"${s.alumnoNombre.replace(/"/g, '""')}"`,
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
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          background: 'var(--bg-secondary)',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          border: '1px solid var(--border)'
        }}
      >
        {/* Course Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          <GraduationCap size={22} style={{ color: 'var(--primary)' }} />
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
              SELECCIONAR CURSO MOODLE
            </label>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                fontWeight: 600,
                minWidth: '280px',
                cursor: 'pointer'
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
        </div>

        {/* Export Button */}
        <button
          onClick={handleExportCSV}
          disabled={filteredStudents.length === 0}
          className="btn btn-secondary btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            borderRadius: '8px',
            cursor: filteredStudents.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div style={{ background: 'rgba(20, 184, 166, 0.1)', padding: '0.75rem', borderRadius: '10px', color: '#14b8a6' }}>
            <Users size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Alumnos Registrados
            </span>
            <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{totalStudents}</h3>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '10px', color: '#3b82f6' }}>
            <BarChart2 size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Progreso Promedio
            </span>
            <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{avgProgress}%</h3>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '10px', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Clases Realizadas
            </span>
            <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{totalClassesCompletedSum}</h3>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '10px', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Alumnos Activos
            </span>
            <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{activeStudents}</h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar alumno por nombre o ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.8rem 0.5rem 2.2rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-main)',
              fontSize: '0.85rem'
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estado:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">Todos los Alumnos</option>
            <option value="completed">Finalizado (100%)</option>
            <option value="in_progress">En Curso (&gt;0%)</option>
            <option value="not_started">Sin Iniciar (0%)</option>
          </select>
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
      ) : filteredStudents.length === 0 ? (
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
                <th style={{ padding: '0.75rem 1rem', width: '40px' }}></th>
                <th style={{ padding: '0.75rem 1rem' }}>Alumno / ID Moodle</th>
                <th style={{ padding: '0.75rem 1rem', width: '220px' }}>Progreso del Curso</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Clases Realizadas</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tiempo Activo</th>
                <th style={{ padding: '0.75rem 1rem' }}>Última Actividad</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => {
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
                        <td colSpan={7} style={{ padding: '1rem 1.5rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
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
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}># / Clase</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Materia</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Estado</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Tiempo Dedicado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {student.classes.map((cls, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        {idx + 1}. {cls.modulo}
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
