import React, { useEffect, useState } from 'react';
import { CheckCircle, BarChart2, Users, FileText, Activity, AlertCircle, Loader2 } from 'lucide-react';
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
}

const TrackingDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        const reportData = await reportsApi.getDashboard();
        setData(reportData);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error al cargar reportes');
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, []);

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

  const { kpis, commercialUsage, retentionFunnel, studentProgress } = data;

  // Encontrar el valor máximo de interacciones comerciales para calcular porcentajes de barras de progreso
  const maxInteractions = Math.max(...commercialUsage.map(c => c.totalInteractions), 1);

  return (
    <div className="analytics-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem' }}>
      <div className="panel-header">
        <h3>Dashboard de Seguimiento Educativo</h3>
        <p className="text-muted">Análisis de uso y funnel de retención de alumnos en Moodle por clase y licencia comercial.</p>
      </div>

      {/* ─── KPI Cards ─── */}
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

        {/* Uso Comercial por Cliente / Licencia */}
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
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Licencia</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Materia</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Clases Iniciadas</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Clases Completadas</th>
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
                      <span className="badge badge-secondary" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                        {item.licencia}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.materia}</td>
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
    </div>
  );
};

export default TrackingDashboard;
