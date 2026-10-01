import React, { useEffect, useState } from 'react';
import { Megaphone, Lock, ShieldCheck, CheckCircle2, ChevronRight, Award, AlertTriangle, Sparkles, Clock } from 'lucide-react';
import { portalsApi, type ApiPortalConfig, type ApiAnnouncementItem, type ApiLicenciaConfigItem, type ApiCuatrimestreItem } from '../services/api';
import logoIsotipo from '../assets/logo_panel.png';

interface EmbeddedPortalViewProps {
  portalIdOrSlug?: string;
  onNavigateBack?: () => void;
}

const DEFAULT_LICENCIAS: ApiLicenciaConfigItem[] = [
  {
    id: 'lic-cb',
    name: 'Licencia CB',
    badgeText: 'Oficial Conmebol',
    description: 'Bases y fundamentos tácticos para el entrenamiento de fútbol inicial.',
    requiresPreviousLicencia: false,
    requiresMatricula: true,
    cuatrimestres: [
      { id: 'cb-c1', name: '1º Cuatrimestre', startDate: '2026-03-01', statusOverride: 'available' },
      { id: 'cb-c2', name: '2º Cuatrimestre', startDate: '2026-08-01', statusOverride: 'available' },
    ]
  },
  {
    id: 'lic-a',
    name: 'Licencia A',
    badgeText: 'Oficial Conmebol',
    description: 'Entrenamiento avanzado, análisis de juego y gestión de planteles.',
    requiresPreviousLicencia: true,
    requiresMatricula: true,
    cuatrimestres: [
      { id: 'a-c1', name: '1º Cuatrimestre', startDate: '2027-03-01', statusOverride: 'available' },
      { id: 'a-c2', name: '2º Cuatrimestre', startDate: '2027-08-01', statusOverride: 'available' },
    ]
  },
  {
    id: 'lic-pro',
    name: 'Licencia PRO',
    badgeText: 'Oficial Conmebol',
    description: 'Máximo nivel profesional, dirección técnica de alto rendimiento.',
    requiresPreviousLicencia: true,
    requiresMatricula: true,
    cuatrimestres: [
      { id: 'pro-c1', name: '1º Cuatrimestre', startDate: '2028-03-01', statusOverride: 'available' },
      { id: 'pro-c2', name: '2º Cuatrimestre', startDate: '2028-08-01', statusOverride: 'available' },
    ]
  }
];

const DEFAULT_ANNOUNCEMENTS: ApiAnnouncementItem[] = [
  {
    id: 'ann-1',
    title: '📢 Bienvenida al Portal de Alumnos',
    content: 'Consulta tus materias activas, fechas de inicio de cuatrimestre y comunicados oficiales de la Escuela.',
    date: new Date().toISOString().split('T')[0],
    type: 'info',
    active: true
  },
  {
    id: 'ann-2',
    title: '🗓️ Calendario Académico de Cuatrimestres',
    content: 'El 2° Cuatrimestre se habilitará automáticamente según la fecha oficial programada en la agenda.',
    date: new Date().toISOString().split('T')[0],
    type: 'event',
    active: true
  }
];

export const EmbeddedPortalView: React.FC<EmbeddedPortalViewProps> = ({ portalIdOrSlug = 'licencia-entrenador' }) => {
  const [portal, setPortal] = useState<ApiPortalConfig | null>(null);
  const [announcements, setAnnouncements] = useState<ApiAnnouncementItem[]>(DEFAULT_ANNOUNCEMENTS);
  const [licencias, setLicencias] = useState<ApiLicenciaConfigItem[]>(DEFAULT_LICENCIAS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPortalData();
  }, [portalIdOrSlug]);

  const loadPortalData = async () => {
    setLoading(true);
    try {
      const data = await portalsApi.getPublic(portalIdOrSlug);
      setPortal(data);
      if (data.announcements) {
        setAnnouncements(typeof data.announcements === 'string' ? JSON.parse(data.announcements) : data.announcements);
      }
      if (data.licenciasConfig) {
        setLicencias(typeof data.licenciasConfig === 'string' ? JSON.parse(data.licenciasConfig) : data.licenciasConfig);
      }
    } catch (err) {
      console.log('Using default mock data for portal preview');
    } finally {
      setLoading(false);
    }
  };

  const isCuatrimestreUnlocked = (cuat: ApiCuatrimestreItem) => {
    if (!cuat.startDate) return true;
    const today = new Date();
    const startDate = new Date(cuat.startDate);
    return today >= startDate;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <Sparkles size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
        <p style={{ fontWeight: 600 }}>Cargando Portal del Alumno...</p>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '1.5rem',
      color: '#1e293b',
      background: 'var(--bg-main, #f8fafc)',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* HEADER BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)',
        color: 'white',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 10px 15px -3px rgba(13, 148, 136, 0.25)',
        marginBottom: '1.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            <Award size={14} /> Campus Institucional • Escuela Maradona Menotti
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            {portal?.title || 'Portal Licencia Entrenador de Fútbol'}
          </h1>
          <p style={{ fontSize: '0.95rem', opacity: 0.9, margin: '0.5rem 0 0 0', maxWidth: '650px' }}>
            {portal?.subtitle || 'Bienvenido a tu entorno de aprendizaje. Revisa los avisos y accede a tus módulos académicos.'}
          </p>
        </div>
        <img 
          src={logoIsotipo} 
          alt="CourseFactory Logo" 
          style={{ height: '48px', objectFit: 'contain', opacity: 0.9, filter: 'brightness(0) invert(1)' }} 
        />
      </div>

      {/* CARTELERA DE ANUNCIOS */}
      {announcements && announcements.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Megaphone size={20} color="#0d9488" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Cartelera de Anuncios</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {announcements.map((ann) => (
              <div 
                key={ann.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  borderLeft: ann.type === 'alert' ? '4px solid #ef4444' : ann.type === 'warning' ? '4px solid #f59e0b' : '4px solid #0d9488'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    {ann.title}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                    {ann.date}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                  {ann.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RUTA DE CARRERA / LICENCIAS */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <ShieldCheck size={22} color="#0d9488" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Ruta de Formación & Licencias</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {licencias.map((lic, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;

            // State definitions for mock progression
            const isActive = isFirst;
            const isMatriculaPending = isSecond;
            const isLocked = isThird;

            return (
              <div 
                key={lic.id}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  border: isActive ? '2px solid #0d9488' : '1px solid #e2e8f0',
                  boxShadow: isActive ? '0 10px 20px -5px rgba(13, 148, 136, 0.12)' : '0 2px 4px rgba(0,0,0,0.03)',
                  opacity: isLocked ? 0.75 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Header Licencia */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                        {lic.name}
                      </h3>
                      {lic.badgeText && (
                        <span style={{
                          background: isActive ? '#ccfbf1' : '#f1f5f9',
                          color: isActive ? '#0f766e' : '#64748b',
                          fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '12px'
                        }}>
                          🏆 {lic.badgeText}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                      {lic.description}
                    </p>
                  </div>

                  {/* Status Badge */}
                  {isActive && (
                    <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle2 size={15} /> Licencia en Cursada
                    </span>
                  )}
                  {isMatriculaPending && (
                    <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <AlertTriangle size={15} /> Requiere Matrícula
                    </span>
                  )}
                  {isLocked && (
                    <span style={{ background: '#f1f5f9', color: '#64748b', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Lock size={15} /> Requisito Licencia A
                    </span>
                  )}
                </div>

                {/* Cuatrimestres Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {lic.cuatrimestres.map((cuat) => {
                    const unlockedByDate = isCuatrimestreUnlocked(cuat);
                    const canAccess = isActive && unlockedByDate;

                    return (
                      <div 
                        key={cuat.id}
                        style={{
                          background: canAccess ? '#f8fafc' : '#f1f5f9',
                          borderRadius: '12px',
                          padding: '1.1rem',
                          border: canAccess ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                            📖 {cuat.name}
                          </span>
                          {!unlockedByDate && isActive && (
                            <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                              🗓️ Habilita {formatDate(cuat.startDate)}
                            </span>
                          )}
                        </div>

                        <div>
                          {canAccess ? (
                            <button
                              onClick={() => {
                                if (cuat.moodleUrl) {
                                  window.open(cuat.moodleUrl, '_blank');
                                } else {
                                  alert(`Ingresando a los contenidos del ${cuat.name} de la ${lic.name}`);
                                }
                              }}
                              style={{
                                width: '100%',
                                background: '#0d9488',
                                color: 'white',
                                border: 'none',
                                padding: '0.65rem',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                boxShadow: '0 2px 4px rgba(13, 148, 136, 0.2)'
                              }}
                            >
                              Acceder a Materias <ChevronRight size={16} />
                            </button>
                          ) : !unlockedByDate && isActive ? (
                            <button
                              disabled
                              style={{
                                width: '100%',
                                background: '#e2e8f0',
                                color: '#64748b',
                                border: 'none',
                                padding: '0.65rem',
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                cursor: 'not-allowed'
                              }}
                            >
                              <Clock size={16} /> Bloqueado por Calendario
                            </button>
                          ) : isMatriculaPending ? (
                            <div style={{ fontSize: '0.8rem', color: '#b45309', background: '#fffbe8', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                              Contactar Administración para habilitar pago/matrícula.
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                              Complete las etapas previas para desbloquear.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
