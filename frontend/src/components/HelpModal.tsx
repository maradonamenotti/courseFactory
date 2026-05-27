import React from 'react';
import { X, FileText, MonitorPlay, CheckCircle, Palette, Settings, BarChart2 } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
}

const helpContent: Record<string, { title: string, icon: React.ReactNode, steps: { text: string, tip?: string }[] }> = {
  panel1: {
    title: "Panel de Contenido",
    icon: <FileText size={20} />,
    steps: [
      { text: "Creá clases con el botón 'Añadir Clase' que aparece al final de la tabla.", tip: "Podés renombrar una clase haciendo doble clic sobre su encabezado." },
      { text: "Dentro de cada clase, usá 'Añadir fila' (+) para crear una nueva fila de contenido." },
      { text: "Completá el número de clase, la descripción del tema y seleccioná el formato de salida (Video, PDF, Genially, etc.)." },
      { text: "Subí el archivo del guion usando el ícono de carga (↑) en la columna de guion.", tip: "Formatos aceptados: PDF, DOCX, TXT." },
      { text: "Cuando la clase esté lista para pasar a edición multimedia, cambiá el estado a 'DISPONIBLE'." },
      { text: "Podés arrastrar y soltar las filas entre clases para reorganizar el contenido." }
    ]
  },
  panel2: {
    title: "Panel Multimedia",
    icon: <MonitorPlay size={20} />,
    steps: [
      { text: "Revisá las clases que el equipo de Contenido ha marcado como 'DISPONIBLE' — solo esas están listas para editar." },
      { text: "Descargá o visualizá el guion base de cada clase para producir el recurso multimedia.", tip: "El link al guion aparece en la columna 'Guion'." },
      { text: "Producí el recurso según el formato solicitado: Video (YouTube/Drive), Genially, PDF interactivo, etc." },
      { text: "Pegá el enlace del recurso final en la columna 'Links'. Si es un video, usá la columna 'Video Drive'.", tip: "Los campos Links y Video Drive se sincronizan automáticamente cuando el formato es VIDEO." },
      { text: "Actualizá el estado: '3-CORREGIR' si necesita revisión, '4-DISPONIBLE' si ya está listo para verificación." }
    ]
  },
  panel3: {
    title: "Panel de Verificación",
    icon: <CheckCircle size={20} />,
    steps: [
      { text: "Revisá los contenidos multimedia finales entregados por el equipo de Edición." },
      { text: "Compará el recurso multimedia con el guion original para asegurar coherencia y calidad." },
      { text: "Usá los checkboxes de verificación para aprobar el Contenido (guion) y/o el recurso Multimedia por separado.", tip: "Ambas verificaciones deben estar aprobadas para que la clase avance." },
      { text: "Si encontrás errores, cambiá el estado a '3-CORREGIR' y agregá una nota explicando el problema." },
      { text: "Una vez aprobado todo, la clase queda lista para ser procesada en el Panel de Sistemas." }
    ]
  },
  panel4: {
    title: "Panel de Maquetado",
    icon: <Palette size={20} />,
    steps: [
      { text: "Definí la estética global del curso: colores primarios, secundarios, tipografías y fondo." },
      { text: "Seleccioná una plantilla base o creá una nueva desde la barra lateral del panel.", tip: "Cada plantilla tiene su propio conjunto de bloques de código personalizables." },
      { text: "Editá el código HTML/CSS de cada bloque (PDF, Video, Texto, Genially) para personalizar cómo se verán en el LMS." },
      { text: "Usá la vista previa en vivo para ver cómo queda el diseño antes de exportar." },
      { text: "Los cambios de plantilla se aplican a todas las clases del curso automáticamente." }
    ]
  },
  panel5: {
    title: "Panel de Sistemas",
    icon: <Settings size={20} />,
    steps: [
      { text: "Verificá el estado global del curso: todas las clases deberían estar verificadas (indicadores en verde)." },
      { text: "Seleccioná la plantilla de diseño que se usará para la exportación desde el selector superior." },
      { text: "Revisá la vista previa de cada clase con el diseño aplicado antes de generar el paquete.", tip: "Hacé clic en una clase para ver cómo quedará en el LMS." },
      { text: "Generá el paquete SCORM (.zip) usando el botón 'Generar SCORM' para subirlo a Moodle u otro LMS." },
      { text: "También podés exportar clases individuales desde la tabla de estado usando el botón de descarga." }
    ]
  },
  panel6: {
    title: "Panel de Analítica",
    icon: <BarChart2 size={20} />,
    steps: [
      { text: "Monitoreá el progreso general de producción de todos los cursos desde el dashboard." },
      { text: "El gráfico de distribución de estados muestra cuántas clases hay en cada fase (Pendiente, En Proceso, Disponible, etc.)." },
      { text: "Identificá cuellos de botella: muchas clases 'EN PROCESO' o en 'CORREGIR' indican áreas que necesitan atención.", tip: "Prestá especial atención a la proporción de clases en estado 'CORREGIR'." },
      { text: "Revisá las métricas por formato (Video, PDF, Genially) para entender la distribución del contenido." },
      { text: "Usá la información de verificación (contenido vs multimedia) para evaluar el avance de calidad." }
    ]
  }
};

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, activeTab }) => {
  if (!isOpen) return null;

  const content = helpContent[activeTab] || helpContent['panel1'];

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="modal-content" style={{
        background: 'var(--bg-secondary)', width: '100%', maxWidth: '540px',
        borderRadius: '16px', padding: '0', overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border)',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.2)', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              {content.icon}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{content.title}</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', opacity: 0.8 }}>Guía de uso paso a paso</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
            width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s'
          }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
             onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>
            <X size={20} />
          </button>
        </div>
        
        {/* Body - scrollable */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
            Seguí estos pasos para completar tu trabajo en esta sección:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {content.steps.map((step, index) => (
              <div key={index} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-primary)',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                transition: 'border-color 0.2s'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  color: 'white',
                  width: '26px', height: '26px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '0.75rem', flexShrink: 0, marginTop: '1px'
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.88rem', lineHeight: '1.5' }}>
                    {step.text}
                  </p>
                  {step.tip && (
                    <p style={{
                      margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--primary)',
                      fontStyle: 'italic', lineHeight: '1.4',
                      padding: '4px 8px',
                      background: 'rgba(79, 70, 229, 0.06)',
                      borderRadius: '4px',
                      borderLeft: '2px solid var(--primary)'
                    }}>
                      💡 {step.tip}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          <button className="btn btn-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
