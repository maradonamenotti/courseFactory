import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Copy, Check, ExternalLink, Megaphone, ShieldCheck, Globe, Sparkles, Layers } from 'lucide-react';
import { portalsApi, type ApiPortalConfig, type ApiAnnouncementItem, type ApiLicenciaConfigItem, type ApiCuatrimestreItem } from '../services/api';
import { type Folder, type Course } from '../types';

interface PortalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  courses: Course[];
  activeFolderId?: string | null;
  onSaveSuccess?: () => void;
}

const DEFAULT_LICENCIAS_CONFIG: ApiLicenciaConfigItem[] = [
  {
    id: 'lic-cb',
    name: 'Licencia CB',
    badgeText: 'Oficial Conmebol',
    description: 'Bases y fundamentos tácticos para el entrenamiento de fútbol inicial.',
    requiresPreviousLicencia: false,
    requiresMatricula: true,
    cuatrimestres: [
      { id: 'cb-c1', name: '1º Cuatrimestre', startDate: '2026-03-01', moodleUrl: '', statusOverride: 'available' },
      { id: 'cb-c2', name: '2º Cuatrimestre', startDate: '2026-08-01', moodleUrl: '', statusOverride: 'available' },
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
      { id: 'a-c1', name: '1º Cuatrimestre', startDate: '2027-03-01', moodleUrl: '', statusOverride: 'available' },
      { id: 'a-c2', name: '2º Cuatrimestre', startDate: '2027-08-01', moodleUrl: '', statusOverride: 'available' },
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
      { id: 'pro-c1', name: '1º Cuatrimestre', startDate: '2028-03-01', moodleUrl: '', statusOverride: 'available' },
      { id: 'pro-c2', name: '2º Cuatrimestre', startDate: '2028-08-01', moodleUrl: '', statusOverride: 'available' },
    ]
  }
];

const DEFAULT_ANNOUNCEMENTS: ApiAnnouncementItem[] = [
  {
    id: 'ann-1',
    title: '📢 Bienvenidos al Portal del Estudiante',
    content: 'Consulta la cartelera de avisos y accede a tus materias según el calendario oficial.',
    date: new Date().toISOString().split('T')[0],
    type: 'info',
    active: true
  },
  {
    id: 'ann-2',
    title: '🗓️ Apertura de Cursadas y Evaluaciones',
    content: 'Recuerda revisar las fechas de apertura de cuatrimestre y mantener tu matrícula al día.',
    date: new Date().toISOString().split('T')[0],
    type: 'event',
    active: true
  }
];

export const PortalConfigModal: React.FC<PortalConfigModalProps> = ({
  isOpen,
  onClose,
  folders,
  courses: _courses,
  activeFolderId,
  onSaveSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'cartelera' | 'licencias' | 'embed'>('general');
  const [, setExistingPortals] = useState<ApiPortalConfig[]>([]);
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);

  // Portal form state
  const [title, setTitle] = useState('Portal Licencia Entrenador de Fútbol');
  const [subtitle, setSubtitle] = useState('Campus Institucional y Cartelera de Alumnos');
  const [folderId, setFolderId] = useState<string>(activeFolderId || '');
  const [slug, setSlug] = useState('licencia-entrenador');
  const [moodleCourseId, setMoodleCourseId] = useState('');
  const [announcements, setAnnouncements] = useState<ApiAnnouncementItem[]>(DEFAULT_ANNOUNCEMENTS);
  const [licenciasConfig, setLicenciasConfig] = useState<ApiLicenciaConfigItem[]>(DEFAULT_LICENCIAS_CONFIG);
  
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPortals();
    }
  }, [isOpen]);

  const loadPortals = async () => {
    try {
      const data = await portalsApi.getAll();
      setExistingPortals(data);
      
      // If there is a portal for the active folder or existing portal, select it
      const found = activeFolderId ? data.find(p => p.folderId === activeFolderId) : data[0];
      if (found) {
        populatePortalForm(found);
      } else if (activeFolderId) {
        const folder = folders.find(f => f.id === activeFolderId);
        if (folder) {
          setTitle(`Portal ${folder.name}`);
          setFolderId(folder.id);
          setSlug(folder.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        }
      }
    } catch (err) {
      console.error('Error loading portals:', err);
    }
  };

  const populatePortalForm = (portal: ApiPortalConfig) => {
    setSelectedPortalId(portal.id);
    setTitle(portal.title || '');
    setSubtitle(portal.subtitle || '');
    setFolderId(portal.folderId || '');
    setSlug(portal.slug || '');
    setMoodleCourseId(portal.moodleCourseId || '');
    
    try {
      if (portal.announcements) {
        setAnnouncements(typeof portal.announcements === 'string' ? JSON.parse(portal.announcements) : portal.announcements);
      }
    } catch (e) {
      setAnnouncements(DEFAULT_ANNOUNCEMENTS);
    }

    try {
      if (portal.licenciasConfig) {
        setLicenciasConfig(typeof portal.licenciasConfig === 'string' ? JSON.parse(portal.licenciasConfig) : portal.licenciasConfig);
      }
    } catch (e) {
      setLicenciasConfig(DEFAULT_LICENCIAS_CONFIG);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMsg('El título del portal es obligatorio');
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const payload: Partial<ApiPortalConfig> = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        folderId: folderId || null,
        slug: slug.trim() || null,
        moodleCourseId: moodleCourseId.trim() || null,
        announcements: JSON.stringify(announcements),
        licenciasConfig: JSON.stringify(licenciasConfig),
        active: true
      };

      if (selectedPortalId) {
        await portalsApi.update(selectedPortalId, payload);
      } else {
        const created = await portalsApi.create(payload);
        setSelectedPortalId(created.id);
      }

      await loadPortals();
      if (onSaveSuccess) onSaveSuccess();
      setActiveTab('embed');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al guardar el portal');
    } finally {
      setIsSaving(false);
    }
  };

  const addAnnouncement = () => {
    const newItem: ApiAnnouncementItem = {
      id: `ann-${Date.now()}`,
      title: 'Nuevo Aviso / Noticia',
      content: 'Descripción del comunicado para los estudiantes.',
      date: new Date().toISOString().split('T')[0],
      type: 'info',
      active: true
    };
    setAnnouncements(prev => [newItem, ...prev]);
  };

  const updateAnnouncement = (id: string, field: keyof ApiAnnouncementItem, value: any) => {
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const deleteAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const updateCuatrimestre = (licId: string, cuatId: string, field: keyof ApiCuatrimestreItem, value: any) => {
    setLicenciasConfig(prev => prev.map(lic => {
      if (lic.id !== licId) return lic;
      return {
        ...lic,
        cuatrimestres: lic.cuatrimestres.map(c => c.id === cuatId ? { ...c, [field]: value } : c)
      };
    }));
  };

  const getEmbedUrl = () => {
    const baseUrl = window.location.origin;
    const identifier = slug || selectedPortalId || 'licencia-entrenador';
    return `${baseUrl}/?portal=${identifier}`;
  };

  const getIframeCode = () => {
    const embedUrl = getEmbedUrl();
    return `<iframe src="${embedUrl}" width="100%" height="850" frameborder="0" allowfullscreen style="border: none; border-radius: 12px; width: 100%; min-height: 850px;"></iframe>`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getIframeCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
      padding: '1.5rem'
    }}>
      <div style={{
        backgroundColor: 'var(--card-bg, #ffffff)',
        color: 'var(--text-main, #1e293b)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid var(--border, #e2e8f0)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--header-bg, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #14B8A6, #0D9488)',
              color: 'white',
              padding: '0.6rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Gestor de Portal del Alumno (+Portal)</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0 0' }}>
                Configuración del entorno embebido en Moodle: Cartelera, Licencias CB/A/PRO y Calendario
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary, #64748b)', padding: '0.4rem', borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          padding: '0 1.5rem',
          gap: '1rem',
          background: 'var(--bg-main, #ffffff)'
        }}>
          <button
            onClick={() => setActiveTab('general')}
            style={{
              padding: '0.85rem 0.5rem',
              border: 'none',
              background: 'none',
              fontWeight: activeTab === 'general' ? 600 : 500,
              color: activeTab === 'general' ? '#14B8A6' : 'var(--text-secondary, #64748b)',
              borderBottom: activeTab === 'general' ? '3px solid #14B8A6' : '3px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem'
            }}
          >
            <Sparkles size={16} /> Configuración General
          </button>
          <button
            onClick={() => setActiveTab('cartelera')}
            style={{
              padding: '0.85rem 0.5rem',
              border: 'none',
              background: 'none',
              fontWeight: activeTab === 'cartelera' ? 600 : 500,
              color: activeTab === 'cartelera' ? '#14B8A6' : 'var(--text-secondary, #64748b)',
              borderBottom: activeTab === 'cartelera' ? '3px solid #14B8A6' : '3px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem'
            }}
          >
            <Megaphone size={16} /> Cartelera ({announcements.length})
          </button>
          <button
            onClick={() => setActiveTab('licencias')}
            style={{
              padding: '0.85rem 0.5rem',
              border: 'none',
              background: 'none',
              fontWeight: activeTab === 'licencias' ? 600 : 500,
              color: activeTab === 'licencias' ? '#14B8A6' : 'var(--text-secondary, #64748b)',
              borderBottom: activeTab === 'licencias' ? '3px solid #14B8A6' : '3px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem'
            }}
          >
            <ShieldCheck size={16} /> Licencias & Calendarios
          </button>
          <button
            onClick={() => setActiveTab('embed')}
            style={{
              padding: '0.85rem 0.5rem',
              border: 'none',
              background: 'none',
              fontWeight: activeTab === 'embed' ? 600 : 500,
              color: activeTab === 'embed' ? '#14B8A6' : 'var(--text-secondary, #64748b)',
              borderBottom: activeTab === 'embed' ? '3px solid #14B8A6' : '3px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem'
            }}
          >
            <Globe size={16} /> Código Moodle (iFrame)
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {errorMsg && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
              padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.88rem'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Nombre / Título del Portal
                </label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: Portal Licencia Entrenador de Fútbol"
                  style={{
                    width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px',
                    border: '1px solid var(--border, #cbd5e1)', background: 'var(--input-bg, #ffffff)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Subtítulo / Mensaje de Bienvenida
                </label>
                <input 
                  type="text" 
                  value={subtitle} 
                  onChange={e => setSubtitle(e.target.value)}
                  placeholder="Ej: Campus Institucional Escuela Maradona Menotti"
                  style={{
                    width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px',
                    border: '1px solid var(--border, #cbd5e1)', background: 'var(--input-bg, #ffffff)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Carrera Vinculada (CourseFactory)
                  </label>
                  <select
                    value={folderId}
                    onChange={e => setFolderId(e.target.value)}
                    style={{
                      width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px',
                      border: '1px solid var(--border, #cbd5e1)', background: 'var(--input-bg, #ffffff)'
                    }}
                  >
                    <option value="">-- Sin vincular a carrera específica --</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Identificador Único (Slug Embed)
                  </label>
                  <input 
                    type="text" 
                    value={slug} 
                    onChange={e => setSlug(e.target.value)}
                    placeholder="entrenador-futbol"
                    style={{
                      width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px',
                      border: '1px solid var(--border, #cbd5e1)', background: 'var(--input-bg, #ffffff)'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CARTELERA DE ANUNCIOS */}
          {activeTab === 'cartelera' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
                  Avisos institucionales que se muestran en el carrusel/encabezado del portal.
                </p>
                <button
                  onClick={addAnnouncement}
                  style={{
                    background: '#14B8A6', color: 'white', border: 'none',
                    padding: '0.5rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600
                  }}
                >
                  <Plus size={16} /> Agregar Aviso
                </button>
              </div>

              {announcements.map((ann, idx) => (
                <div 
                  key={ann.id} 
                  style={{
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: '10px',
                    padding: '1rem',
                    background: 'var(--card-bg, #f8fafc)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#14B8A6' }}>
                      Aviso #{idx + 1}
                    </span>
                    <button
                      onClick={() => deleteAnnouncement(ann.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      title="Eliminar aviso"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                    <input 
                      type="text"
                      value={ann.title}
                      onChange={e => updateAnnouncement(ann.id, 'title', e.target.value)}
                      placeholder="Título del anuncio..."
                      style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)' }}
                    />
                    <select
                      value={ann.type}
                      onChange={e => updateAnnouncement(ann.id, 'type', e.target.value)}
                      style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)' }}
                    >
                      <option value="info">💡 Información</option>
                      <option value="event">🗓️ Evento / Examen</option>
                      <option value="warning">⚠️ Requisito / Aviso</option>
                      <option value="alert">🚨 Importante</option>
                    </select>
                  </div>

                  <textarea 
                    value={ann.content}
                    onChange={e => updateAnnouncement(ann.id, 'content', e.target.value)}
                    placeholder="Contenido o mensaje del anuncio..."
                    rows={2}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: LICENCIAS & CALENDARIO */}
          {activeTab === 'licencias' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.85rem', borderRadius: '10px', fontSize: '0.85rem', color: '#166534' }}>
                💡 <strong>Reglas de Negocio Activas:</strong><br />
                • <strong>Cuatrimestres:</strong> El 2° cuatrimestre se habilita automáticamente según la fecha de inicio configurada.<br />
                • <strong>Licencias (A/PRO):</strong> Se desbloquean al finalizar la previa y contar con la matrícula al día.
              </div>

              {licenciasConfig.map((lic) => (
                <div 
                  key={lic.id} 
                  style={{
                    border: '1px solid var(--border, #cbd5e1)',
                    borderRadius: '12px',
                    padding: '1.1rem',
                    background: 'var(--card-bg, #ffffff)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{lic.name}</span>
                      <span style={{ background: '#ccfbf1', color: '#0f766e', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
                        {lic.badgeText || 'Oficial Conmebol'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {lic.cuatrimestres.map((cuat) => (
                      <div 
                        key={cuat.id}
                        style={{
                          background: 'var(--header-bg, #f8fafc)',
                          padding: '0.85rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border, #e2e8f0)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0d9488' }}>
                          📌 {cuat.name}
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                            Fecha de Apertura por Calendario:
                          </label>
                          <input 
                            type="date" 
                            value={cuat.startDate}
                            onChange={e => updateCuatrimestre(lic.id, cuat.id, 'startDate', e.target.value)}
                            style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                            Enlace / Aula Moodle (o Curso CF):
                          </label>
                          <input 
                            type="text"
                            placeholder="https://moodle.escuela.../course/view.php?id=..."
                            value={cuat.moodleUrl || ''}
                            onChange={e => updateCuatrimestre(lic.id, cuat.id, 'moodleUrl', e.target.value)}
                            style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: EMBED CODE */}
          {activeTab === 'embed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem', borderRadius: '10px', color: '#1e40af', fontSize: '0.88rem' }}>
                🚀 <strong>¡Portal Listo para Incrustar!</strong><br />
                Copia el código a continuación e insértalo en un recurso <strong>Página HTML</strong> o <strong>Etiqueta</strong> dentro de la clase Moodle (ej: <em>LICENCIA DE ENTRENADOR</em>).
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Código iFrame para Moodle:
                </label>
                <div style={{ position: 'relative' }}>
                  <textarea 
                    readOnly
                    value={getIframeCode()}
                    rows={4}
                    style={{
                      width: '100%', padding: '0.85rem', borderRadius: '8px',
                      background: '#1e293b', color: '#f8fafc', fontFamily: 'monospace',
                      fontSize: '0.82rem', border: 'none'
                    }}
                  />
                  <button
                    onClick={handleCopyCode}
                    style={{
                      position: 'absolute', top: '10px', right: '10px',
                      background: copied ? '#10b981' : '#14B8A6', color: 'white',
                      border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                      fontSize: '0.8rem', fontWeight: 600
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? '¡Copiado!' : 'Copiar Código'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <a
                  href={getEmbedUrl()}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: '#f1f5f9', color: '#334155', textDecoration: 'none',
                    padding: '0.65rem 1rem', borderRadius: '8px', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem'
                  }}
                >
                  <ExternalLink size={16} /> Previsualizar Portal en Ventana Nueva
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--header-bg, #f8fafc)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1.1rem', borderRadius: '8px', border: '1px solid #cbd5e1',
              background: 'white', color: '#475569', cursor: 'pointer', fontWeight: 500
            }}
          >
            Cerrar
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '0.65rem 1.4rem', borderRadius: '8px', border: 'none',
              background: '#14B8A6', color: 'white', cursor: 'pointer', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            {isSaving ? 'Guardando...' : 'Guardar y Generar Código Embebido'}
          </button>
        </div>
      </div>
    </div>
  );
};
