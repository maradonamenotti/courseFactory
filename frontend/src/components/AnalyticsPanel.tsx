import React from 'react';
import { type Course } from '../types';
import { CheckCircle, Clock, BookOpen, Briefcase } from 'lucide-react';
import './AnalyticsPanel.css';

interface AnalyticsPanelProps {
  courses: Course[];
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ courses }) => {
  // Global Course Metrics
  const totalCourses = courses.length;
  const finishedCourses = courses.filter(c => c.rows.length > 0 && c.rows.every(r => r.estadoFinal === 'LISTO PARA MOODLE')).length;

  // Topic Level Metrics
  const allRows = courses.flatMap(c => c.rows);
  const totalTopics = allRows.length;
  
  const getFormatDistribution = () => {
    const counts = allRows.reduce((acc, row) => {
      acc[row.formato] = (acc[row.formato] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const formatDistribution = getFormatDistribution();

  // For a progress line, we show a pipeline: 
  // Content -> Multimedia -> Verificación -> Listos
  
  // Logic to determine stage:
  // 1. Content: AprobacionContenido != APROBADO
  // 2. Multimedia: AprobacionContenido == APROBADO && AprobacionMultimedia != APROBADO
  // 3. Verificacion: AprobacionMultimedia == APROBADO && EstadoFinal != LISTO PARA MOODLE
  // 4. Listos: EstadoFinal == LISTO PARA MOODLE

  const stageReady = allRows.filter(r => r.estadoFinal === 'LISTO PARA MOODLE').length;
  const stageVerification = allRows.filter(r => r.aprobacionContenido === 'APROBADO' && r.aprobacionMultimedia === 'APROBADO' && r.estadoFinal !== 'LISTO PARA MOODLE').length;
  const stageMultimedia = allRows.filter(r => r.aprobacionContenido === 'APROBADO' && r.aprobacionMultimedia !== 'APROBADO').length;
  const stageContent = allRows.filter(r => r.aprobacionContenido !== 'APROBADO' && r.estadoFinal !== 'LISTO PARA MOODLE').length;

  return (
    <div className="analytics-container animate-fade-in">
      <div className="panel-header">
        <h3>Panel de Analítica y Progreso</h3>
        <p className="text-muted">Métricas generales del desarrollo del curso y estado de avance.</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card glass-panel">
          <div className="metric-icon bg-purple-100 text-purple-600">
            <Briefcase size={24} />
          </div>
          <div className="metric-info">
            <h4>Cursos Creados</h4>
            <span className="metric-value">{totalCourses}</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon bg-green-100 text-green-600">
            <CheckCircle size={24} />
          </div>
          <div className="metric-info">
            <h4>Cursos Publicados</h4>
            <span className="metric-value">{finishedCourses}</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon bg-blue-100 text-blue-600">
            <BookOpen size={24} />
          </div>
          <div className="metric-info">
            <h4>Total Temas / Clases</h4>
            <span className="metric-value">{totalTopics}</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon bg-yellow-100 text-yellow-600">
            <Clock size={24} />
          </div>
          <div className="metric-info">
            <h4>Temas en Producción</h4>
            <span className="metric-value">{stageContent + stageMultimedia + stageVerification}</span>
          </div>
        </div>
      </div>

      <div className="charts-container">
        <div className="chart-card glass-panel">
          <h4>Línea de Avance (Pipeline de Producción)</h4>
          <div className="pipeline-wrapper">
            <div className="pipeline-connector"></div>
            
            <div className="pipeline-stage">
              <div className={`stage-circle ${stageContent > 0 ? 'active' : ''}`}>1</div>
              <div className="stage-name">Contenido</div>
              <div className="stage-count">{stageContent} temas</div>
            </div>
            
            <div className="pipeline-stage">
              <div className={`stage-circle ${stageMultimedia > 0 ? 'active' : ''}`}>2</div>
              <div className="stage-name">Multimedia</div>
              <div className="stage-count">{stageMultimedia} temas</div>
            </div>
            
            <div className="pipeline-stage">
              <div className={`stage-circle ${stageVerification > 0 ? 'active' : ''}`}>3</div>
              <div className="stage-name">Verificación</div>
              <div className="stage-count">{stageVerification} temas</div>
            </div>
            
            <div className="pipeline-stage">
              <div className={`stage-circle ${stageReady > 0 ? 'active' : ''}`}>4</div>
              <div className="stage-name">Listos / Pub.</div>
              <div className="stage-count">{stageReady} temas</div>
            </div>
          </div>
        </div>

        <div className="chart-card glass-panel">
          <h4>Distribución de Formatos</h4>
          <div className="formats-list">
            {formatDistribution.length === 0 && <p className="text-muted text-sm">No hay temas</p>}
            {formatDistribution.map((format, index) => (
              <div key={index} className="format-item">
                <span className="format-name">{format.name || 'Sin formato'}</span>
                <div className="format-bar-wrapper">
                  <div 
                    className="format-bar" 
                    style={{ width: `${(format.value / totalTopics) * 100}%` }}
                  ></div>
                </div>
                <span className="format-count">{format.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
