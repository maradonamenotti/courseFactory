import React, { useState, useEffect } from 'react';
import { Globe, ShieldCheck, CheckCircle2, Save, Plus, Trash2 } from 'lucide-react';
import { type Course } from '../types';
import { coursesApi } from '../services/api';

interface LanguagesPanelProps {
  activeCourse: Course | null;
  onUpdateCourse: (updated: Course) => void;
  userRole?: string; // To differentiate Admin and Author actions
}

// Default global languages that the admin can manage
const DEFAULT_GLOBAL_LANGUAGES = [
  { code: 'ES', name: 'Español' },
  { code: 'EN', name: 'Inglés' },
  { code: 'PT', name: 'Portugués' },
  { code: 'FR', name: 'Francés' },
  { code: 'IT', name: 'Italiano' },
  { code: 'DE', name: 'Alemán' },
  { code: 'ZH', name: 'Chino' },
  { code: 'JA', name: 'Japonés' },
  { code: 'RU', name: 'Ruso' },
  { code: 'AR', name: 'Árabe' },
  { code: 'HI', name: 'Hindi' }
];

export const LanguagesPanel: React.FC<LanguagesPanelProps> = ({
  activeCourse,
  onUpdateCourse,
  userRole = 'ADMIN' // Default to ADMIN to allow local configuration
}) => {
  // Global available languages list (stored in localStorage for persistence in dev/local)
  const [globalLanguages, setGlobalLanguages] = useState<{ code: string; name: string }[]>(() => {
    const saved = localStorage.getItem('cf_global_languages');
    return saved ? JSON.parse(saved) : DEFAULT_GLOBAL_LANGUAGES;
  });

  const [newLangCode, setNewLangCode] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [selectedCourseLangs, setSelectedCourseLangs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load languages of active course
  useEffect(() => {
    if (activeCourse) {
      const langs = activeCourse.languages
        ? activeCourse.languages.split(',').map(l => l.trim()).filter(Boolean)
        : ['ES'];
      setSelectedCourseLangs(langs);
    } else {
      setSelectedCourseLangs([]);
    }
  }, [activeCourse]);

  // Save global languages list to localStorage
  const saveGlobalLanguages = (list: { code: string; name: string }[]) => {
    setGlobalLanguages(list);
    localStorage.setItem('cf_global_languages', JSON.stringify(list));
  };

  const handleAddGlobalLanguage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangCode || !newLangName) return;
    const codeUpper = newLangCode.trim().toUpperCase();
    if (globalLanguages.some(l => l.code === codeUpper)) {
      alert('El código de idioma ya existe.');
      return;
    }
    const updated = [...globalLanguages, { code: codeUpper, name: newLangName.trim() }];
    saveGlobalLanguages(updated);
    setNewLangCode('');
    setNewLangName('');
  };

  const handleRemoveGlobalLanguage = (code: string) => {
    if (code === 'ES') {
      alert('El idioma Español (ES) es requerido por defecto y no puede ser eliminado.');
      return;
    }
    const updated = globalLanguages.filter(l => l.code !== code);
    saveGlobalLanguages(updated);
    // If the removed language was selected in the active course, remove it there too
    if (selectedCourseLangs.includes(code)) {
      setSelectedCourseLangs(prev => prev.filter(c => c !== code));
    }
  };

  const toggleCourseLanguage = (code: string) => {
    setSelectedCourseLangs(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSaveCourseLanguages = async () => {
    if (!activeCourse) return;
    if (selectedCourseLangs.length === 0) {
      alert('Debes seleccionar al menos un idioma para el curso.');
      return;
    }
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const langsString = selectedCourseLangs.join(',');
      await coursesApi.update(activeCourse.id, { languages: langsString });
      
      onUpdateCourse({
        ...activeCourse,
        languages: langsString
      });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Error saving course languages:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeCourse) {
    return (
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
        color: '#6b7280'
      }}>
        <Globe size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5, color: '#14B8A6' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>Ningún Curso Seleccionado</h3>
        <p style={{ fontSize: '0.9rem' }}>Por favor, selecciona un curso del panel superior para configurar sus idiomas.</p>
      </div>
    );
  }

  const isAdmin = userRole === 'ADMIN' || userRole === 'DIRECTOR SISTEMAS';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Course Language Selector Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
        padding: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #14B8A6, #8B5CF6)'
        }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{
            background: 'rgba(20, 184, 166, 0.1)',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#14B8A6'
          }}>
            <Globe size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>
              Configurar Idiomas del Curso
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '2px 0 0 0' }}>
              Define en qué idiomas se generará y visualizará el contenido para <strong>{activeCourse.name}</strong>
            </p>
          </div>
        </div>

        <div style={{
          background: '#f9fafb',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(0,0,0,0.03)',
          marginBottom: '1.5rem'
        }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Idiomas Activos en este Curso:
          </h4>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {globalLanguages.map(lang => {
              const isSelected = selectedCourseLangs.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  onClick={() => toggleCourseLanguage(lang.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '10px',
                    border: isSelected ? '1.5px solid #14B8A6' : '1.5px solid #e5e7eb',
                    background: isSelected ? 'rgba(20, 184, 166, 0.05)' : '#ffffff',
                    color: isSelected ? '#14B8A6' : '#4b5563',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: isSelected ? '0 4px 12px rgba(20, 184, 166, 0.08)' : 'none'
                  }}
                  title={`Click para ${isSelected ? 'desactivar' : 'activar'}`}
                >
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: isSelected ? '#14B8A6' : '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '0.65rem'
                  }}>
                    {isSelected ? '✓' : ''}
                  </span>
                  <span>{lang.name} ({lang.code})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            {saveStatus === 'success' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                <CheckCircle2 size={16} /> Configuración de idiomas guardada correctamente.
              </span>
            )}
            {saveStatus === 'error' && (
              <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                ⚠️ Error al guardar la configuración de idiomas.
              </span>
            )}
          </div>
          <button
            onClick={handleSaveCourseLanguages}
            disabled={isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#14B8A6',
              color: '#ffffff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(20, 184, 166, 0.3)',
              transition: 'all 0.2s',
              opacity: isSaving ? 0.7 : 1
            }}
          >
            <Save size={18} />
            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>

      {/* Administrator Configuration Card */}
      {isAdmin && (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{
              background: 'rgba(139, 92, 246, 0.1)',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8B5CF6'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                Administración Global de Idiomas
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '2px 0 0 0' }}>
                Define qué idiomas están disponibles en la plataforma para que los autores los seleccionen.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
            
            {/* Left: Add language form */}
            <form onSubmit={handleAddGlobalLanguage} style={{
              background: '#f9fafb',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4b5563', margin: '0 0 4px 0' }}>Añadir Idioma Disponible</h4>
              
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px' }}>Código (Ej: EN, PT, FR):</label>
                <input
                  type="text"
                  maxLength={5}
                  value={newLangCode}
                  onChange={(e) => setNewLangCode(e.target.value)}
                  placeholder="PT"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px' }}>Nombre:</label>
                <input
                  type="text"
                  value={newLangName}
                  onChange={(e) => setNewLangName(e.target.value)}
                  placeholder="Portugués"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.85rem'
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: '#8B5CF6',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
              >
                <Plus size={16} /> Añadir a la Lista
              </button>
            </form>

            {/* Right: Available list */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4b5563', margin: '0 0 12px 0' }}>Idiomas definidos en la plataforma:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {globalLanguages.map(l => (
                  <div
                    key={l.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#111827' }}>{l.name}</strong>{' '}
                      <span style={{ color: '#6b7280', fontSize: '0.75rem', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>{l.code}</span>
                    </div>
                    {l.code !== 'ES' && (
                      <button
                        onClick={() => handleRemoveGlobalLanguage(l.code)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '4px',
                          transition: 'background 0.2s'
                        }}
                        title="Eliminar este idioma"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
