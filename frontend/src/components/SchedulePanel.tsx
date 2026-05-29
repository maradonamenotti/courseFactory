import React, { useRef, useState } from 'react';
import { Printer, CalendarDays, BookOpen, GraduationCap, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import type { CourseRow, Folder, Course } from '../types';

interface SchedulePanelProps {
  rows: CourseRow[];
  course: Course | undefined;
  folders: Folder[];
}

const FORMAT_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  VIDEO:        { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Video'        },
  GENIALLY:     { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6', label: 'Interactivo'  },
  TEXTO:        { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', label: 'Texto'        },
  CUESTIONARIO: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Cuestionario' },
  PDF:          { bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6', label: 'PDF'          },
  OTRO:         { bg: 'rgba(100,116,139,0.12)', color: '#64748b', label: 'Otro'         },
};

const MATERIA_COLORS = [
  { bg: 'rgba(79, 70, 229, 0.08)',  color: '#4f46e5', border: 'rgba(79, 70, 229, 0.15)' }, // Indigo
  { bg: 'rgba(13, 148, 136, 0.08)',  color: '#0d9488', border: 'rgba(13, 148, 136, 0.15)' }, // Teal
  { bg: 'rgba(219, 39, 119, 0.08)',  color: '#db2777', border: 'rgba(219, 39, 119, 0.15)' }, // Pink
  { bg: 'rgba(217, 119, 6, 0.08)',   color: '#d97706', border: 'rgba(217, 119, 6, 0.15)' },  // Amber
  { bg: 'rgba(16, 185, 129, 0.08)',  color: '#10b981', border: 'rgba(16, 185, 129, 0.15)' }, // Emerald
  { bg: 'rgba(37, 99, 235, 0.08)',   color: '#2563eb', border: 'rgba(37, 99, 235, 0.15)' },  // Blue
  { bg: 'rgba(147, 51, 234, 0.08)',  color: '#9333ea', border: 'rgba(147, 51, 234, 0.15)' }, // Purple
  { bg: 'rgba(225, 29, 72, 0.08)',   color: '#e11d48', border: 'rgba(225, 29, 72, 0.15)' },  // Rose
  { bg: 'rgba(75, 85, 99, 0.08)',    color: '#4b5563', border: 'rgba(75, 85, 99, 0.15)' },   // Gray
  { bg: 'rgba(234, 88, 12, 0.08)',   color: '#ea580c', border: 'rgba(234, 88, 12, 0.15)' },  // Orange
];


const SchedulePanel: React.FC<SchedulePanelProps> = ({ rows, course, folders }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  // Obtener la licencia del curso
  const licenciaFolder = folders.find(f => f.id === course?.folderId && f.type === 'licencia');
  const carreraFolder = licenciaFolder
    ? folders.find(f => f.id === licenciaFolder.parentId && f.type === 'carrera')
    : folders.find(f => f.id === course?.folderId && f.type === 'carrera');

  const licenciaNombre = licenciaFolder?.name || carreraFolder?.name || '';

  // Obtener materias únicas ordenadas para asignación estable de colores y cálculo de ancho
  const uniqueMaterias = Array.from(new Set(rows.map(r => r.materia || 'Sin materia'))).sort();
  const maxMateriaLength = uniqueMaterias.reduce((max, m) => Math.max(max, m.length), 0);
  const badgeWidth = Math.max(120, Math.min(300, maxMateriaLength * 7.5 + 20));

  const getMateriaStyle = (materiaName: string) => {
    const idx = uniqueMaterias.indexOf(materiaName);
    if (idx === -1) return { bg: 'rgba(100, 116, 139, 0.08)', color: '#64748b', border: 'rgba(100, 116, 139, 0.15)' };
    return MATERIA_COLORS[idx % MATERIA_COLORS.length];
  };


  // Agrupar filas por clase (modulo)
  const classesMap = new Map<string, CourseRow[]>();
  rows.forEach(row => {
    const moduloName = row.modulo || 'Sin clase';
    if (!classesMap.has(moduloName)) {
      classesMap.set(moduloName, []);
    }
    classesMap.get(moduloName)!.push(row);
  });

  interface ClassGroup {
    name: string;
    moduloNumero: string;
    materia: string;
    rows: CourseRow[];
  }

  // Convertir a array de grupos de clases y ordenar internamente las filas por Nro
  const classGroups: ClassGroup[] = Array.from(classesMap.entries()).map(([name, classRows]) => {
    const firstRow = classRows[0];
    return {
      name,
      moduloNumero: firstRow?.moduloNumero || '',
      materia: firstRow?.materia || 'Sin materia',
      rows: [...classRows].sort((a, b) => {
        const aNro = parseFloat(a.nro) || 0;
        const bNro = parseFloat(b.nro) || 0;
        return aNro - bNro;
      })
    };
  });

  // Ordenar de menor a mayor por el número de clase (moduloNumero)
  classGroups.sort((a, b) => {
    const numA = parseInt(a.moduloNumero, 10);
    const numB = parseInt(b.moduloNumero, 10);
    
    const hasA = !isNaN(numA);
    const hasB = !isNaN(numB);
    
    if (hasA && hasB) {
      return numA - numB;
    }
    if (hasA && !hasB) {
      return -1; // numA viene primero
    }
    if (!hasA && hasB) {
      return 1; // numB viene primero
    }
    // Si ninguno tiene un número válido, ordenar alfabéticamente por nombre de clase
    return a.name.localeCompare(b.name);
  });

  const toggleClass = (className: string) => {
    setCollapsedClasses(prev => {
      const next = new Set(prev);
      if (next.has(className)) {
        next.delete(className);
      } else {
        next.add(className);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedClasses(new Set());
  };

  const handleCollapseAll = () => {
    const allNames = classGroups.map(g => g.name);
    setCollapsedClasses(new Set(allNames));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* ── Estilos de impresión ───────────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .schedule-printable,
          .schedule-printable * { 
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .schedule-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 1rem !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .schedule-no-print { display: none !important; }
          .schedule-page-break { page-break-before: always; }
          .schedule-materia-block { break-inside: avoid; }
        }
      `}</style>

      <div style={{ padding: '0.5rem 0 2rem' }}>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="schedule-no-print" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(16,185,129,0.15))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 0 0 1px rgba(79,70,229,0.2)'
            }}>
              <CalendarDays size={22} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vista de solo lectura</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>Cronograma del curso para alumnos</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleExpandAll}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              <ChevronsUpDown size={14} /> Expandir todo
            </button>
            <button
              onClick={handleCollapseAll}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              <ChevronsDownUp size={14} /> Colapsar todo
            </button>
            <button
              onClick={handlePrint}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
            >
              <Printer size={16} /> Imprimir / Exportar PDF
            </button>
          </div>
        </div>

        {/* ── Área imprimible ──────────────────────────────────────────────── */}
        <div ref={printRef} className="schedule-printable" style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
        }}>

          {/* ── Encabezado del documento ─────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%)',
            padding: '2rem 2.5rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative circles */}
            <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', bottom: '-40px', right: '80px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

            {licenciaNombre && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                <GraduationCap size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {licenciaNombre}
                </span>
              </div>
            )}
            <h1 style={{
              margin: 0, color: '#fff', fontSize: '1.8rem', fontWeight: 800,
              fontFamily: 'var(--font-display)', lineHeight: 1.2, position: 'relative'
            }}>
              {course?.name || 'Cronograma del Curso'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.75rem' }}>
              <BookOpen size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                {rows.length} contenidos · {classGroups.length} {classGroups.length === 1 ? 'clase' : 'clases'}
              </span>
            </div>
          </div>

          {/* ── Contenido agrupado por clases ────────────────────────── */}
          <div style={{ padding: '1.5rem 2rem 2rem' }}>
            {classGroups.map((classGroup) => {
              const isCollapsed = collapsedClasses.has(classGroup.name);
              const matStyle = getMateriaStyle(classGroup.materia);
              return (
                <div key={classGroup.name} className="schedule-materia-block" style={{ marginBottom: '2rem' }}>
                  {/* Clase Header Line (incluye Materia) */}
                  <div 
                    onClick={() => toggleClass(classGroup.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 1.25rem',
                      borderLeft: '4px solid var(--accent)',
                      background: 'rgba(139,92,246,0.05)',
                      borderRadius: '0 8px 8px 0',
                      marginBottom: '0.85rem',
                      flexWrap: 'wrap',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleClass(classGroup.name);
                      }}
                      className="schedule-no-print"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {/* Materia Badge */}
                    <span 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: `${badgeWidth}px`,
                        background: matStyle.bg,
                        color: matStyle.color,
                        border: `1px solid ${matStyle.border}`,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flexShrink: 0
                      }}
                      title={classGroup.materia}
                    >
                      {classGroup.materia}
                    </span>

                    {classGroup.moduloNumero && (
                      <span style={{
                        background: 'var(--accent)', color: '#fff',
                        borderRadius: '6px', padding: '2px 8px',
                        fontSize: '0.75rem', fontWeight: 800, flexShrink: 0
                      }}>#{classGroup.moduloNumero}</span>
                    )}
                    <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CLASE:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{classGroup.name}</span>

                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {classGroup.rows.length} contenido{classGroup.rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Filas de contenido de esta clase */}
                  <div 
                    className="schedule-class-contents"
                    style={{ 
                      display: isCollapsed ? 'none' : 'flex', 
                      flexDirection: 'column', 
                      gap: '2px', 
                      paddingLeft: '1rem' 
                    }}
                  >
                    {classGroup.rows.map((row, rowIdx) => {
                      const fmt = FORMAT_COLORS[row.formato] || FORMAT_COLORS['OTRO'];
                      return (
                        <div key={row.id} style={{
                          display: 'grid',
                          gridTemplateColumns: '44px 1fr auto',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.5rem 0.85rem',
                          borderRadius: '8px',
                          background: rowIdx % 2 === 0 ? 'var(--bg-primary)' : 'transparent',
                          transition: 'background 0.15s'
                        }}>
                          {/* NRO */}
                          <div style={{
                            textAlign: 'center', fontWeight: 700,
                            fontSize: '0.9rem', color: 'var(--text-muted)',
                            background: 'var(--border)',
                            borderRadius: '6px', padding: '2px 4px',
                            fontVariantNumeric: 'tabular-nums'
                          }}>
                            {row.nro || (rowIdx + 1)}
                          </div>

                          {/* Descripción */}
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500, lineHeight: 1.4 }}>
                            {row.descripcion || <em style={{ color: 'var(--text-muted)' }}>Sin descripción</em>}
                          </div>

                          {/* Formato badge */}
                          <div style={{
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            background: fmt.bg,
                            color: fmt.color,
                            flexShrink: 0
                          }}>
                            {fmt.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <CalendarDays size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <p>No hay contenidos cargados en este curso todavía.</p>
              </div>
            )}
          </div>

          {/* ── Pie del documento ────────────────────────────────────── */}
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '1rem 2rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.02)'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {course?.name} · Cronograma de contenidos
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Generado el {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default SchedulePanel;
