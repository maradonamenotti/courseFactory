import React, { useState, useEffect } from 'react';
import { Globe, ShieldCheck, CheckCircle2, Save, Plus, Trash2, Link, KeyRound } from 'lucide-react';
import { type Course } from '../types';
import { coursesApi } from '../services/api';
import { useDialog } from './CustomDialog';

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
  const { showAlert, DialogRenderer } = useDialog();
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

  const [moodleCourseId, setMoodleCourseId] = useState('');
  const [moodleCourseName, setMoodleCourseName] = useState('');
  const [releaseMode, setReleaseMode] = useState('FIXED');
  const [startDate, setStartDate] = useState('');
  const [isSavingMoodle, setIsSavingMoodle] = useState(false);
  const [moodleSaveStatus, setMoodleSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [unlockCodes, setUnlockCodes] = useState<any[]>([]);
  const [isFetchingCodes, setIsFetchingCodes] = useState(false);
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeType, setNewCodeType] = useState('TOTAL');
  const [newCodeTargetMateria, setNewCodeTargetMateria] = useState('');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState('');
  const [newCodeExpiresAt, setNewCodeExpiresAt] = useState('');
  const [isCreatingCode, setIsCreatingCode] = useState(false);
  // Load languages and Moodle configuration of active course
  useEffect(() => {
    if (activeCourse) {
      const langs = activeCourse.languages
        ? activeCourse.languages.split(',').map(l => l.trim()).filter(Boolean)
        : ['ES'];
      setSelectedCourseLangs(langs);
      setMoodleCourseId(activeCourse.moodleCourseId || '');
      setMoodleCourseName(activeCourse.moodleCourseName || '');
      setReleaseMode(activeCourse.releaseMode || 'FIXED');
      setStartDate(activeCourse.startDate || '');
    } else {
      setSelectedCourseLangs([]);
      setMoodleCourseId('');
      setMoodleCourseName('');
      setReleaseMode('FIXED');
      setStartDate('');
    }
  }, [activeCourse]);

  const handleSaveMoodleConfig = async () => {
    if (!activeCourse) return;
    setIsSavingMoodle(true);
    setMoodleSaveStatus('idle');

    try {
      const updated = await coursesApi.update(activeCourse.id, {
        moodleCourseId: moodleCourseId.trim() || null,
        moodleCourseName: moodleCourseName.trim() || null,
        releaseMode,
        startDate: releaseMode === 'RELATIVE' ? (startDate || null) : null,
      });

      setMoodleCourseId(updated.moodleCourseId || '');
      setMoodleCourseName(updated.moodleCourseName || '');
      setReleaseMode(updated.releaseMode || 'FIXED');
      setStartDate(updated.startDate || '');
      onUpdateCourse({
        ...activeCourse,
        moodleCourseId: updated.moodleCourseId,
        moodleCourseName: updated.moodleCourseName,
        releaseMode: updated.releaseMode,
        startDate: updated.startDate,
      });

      setMoodleSaveStatus('success');
      setTimeout(() => setMoodleSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Error saving Moodle configuration:', err);
      showAlert('Error al configurar Moodle', err.message || 'Error desconocido', 'danger');
      setMoodleSaveStatus('error');
    } finally {
      setIsSavingMoodle(false);
    }
  };

  const loadUnlockCodes = async () => {
    if (!activeCourse) return;
    setIsFetchingCodes(true);
    try {
      const data = await coursesApi.getUnlockCodes(activeCourse.id);
      setUnlockCodes(data);
    } catch (err) {
      console.error('Error fetching unlock codes:', err);
    } finally {
      setIsFetchingCodes(false);
    }
  };

  useEffect(() => {
    if (activeCourse) {
      loadUnlockCodes();
    } else {
      setUnlockCodes([]);
    }
  }, [activeCourse]);

  const handleCreateCode = async () => {
    if (!activeCourse || !newCodeName) return;
    setIsCreatingCode(true);
    try {
      const targetMat = newCodeType === 'PARTIAL' 
        ? (newCodeTargetMateria || (materias.length > 0 ? materias[0] : null))
        : null;

      await coursesApi.createUnlockCode(activeCourse.id, {
        code: newCodeName.trim().toUpperCase(),
        type: newCodeType,
        targetMateria: targetMat,
        maxUses: newCodeMaxUses ? parseInt(newCodeMaxUses) : null,
        expiresAt: newCodeExpiresAt ? newCodeExpiresAt : null
      });
      setNewCodeName('');
      setNewCodeMaxUses('');
      setNewCodeExpiresAt('');
      showAlert('Código creado', 'El código de desbloqueo se ha generado correctamente.', 'success');
      await loadUnlockCodes();
    } catch (err: any) {
      console.error('Error creating unlock code:', err);
      showAlert('Error al crear código', err.message || 'Error desconocido', 'danger');
    } finally {
      setIsCreatingCode(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!activeCourse) return;
    try {
      await coursesApi.deleteUnlockCode(activeCourse.id, id);
      showAlert('Código eliminado', 'El código se ha eliminado correctamente.', 'success');
      await loadUnlockCodes();
    } catch (err: any) {
      console.error('Error deleting unlock code:', err);
      showAlert('Error al eliminar código', err.message || 'Error desconocido', 'danger');
    }
  };

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
      showAlert('Idioma existente', 'El código de idioma ya existe.', 'warning');
      return;
    }
    const updated = [...globalLanguages, { code: codeUpper, name: newLangName.trim() }];
    saveGlobalLanguages(updated);
    setNewLangCode('');
    setNewLangName('');
  };

  const handleRemoveGlobalLanguage = (code: string) => {
    if (code === 'ES') {
      showAlert('Acción no permitida', 'El idioma Español (ES) es requerido por defecto y no puede ser eliminado.', 'warning');
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
      showAlert('Acción no permitida', 'Debes seleccionar al menos un idioma para el curso.', 'warning');
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

  const materias = activeCourse 
    ? [...new Set(activeCourse.rows.map(r => r.materia).filter(m => m && m.trim()))]
    : [];

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

      {/* Moodle Integration Card */}
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
          background: 'linear-gradient(90deg, #8B5CF6, #EC4899)'
        }} />
        
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
            <Link size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>
              Sincronización con Moodle
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '2px 0 0 0' }}>
              Vincula este curso con un curso de Moodle para habilitar la actualización automática al aprobar maquetados.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '6px' }}>
              Moodle Course Shortname (ID del Curso):
            </label>
            <input
              type="text"
              value={moodleCourseId}
              onChange={(e) => setMoodleCourseId(e.target.value)}
              placeholder="Ej: moodle_shortname"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '6px' }}>
              Moodle Course Fullname (Nombre del Curso):
            </label>
            <input
              type="text"
              value={moodleCourseName}
              onChange={(e) => setMoodleCourseName(e.target.value)}
              placeholder="Ej: Curso Completo de IA"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '6px' }}>
            Modo de Disponibilización de Contenidos:
          </label>
          <select
            value={releaseMode}
            onChange={(e) => setReleaseMode(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '0.9rem',
              outline: 'none',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            <option value="FIXED">Por Fechas de Calendario (Fijas)</option>
            <option value="RELATIVE">Relativo por Días (Desde el primer ingreso del alumno)</option>
          </select>
        </div>

        {releaseMode === 'RELATIVE' && (
          <div style={{ marginBottom: '1.5rem' }} className="animate-fade-in">
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '6px' }}>
              Fecha de Inicio Oficial (Opcional):
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
            <span style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              Si se configura, los alumnos que ingresen antes de esta fecha deberán esperar a la misma para iniciar el cronograma dinámico. Quienes ingresen después iniciarán desde su día real de acceso.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            {moodleSaveStatus === 'success' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                <CheckCircle2 size={16} /> Configuración de Moodle guardada y vinculada.
              </span>
            )}
            {moodleSaveStatus === 'error' && (
              <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                ⚠️ Error al guardar la configuración de Moodle.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={async () => {
                if (!activeCourse) return;
                setIsSavingMoodle(true);
                setMoodleSaveStatus('idle');
                try {
                  const updated = await coursesApi.createInMoodle(activeCourse.id);
                  setMoodleCourseId(updated.moodleCourseId || '');
                  setMoodleCourseName(updated.moodleCourseName || '');
                  onUpdateCourse({
                    ...activeCourse,
                    moodleCourseId: updated.moodleCourseId,
                    moodleCourseName: updated.moodleCourseName
                  });
                  setMoodleSaveStatus('success');
                  setTimeout(() => setMoodleSaveStatus('idle'), 3000);
                } catch(err: any) {
                  console.error(err);
                  showAlert('Error al crear en Moodle', err.message || 'Error desconocido', 'danger');
                  setMoodleSaveStatus('error');
                } finally {
                  setIsSavingMoodle(false);
                }
              }}
              disabled={isSavingMoodle || !!moodleCourseId}
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
                cursor: (isSavingMoodle || !!moodleCourseId) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(20, 184, 166, 0.3)',
                transition: 'all 0.2s',
                opacity: (isSavingMoodle || !!moodleCourseId) ? 0.5 : 1
              }}
            >
              <Plus size={18} />
              Crear nuevo en Moodle
            </button>
            <button
              onClick={handleSaveMoodleConfig}
              disabled={isSavingMoodle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#8B5CF6',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: isSavingMoodle ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
                transition: 'all 0.2s',
                opacity: isSavingMoodle ? 0.7 : 1
              }}
            >
              <Save size={18} />
              {isSavingMoodle ? 'Guardando...' : 'Vincular manual'}
            </button>
          </div>
        </div>
      </div>

      {/* Unlock Codes Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
        padding: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{
            background: 'rgba(20, 184, 166, 0.1)',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#14b8a6'
          }}>
            <KeyRound size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', margin: 0 }}>
              Códigos de Desbloqueo (Bypass)
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '2px 0 0 0' }}>
              Genera códigos para que los alumnos los canjeen en Moodle y liberen las clases de este curso.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2.5rem' }}>
          {/* Form to generate a new code */}
          <div style={{ borderRight: '1px solid rgba(0,0,0,0.06)', paddingRight: '2rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#374151', marginBottom: '1rem', marginTop: 0 }}>
              Generar Nuevo Código
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Código (Ej: VIP-CURSO, LIBERAR-TODO):
                </label>
                <input
                  type="text"
                  placeholder="Ej: BYPASS-TOTAL"
                  value={newCodeName}
                  onChange={e => setNewCodeName(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.85rem',
                    outline: 'none',
                    fontWeight: 600
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Tipo de Liberación:
                </label>
                <select
                  value={newCodeType}
                  onChange={e => {
                    setNewCodeType(e.target.value);
                    if (e.target.value === 'TOTAL') {
                      setNewCodeTargetMateria('');
                    } else if (materias.length > 0) {
                      setNewCodeTargetMateria(materias[0]);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.85rem',
                    background: '#fff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="TOTAL">Liberar Todo el Curso</option>
                  <option value="PARTIAL">Liberar Materia/Módulo Específico</option>
                </select>
              </div>

              {newCodeType === 'PARTIAL' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Materia a Desbloquear:
                  </label>
                  <select
                    value={newCodeTargetMateria}
                    onChange={e => setNewCodeTargetMateria(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.85rem',
                      background: '#fff',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {materias.map((m, idx) => (
                      <option key={idx} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Límite Usos:
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ilimitado"
                    value={newCodeMaxUses}
                    onChange={e => setNewCodeMaxUses(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Expiración:
                  </label>
                  <input
                    type="date"
                    value={newCodeExpiresAt}
                    onChange={e => setNewCodeExpiresAt(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleCreateCode}
                disabled={isCreatingCode}
                style={{
                  background: '#14b8a6',
                  color: '#fff',
                  border: 'none',
                  padding: '0.7rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: isCreatingCode ? 'not-allowed' : 'pointer',
                  marginTop: '0.5rem',
                  boxShadow: '0 4px 10px rgba(20, 184, 166, 0.25)',
                  transition: 'all 0.2s',
                  opacity: isCreatingCode ? 0.7 : 1
                }}
              >
                {isCreatingCode ? 'Generando...' : 'Generar Código'}
              </button>
            </div>
          </div>

          {/* List of active codes */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#374151', marginBottom: '1rem', marginTop: 0 }}>
              Códigos Activos
            </h4>
            
            {isFetchingCodes ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', fontSize: '0.85rem' }}>
                Cargando códigos...
              </div>
            ) : unlockCodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f9fafb', borderRadius: '12px', border: '1px dashed #e5e7eb', color: '#9ca3af', fontSize: '0.85rem' }}>
                No hay códigos de desbloqueo activos para este curso.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                {unlockCodes.map((c: any) => {
                  const hasExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                  const reachesLimit = c.maxUses !== null && c.usedCount >= c.maxUses;
                  const isInactive = hasExpired || reachesLimit;
                  
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: isInactive ? '#f9fafb' : 'rgba(20, 184, 166, 0.03)',
                        border: isInactive ? '1px solid #e5e7eb' : '1px solid rgba(20, 184, 166, 0.15)',
                        borderRadius: '10px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: isInactive ? '#9ca3af' : '#0d9488', fontFamily: 'monospace' }}>
                            {c.code}
                          </span>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: c.type === 'TOTAL' ? '#8b5cf6' : '#ec4899',
                            color: '#fff'
                          }}>
                            {c.type === 'TOTAL' ? 'TOTAL' : `MATERIA: ${c.targetMateria}`}
                          </span>
                          {isInactive && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#ef4444', color: '#fff' }}>
                              INACTIVO
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '4px', fontSize: '0.75rem', color: '#6b7280' }}>
                          <span>Usos: <strong>{c.usedCount}</strong> {c.maxUses !== null ? `/ ${c.maxUses}` : '(Ilimitados)'}</span>
                          {c.expiresAt && (
                            <span style={{ color: hasExpired ? '#ef4444' : '#6b7280' }}>
                              Expira: <strong>{new Date(c.expiresAt).toLocaleDateString()}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteCode(c.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        title="Eliminar código"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
      {DialogRenderer}
    </div>
  );
};
