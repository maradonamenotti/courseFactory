import React, { useState } from 'react';
import { Video, Link, Calendar, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import type { CourseRow } from '../types';

interface ConferencePanelProps {
  rows: CourseRow[];
  courseId?: string;
  updateRow: (id: string, field: any, value?: any) => void | Promise<any>;
}

export const ConferencePanel: React.FC<ConferencePanelProps> = ({ rows, courseId: _courseId, updateRow }) => {
  // Filtrar filas de formato MEET
  const meetRows = rows.filter(r => r.formato === 'MEET');

  // Estados de guardado locales para feedback visual
  const [savingStates, setSavingStates] = useState<Record<string, { saving: boolean; success: boolean }>>({});

  const handleFieldChange = async (rowId: string, field: keyof CourseRow, value: any) => {
    // Activar estado de guardado
    setSavingStates(prev => ({
      ...prev,
      [rowId]: { saving: true, success: false }
    }));

    try {
      await updateRow(rowId, field, value);
      
      // Mostrar éxito
      setSavingStates(prev => ({
        ...prev,
        [rowId]: { saving: false, success: true }
      }));

      // Apagar indicador de éxito tras 2 segundos
      setTimeout(() => {
        setSavingStates(prev => ({
          ...prev,
          [rowId]: { ...prev[rowId], success: false }
        }));
      }, 2000);
    } catch (err) {
      console.error('Error al actualizar conferencia:', err);
      setSavingStates(prev => ({
        ...prev,
        [rowId]: { saving: false, success: false }
      }));
    }
  };

  if (meetRows.length === 0) {
    return (
      <div className="panel-container empty-state animate-fade-in" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '65vh',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <div style={{
          background: 'rgba(236, 72, 153, 0.1)',
          border: '1.5px solid rgba(236, 72, 153, 0.3)',
          borderRadius: '50%',
          width: '80px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          color: '#ec4899',
          boxShadow: '0 8px 30px rgba(236, 72, 153, 0.2)'
        }}>
          <Video size={36} className="animate-pulse" />
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>No hay conferencias programadas</h3>
        <p className="text-muted" style={{ maxWidth: '480px', fontSize: '0.92rem', lineHeight: 1.5 }}>
          Para programar una videoconferencia, primero crea un recurso en el <strong>Panel 1: Contenido</strong> y selecciona <strong>MEET</strong> como su formato de salida.
        </p>
      </div>
    );
  }

  return (
    <div className="analytics-container animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Cabecera del Panel */}
      <div className="panel-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '1rem'
      }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={22} style={{ color: '#ec4899' }} />
            Gestión de Conferencias y Clases en Vivo
          </h3>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Configura los accesos, fecha/hora y temarios para las videoconferencias activas en este curso.
          </p>
        </div>
      </div>

      {/* Grid de Conferencias */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
        gap: '1.5rem',
        marginTop: '0.5rem'
      }}>
        {meetRows.map((row) => {
          const rowState = savingStates[row.id] || { saving: false, success: false };

          return (
            <div key={row.id} className="glass-card" style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.4)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(236, 72, 153, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
            }}>
              
              {/* Badge Decorativo Lateral */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '4px',
                height: '100%',
                background: '#ec4899'
              }} />

              {/* Fila superior: Info y status de guardado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {row.materia && (
                    <span style={{
                      alignSelf: 'flex-start',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#ec4899',
                      background: 'rgba(236, 72, 153, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      {row.materia}
                    </span>
                  )}
                  <h4 style={{ margin: '4px 0 0 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Clase {row.moduloNumero || row.nro}: {row.modulo}
                  </h4>
                </div>

                {/* Spinner / Guardado indicator */}
                <div style={{ display: 'flex', alignItems: 'center', height: '24px' }}>
                  {rowState.saving && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>
                      <Loader2 size={14} className="spin" />
                      <span>Guardando...</span>
                    </div>
                  )}
                  {rowState.success && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-available)', fontSize: '0.75rem', fontWeight: 600 }} className="animate-fade-in">
                      <CheckCircle2 size={14} />
                      <span>Guardado</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Formulario de Configuración */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Enlace del Meet */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link size={14} style={{ color: '#ec4899' }} />
                    Enlace de Google Meet / Conferencia
                  </label>
                  <input
                    type="url"
                    defaultValue={row.meetLink || ''}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    onBlur={(e) => {
                      if (e.target.value !== (row.meetLink || '')) {
                        handleFieldChange(row.id, 'meetLink', e.target.value.trim() || null);
                      }
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      borderRadius: '8px',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.88rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#ec4899'}
                  />
                </div>

                {/* Fecha y Hora */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} style={{ color: '#ec4899' }} />
                    Fecha y Hora de la Reunión
                  </label>
                  <input
                    type="datetime-local"
                    defaultValue={row.meetDateTime || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (row.meetDateTime || '')) {
                        handleFieldChange(row.id, 'meetDateTime', e.target.value || null);
                      }
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      borderRadius: '8px',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.88rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      width: '100%',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#ec4899'}
                  />
                </div>

                {/* Descripción / Agenda */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} style={{ color: '#ec4899' }} />
                    Descripción / Temario de la Conferencia
                  </label>
                  <textarea
                    defaultValue={row.meetDescripcion || ''}
                    placeholder="Temario de la sesión, lecturas previas o enlaces a documentos de apoyo..."
                    onBlur={(e) => {
                      if (e.target.value !== (row.meetDescripcion || '')) {
                        handleFieldChange(row.id, 'meetDescripcion', e.target.value.trim() || null);
                      }
                    }}
                    rows={3}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      borderRadius: '8px',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.88rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      resize: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                      lineHeight: 1.4
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#ec4899'}
                  />
                </div>

              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
