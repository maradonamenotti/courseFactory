import React, { useEffect, useState } from 'react';
import { CheckCircle, BarChart2, Users, FileText, Activity, AlertCircle, Loader2, Award, Clock, LogIn, MousePointer, ChevronRight } from 'lucide-react';
import { reportsApi } from '../services/api';

// Tipado de las métricas que devuelve el endpoint GET /api/reports/dashboard
interface DashboardData {
  kpis: {
    totalAccesses: number;
    uniqueStudents: number;
    completedClasses: number;
  };
  commercialUsage: Array<{
    licencia: string;
    materia: string;
    totalInteractions: number;
  }>;
  retentionFunnel: Array<{
    modulo: string;
    open: number;
    click_continuar: number;
    finish: number;
  }>;
  studentProgress: Array<{
    alumnoId: string;
    alumnoNombre: string | null;
    licencia: string;
    materia: string;
    startedClasses: number;
    completedClasses: number;
    lastActivity: string;
  }>;
  quizStats?: {
    kpis: {
      totalQuizzesCompleted: number;
      averageScore: number;
      passingRate: number;
    };
    quizPerformance: Array<{
      modulo: string;
      attempts: number;
      averageScore: number;
      passingAttempts: number;
      passingRate: number;
    }>;
    studentQuizzes: Array<{
      alumnoId: string;
      alumnoNombre: string | null;
      modulo: string;
      score: number;
      correctAnswers: number;
      totalQuestions: number;
      passed: boolean;
      timestamp: string;
    }>;
  };
}

interface UserActivityReport {
  recentActivities: Array<{
    id: string;
    userId: string;
    userName: string;
    email: string;
    action: string;
    panelName?: string;
    courseId?: string;
    details?: string;
    timestamp: string;
  }>;
  userStats: Array<{
    email: string;
    name: string;
    logins: number;
    activeHours: number;
    lastActivity: string;
    mostVisitedPanel: string;
    totalActions: number;
  }>;
  panelActivity: Array<{
    panel: string;
    count: number;
  }>;
}

interface TrackingDashboardProps {
  courses?: Array<{
    id: string;
    name: string;
  }>;
}

const TrackingDashboard: React.FC<TrackingDashboardProps> = ({ courses = [] }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [userData, setUserData] = useState<UserActivityReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'quizzes' | 'users'>('general');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        const [reportData, userActivityData] = await Promise.all([
          reportsApi.getDashboard(selectedCourseId || undefined),
          reportsApi.getUserActivityReport()
        ]);
        setData(reportData);
        setUserData(userActivityData);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error al cargar reportes');
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [selectedCourseId]);

  if (loading) {
    return (
      <div className="panel-container empty-state animate-fade-in" style={{ height: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 size={40} className="spin text-primary" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
        <h3>Cargando Reportes de Analítica</h3>
        <p className="text-muted">Procesando y agrupando interacciones de alumnos...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel-container empty-state animate-fade-in" style={{ height: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <AlertCircle size={40} style={{ color: 'var(--status-in-progress)', marginBottom: '1rem' }} />
        <h3>Error al Cargar Analítica</h3>
        <p className="text-muted">{error || 'No se pudieron recuperar los datos de analítica.'}</p>
      </div>
    );
  }

  const { kpis, commercialUsage = [], retentionFunnel = [], studentProgress = [] } = data;

  // Encontrar el valor máximo de interacciones comerciales para calcular porcentajes de barras de progreso
  const maxInteractions = Math.max(...(commercialUsage || []).map(c => c.totalInteractions), 1);

  return (
    <div className="analytics-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem' }}>
      
      {/* ─── Header con Switcher de Pestañas ─── */}
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
        <div>
          <h3>Dashboard de Seguimiento Educativo</h3>
          <p className="text-muted">Análisis de uso, retención y evaluaciones de alumnos en Moodle por clase y licencia comercial.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {courses.length > 0 && (
            <div className="course-select-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 500 }}>Filtrar Curso:</span>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setExpandedStudentId(null);
                }}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  padding: '0.4rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">Todos los cursos</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="tab-buttons" style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button 
              className={`btn btn-sm ${activeSubTab === 'general' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ 
                padding: '0.4rem 1rem', 
                fontSize: '0.85rem', 
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeSubTab === 'general' ? 'var(--primary)' : 'transparent',
                color: activeSubTab === 'general' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveSubTab('general')}
            >
              General y Accesos
            </button>
            <button 
              className={`btn btn-sm ${activeSubTab === 'quizzes' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ 
                padding: '0.4rem 1rem', 
                fontSize: '0.85rem', 
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeSubTab === 'quizzes' ? 'var(--primary)' : 'transparent',
                color: activeSubTab === 'quizzes' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveSubTab('quizzes')}
            >
              Evaluaciones y Cuestionarios
            </button>
            <button 
              className={`btn btn-sm ${activeSubTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ 
                padding: '0.4rem 1rem', 
                fontSize: '0.85rem', 
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeSubTab === 'users' ? 'var(--primary)' : 'transparent',
                color: activeSubTab === 'users' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveSubTab('users')}
            >
              Uso del Sistema
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'general' && (
        <>
          {/* ─── KPI Cards Generales ─── */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            
            {/* KPI 1: Accesos Totales */}
            <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <div className="metric-icon" style={{ background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '8px' }}>
                <Activity size={24} />
              </div>
              <div className="metric-info">
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Accesos Totales</h4>
                <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.totalAccesses}</span>
              </div>
            </div>

            {/* KPI 2: Alumnos Únicos */}
            <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <div className="metric-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '0.75rem', borderRadius: '8px' }}>
                <Users size={24} />
              </div>
              <div className="metric-info">
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alumnos Únicos</h4>
                <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.uniqueStudents}</span>
              </div>
            </div>

            {/* KPI 3: Clases Finalizadas */}
            <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-available)', padding: '0.75rem', borderRadius: '8px' }}>
                <CheckCircle size={24} />
              </div>
              <div className="metric-info">
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Clases Finalizadas</h4>
                <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.completedClasses}</span>
              </div>
            </div>

            {/* KPI 4: Horas Dedicadas (solo cuando hay curso seleccionado) */}
            {selectedCourseId && (kpis as any).totalActiveHours !== undefined && (
              <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
                <div className="metric-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.75rem', borderRadius: '8px' }}>
                  <Clock size={24} />
                </div>
                <div className="metric-info">
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dedicación Total</h4>
                  <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{(kpis as any).totalActiveHours} hs</span>
                </div>
              </div>
            )}
          </div>

          {/* ─── Contenedor de Gráficos / Distribuciones ─── */}
          <div className="charts-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            
            {/* Embudo de Retención (Funnel por Clase) */}
            <div className="chart-card glass-panel" style={{ padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
                Embudo de Retención (Funnel por Clase)
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {retentionFunnel.length === 0 && <p className="text-muted">No hay datos de retención registrados</p>}
                {retentionFunnel.map((funnel, index) => {
                  const openRate = 100;
                  const continueRate = funnel.open > 0 ? Math.round((funnel.click_continuar / funnel.open) * 100) : 0;
                  const finishRate = funnel.open > 0 ? Math.round((funnel.finish / funnel.open) * 100) : 0;

                  return (
                    <div key={index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
                        {funnel.modulo}
                      </div>
                      
                      {/* Pasos del embudo */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Abiertos */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                          <span style={{ width: '80px', color: 'var(--text-muted)' }}>Abiertos:</span>
                          <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', height: '10px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${openRate}%`, background: 'var(--primary)', height: '100%' }} />
                          </div>
                          <span style={{ width: '60px', textAlign: 'right', fontWeight: 600 }}>{funnel.open} ({openRate}%)</span>
                        </div>

                        {/* Continuar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                          <span style={{ width: '80px', color: 'var(--text-muted)' }}>Continuar:</span>
                          <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', height: '10px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${continueRate}%`, background: '#818cf8', height: '100%' }} />
                          </div>
                          <span style={{ width: '60px', textAlign: 'right', fontWeight: 600 }}>{funnel.click_continuar} ({continueRate}%)</span>
                        </div>

                        {/* Finalizados */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                          <span style={{ width: '80px', color: 'var(--text-muted)' }}>Finalizados:</span>
                          <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', height: '10px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${finishRate}%`, background: 'var(--status-available)', height: '100%' }} />
                          </div>
                          <span style={{ width: '60px', textAlign: 'right', fontWeight: 600 }}>{funnel.finish} ({finishRate}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Uso Comercial por Cliente o Distribución de Progreso del Curso */}
            {selectedCourseId && (data as any).progressRanges ? (
              <div className="chart-card glass-panel" style={{ padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={18} style={{ color: '#00fff4' }} />
                  Distribución de Progreso del Curso
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {Object.entries((data as any).progressRanges).map(([range, count]: any) => {
                    const totalStudents = studentProgress.length || 1;
                    const pct = Math.round((count / totalStudents) * 100);
                    
                    let barColor = 'rgba(255,255,255,0.2)';
                    if (range === '81-100%') barColor = 'var(--status-available)';
                    else if (range === '61-80%') barColor = 'var(--primary)';
                    else if (range === '41-60%') barColor = '#818cf8';
                    else if (range === '21-40%') barColor = '#f59e0b';
                    else barColor = '#ef4444';

                    return (
                      <div key={range} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Rango {range}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {count} {count === 1 ? 'alumno' : 'alumnos'} ({pct}%)
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${pct}%`, 
                                background: barColor, 
                                height: '100%', 
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' 
                              }} 
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="chart-card glass-panel" style={{ padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={18} style={{ color: '#818cf8' }} />
                  Consumo por Licencia Comercial y Materia
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {commercialUsage.length === 0 && <p className="text-muted">No hay registros de consumo comercial</p>}
                  {commercialUsage.map((item, index) => {
                    const percentage = Math.round((item.totalInteractions / maxInteractions) * 100);

                    return (
                      <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.licencia}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.materia}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${percentage}%`, 
                                background: 'linear-gradient(90deg, #818cf8, var(--primary))', 
                                height: '100%', 
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' 
                              }} 
                            />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                            {item.totalInteractions}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ─── Avance por Alumno ─── */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px', marginTop: '0.5rem' }}>
            <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} style={{ color: 'var(--primary)' }} />
              Informe de Avance por Alumno en Moodle
            </h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alumno (ID Moodle)</th>
                    {!selectedCourseId && <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Licencia</th>}
                    {!selectedCourseId && <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Materia</th>}
                    {selectedCourseId && <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Progreso del Curso</th>}
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Clases Iniciadas</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Clases Completadas</th>
                    {selectedCourseId && <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Horas Dedicadas</th>}
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Última Actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {studentProgress.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay datos de avance de alumnos registrados.
                      </td>
                    </tr>
                  ) : (
                    studentProgress.map((item, index) => (
                      <React.Fragment key={index}>
                        <tr 
                          style={{ 
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)', 
                            transition: 'background-color 0.2s',
                            cursor: (item as any).roadmapClasses ? 'pointer' : 'default'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          onClick={() => {
                            if ((item as any).roadmapClasses) {
                              setExpandedStudentId(expandedStudentId === item.alumnoId ? null : item.alumnoId);
                            }
                          }}
                        >
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                                {(item.alumnoNombre || item.alumnoId).substring(0, 2).toUpperCase()}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {item.alumnoNombre || item.alumnoId}
                                  {(item as any).roadmapClasses && (
                                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: expandedStudentId === item.alumnoId ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                  )}
                                </span>
                                {item.alumnoNombre && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{item.alumnoId}</span>}
                              </div>
                            </div>
                          </td>
                          {!selectedCourseId && (
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                              <span className="badge badge-secondary" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                {item.licencia}
                              </span>
                            </td>
                          )}
                          {!selectedCourseId && <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.materia}</td>}
                          {selectedCourseId && (
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden', minWidth: '80px' }}>
                                  <div style={{ width: `${(item as any).progressPercent || 0}%`, background: 'var(--primary)', height: '100%' }} />
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{(item as any).progressPercent || 0}%</span>
                              </div>
                            </td>
                          )}
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-main)' }}>{item.startedClasses}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span 
                              style={{ 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: item.completedClasses > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                color: item.completedClasses > 0 ? 'var(--status-available)' : 'var(--text-muted)'
                              }}
                            >
                              {item.completedClasses}
                            </span>
                          </td>
                          {selectedCourseId && (
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-main)' }}>
                              {(item as any).activeHours || 0} hs
                            </td>
                          )}
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {new Date(item.lastActivity).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>

                        {expandedStudentId === item.alumnoId && (item as any).roadmapClasses && (
                          <tr style={{ background: 'rgba(255, 255, 255, 0.01)' }}>
                            <td colSpan={6} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <h5 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.85rem' }}>Hoja de Ruta del Estudiante</h5>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                                  {(item as any).roadmapClasses.map((rm: any, idx: number) => {
                                    let badgeBg = 'rgba(255, 255, 255, 0.05)';
                                    let badgeColor = 'var(--text-muted)';
                                    if (rm.status === 'Finalizado') {
                                      badgeBg = 'rgba(16, 185, 129, 0.1)';
                                      badgeColor = 'var(--status-available)';
                                    } else if (rm.status === 'Abierto') {
                                      badgeBg = 'rgba(0, 150, 143, 0.1)';
                                      badgeColor = '#00968f';
                                    }
                                    return (
                                      <div 
                                        key={idx} 
                                        style={{ 
                                          background: 'rgba(255, 255, 255, 0.02)', 
                                          border: '1px solid var(--border)', 
                                          borderRadius: '8px', 
                                          padding: '0.75rem',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center'
                                        }}
                                      >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{rm.moduloName}</span>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Recursos: {rm.openedCount} / {rm.totalCount}</span>
                                        </div>
                                        <span 
                                          style={{ 
                                            padding: '2px 8px', 
                                            borderRadius: '4px', 
                                            fontSize: '0.7rem', 
                                            fontWeight: 700, 
                                            background: badgeBg, 
                                            color: badgeColor,
                                            textTransform: 'uppercase'
                                          }}
                                        >
                                          {rm.status}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Guía de integración de gráficos Recharts / ChartJS ─── */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(20, 184, 166, 0.02)', border: '1px dashed var(--border)', borderRadius: '12px', marginTop: '1rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>💡 Guía de Integración con Librería de Gráficos (ej. Recharts)</h5>
            <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Si decides instalar <code>recharts</code>, puedes renderizar este embudo de forma nativa e interactiva mapeando directamente el objeto de respuesta del backend:<br />
              <code>
                {`<BarChart data={retentionFunnel}>\n  <XAxis dataKey="modulo" />\n  <Tooltip />\n  <Bar dataKey="open" fill="#14b8a6" name="Accesos" />\n  <Bar dataKey="click_continuar" fill="#818cf8" name="Clicks Continuar" />\n  <Bar dataKey="finish" fill="#10b981" name="Finalizados" />\n</BarChart>`}
              </code>
            </p>
          </div>
        </>
      )}

      {activeSubTab === 'quizzes' && (
        <>
          {/* ─── KPI Cards Cuestionarios ─── */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            
            {/* KPI 1: Cuestionarios Realizados */}
            <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <div className="metric-icon" style={{ background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '8px' }}>
                <FileText size={24} />
              </div>
              <div className="metric-info">
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cuestionarios Realizados</h4>
                <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {data.quizStats?.kpis.totalQuizzesCompleted || 0}
                </span>
              </div>
            </div>

            {/* KPI 2: Calificación Promedio */}
            <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <div className="metric-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '0.75rem', borderRadius: '8px' }}>
                <Award size={24} />
              </div>
              <div className="metric-info">
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Calificación Promedio</h4>
                <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {data.quizStats?.kpis.averageScore || 0}%
                </span>
              </div>
            </div>

            {/* KPI 3: Tasa de Aprobación */}
            <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-available)', padding: '0.75rem', borderRadius: '8px' }}>
                <CheckCircle size={24} />
              </div>
              <div className="metric-info">
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tasa de Aprobación</h4>
                <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {data.quizStats?.kpis.passingRate || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* ─── Rendimiento de Cuestionarios por Clase ─── */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px', marginTop: '0.5rem' }}>
            <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
              Rendimiento de Cuestionarios por Clase
            </h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clase / Módulo</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Intentos Realizados</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Calificación Promedio</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tasa de Aprobación</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.quizStats || data.quizStats.quizPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay datos de rendimiento por clase registrados.
                      </td>
                    </tr>
                  ) : (
                    data.quizStats.quizPerformance.map((item, index) => (
                      <tr 
                        key={index} 
                        style={{ 
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)', 
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {item.modulo}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-main)', fontWeight: 500 }}>
                          {item.attempts}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-main)', fontWeight: 600 }}>
                          <span style={{
                            color: item.averageScore >= 70 ? 'var(--status-available)' : 'var(--status-in-progress)'
                          }}>
                            {item.averageScore}%
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden', minWidth: '100px' }}>
                              <div 
                                style={{ 
                                  width: `${item.passingRate}%`, 
                                  background: item.passingRate >= 70 ? 'var(--status-available)' : 'var(--status-in-progress)', 
                                  height: '100%', 
                                }} 
                              />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '35px', color: item.passingRate >= 70 ? 'var(--status-available)' : 'var(--status-in-progress)' }}>
                              {item.passingRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Detalle de Intentos por Alumno ─── */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px', marginTop: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} style={{ color: 'var(--primary)' }} />
              Detalle de Intentos de Cuestionarios por Alumno
            </h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alumno (ID Moodle)</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clase / Módulo</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Calificación / Respuestas</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.quizStats || data.quizStats.studentQuizzes.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay intentos de cuestionarios registrados.
                      </td>
                    </tr>
                  ) : (
                    data.quizStats.studentQuizzes.map((item, index) => (
                      <tr 
                        key={index} 
                        style={{ 
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)', 
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                              {(item.alumnoNombre || item.alumnoId).substring(0, 2).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{item.alumnoNombre || item.alumnoId}</span>
                              {item.alumnoNombre && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{item.alumnoId}</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                          {item.modulo}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{item.score}%</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({item.correctAnswers} de {item.totalQuestions})</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span 
                            style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: item.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: item.passed ? 'var(--status-available)' : '#ef4444'
                            }}
                          >
                            {item.passed ? 'APROBADO' : 'DESAPROBADO'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(item.timestamp).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSubTab === 'users' && userData && (
        <>
          {/* ─── KPI Cards de Uso del Sistema ─── */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            
            {/* KPI 1: Acciones Totales */}
            <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <div className="metric-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '0.75rem', borderRadius: '8px' }}>
                <MousePointer size={24} />
              </div>
              <div className="metric-info">
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Acciones del Sistema</h4>
                <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {userData.recentActivities.length > 0 ? userData.userStats.reduce((acc, curr) => acc + curr.totalActions, 0) : 0}
                </span>
              </div>
            </div>

            {/* KPI 2: Tiempo de Uso Acumulado */}
            <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <div className="metric-icon" style={{ background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '8px' }}>
                <Clock size={24} />
              </div>
              <div className="metric-info">
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tiempo de Uso Total</h4>
                <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {userData.userStats.reduce((acc, curr) => acc + curr.activeHours, 0).toFixed(1)} h
                </span>
              </div>
            </div>

            {/* KPI 3: Usuarios Activos */}
            <div className="metric-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px' }}>
              <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-available)', padding: '0.75rem', borderRadius: '8px' }}>
                <Users size={24} />
              </div>
              <div className="metric-info">
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Usuarios Activos</h4>
                <span className="metric-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {userData.userStats.length}
                </span>
              </div>
            </div>
          </div>

          {/* ─── Tabla de Uso por Usuario ─── */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px', marginTop: '0.5rem' }}>
            <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} style={{ color: 'var(--primary)' }} />
              Estadísticas de Uso por Usuario
            </h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Usuario</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Accesos (Logins)</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Tiempo Activo</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Panel más Visitado</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Total Acciones</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Última Actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {userData.userStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay estadísticas de usuarios registradas.
                      </td>
                    </tr>
                  ) : (
                    userData.userStats.map((item, index) => (
                      <tr 
                        key={index} 
                        style={{ 
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)', 
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                              {item.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{item.name}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{item.email}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-main)', fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <LogIn size={13} className="text-muted" />
                            {item.logins}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span 
                            style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: 'rgba(20, 184, 166, 0.1)',
                              color: 'var(--primary)'
                            }}
                          >
                            {item.activeHours.toFixed(2)} horas
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <span className="badge badge-secondary" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                            {item.mostVisitedPanel}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-main)' }}>
                          {item.totalActions}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(item.lastActivity).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Registro de Actividad Reciente (Timeline) ─── */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '12px', marginTop: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: 'var(--primary)' }} />
              Log de Actividad del Sistema
            </h4>

            <div style={{ overflowX: 'auto', maxHeight: '50vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '150px' }}>Fecha y Hora</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '180px' }}>Usuario</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '120px', textAlign: 'center' }}>Acción</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '120px' }}>Ubicación</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {userData.recentActivities.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay acciones de usuario registradas en el sistema.
                      </td>
                    </tr>
                  ) : (
                    userData.recentActivities.map((act) => {
                      let badgeBg = 'rgba(255, 255, 255, 0.05)';
                      let badgeColor = 'var(--text-secondary)';
                      let actionText = act.action;

                      switch (act.action) {
                        case 'login':
                          badgeBg = 'rgba(16, 185, 129, 0.1)';
                          badgeColor = 'var(--status-available)';
                          actionText = 'Login';
                          break;
                        case 'view_panel':
                          badgeBg = 'rgba(59, 130, 246, 0.1)';
                          badgeColor = '#3b82f6';
                          actionText = 'Ver Panel';
                          break;
                        case 'create_row':
                        case 'create_course':
                          badgeBg = 'rgba(139, 92, 246, 0.1)';
                          badgeColor = '#a78bfa';
                          actionText = 'Creación';
                          break;
                        case 'edit_row':
                          badgeBg = 'rgba(245, 158, 11, 0.1)';
                          badgeColor = '#fbbf24';
                          actionText = 'Edición';
                          break;
                        case 'delete_row':
                        case 'delete_course':
                          badgeBg = 'rgba(239, 68, 68, 0.1)';
                          badgeColor = '#ef4444';
                          actionText = 'Borrado';
                          break;
                        case 'ping':
                          badgeBg = 'rgba(255, 255, 255, 0.03)';
                          badgeColor = 'var(--text-muted)';
                          actionText = 'Sesión Activa';
                          break;
                      }

                      return (
                        <tr 
                          key={act.id} 
                          style={{ 
                            borderBottom: '1px solid rgba(255, 255, 255, 0.03)', 
                            transition: 'background-color 0.1s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.01)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <td style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            {new Date(act.timestamp).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td style={{ padding: '0.6rem 1rem', fontWeight: 500, color: 'var(--text-main)', fontSize: '0.825rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{act.userName}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{act.email}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: badgeBg,
                              color: badgeColor
                            }}>
                              {actionText}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {act.panelName || '-'}
                          </td>
                          <td style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                            {act.details || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TrackingDashboard;
