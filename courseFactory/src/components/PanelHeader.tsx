import React from 'react';
import { Plus, ChevronDown, Edit2, BookOpen, FileDown, Trash2, Sun, Moon } from 'lucide-react';
import { type Course, type User, type Folder } from '../types';
import { useDialog } from './CustomDialog';

interface PanelHeaderProps {
  courses: Course[];
  folders: Folder[];
  activeCourseId: string;
  user: User;
  onSelectCourse: (id: string) => void;
  onCreateCourse: (folderId?: string) => void;
  onUpdateCourseName: (id: string, name: string) => void;
  onDeleteCourse: (id: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ 
  courses, 
  folders,
  activeCourseId,
  user,
  onSelectCourse, 
  onCreateCourse, 
  onUpdateCourseName,
  onDeleteCourse,
  theme,
  onToggleTheme
}) => {
  const activeCourse = courses.find(c => c.id === activeCourseId);
  const { showAlert, showConfirm, DialogRenderer } = useDialog();

  const getCoursePath = () => {
    if (!activeCourse || !activeCourse.folderId) return '';
    
    const licenseFolder = folders.find(f => f.id === activeCourse.folderId);
    if (!licenseFolder) return '';
    
    const careerFolder = licenseFolder.parentId ? folders.find(f => f.id === licenseFolder.parentId) : null;
    
    if (careerFolder) {
      return `${careerFolder.name} / ${licenseFolder.name} / `.toUpperCase();
    }
    return `${licenseFolder.name} / `.toUpperCase();
  };

  const handleExportPDF = () => {
    if (!activeCourse) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showAlert('Ventanas emergentes bloqueadas', 'Por favor habilita las ventanas emergentes (pop-ups) en tu navegador para generar el PDF.', 'warning');
      return;
    }

    let html = `
      <html>
        <head>
          <title>Estructura del Curso - ${activeCourse.name}</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 8px; font-size: 24px; }
            .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 40px; }
            .module { margin-top: 40px; page-break-inside: avoid; }
            .module-title { font-size: 1.25rem; font-weight: 700; color: #4338ca; margin-bottom: 16px; display: flex; alignItems: center; gap: 8px; }
            .module-title::before { content: ''; display: block; width: 4px; height: 20px; background-color: #4338ca; border-radius: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.95rem; }
            th, td { border: 1px solid #e2e8f0; padding: 12px 16px; text-align: left; }
            th { background-color: #f8fafc; font-weight: 600; color: #475569; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .format-badge { display: inline-block; padding: 2px 8px; background-color: #e0e7ff; color: #3730a3; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>${activeCourse.name}</h1>
          <div class="meta">Generado el ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
    `;

    // Group rows by module
    const modules: { [key: string]: typeof activeCourse.rows } = {};
    if (activeCourse.rows && activeCourse.rows.length > 0) {
      activeCourse.rows.forEach(row => {
        if (!modules[row.modulo]) modules[row.modulo] = [];
        modules[row.modulo].push(row);
      });

      Object.entries(modules).forEach(([moduleName, rows]) => {
        html += `
          <div class="module">
            <div class="module-title">${moduleName}</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 60px; text-align: center;">Nro</th>
                  <th>Tema / Descripción</th>
                  <th style="width: 140px;">Formato</th>
                </tr>
              </thead>
              <tbody>
        `;
        rows.forEach(row => {
          html += `
                <tr>
                  <td style="text-align: center; color: #64748b; font-weight: 500;">${row.nro}</td>
                  <td style="font-weight: 500;">${row.descripcion || '<span style="color:#94a3b8;font-style:italic">Sin descripción</span>'}</td>
                  <td><span class="format-badge">${row.formato}</span></td>
                </tr>
          `;
        });
        html += `
              </tbody>
            </table>
          </div>
        `;
      });
    } else {
      html += `<p style="color: #64748b; font-style: italic;">Este curso aún no tiene temas ni estructura definida.</p>`;
    }

    html += `
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="modern-panel-header">
      <div className="mph-main">
        <div className="mph-icon-wrapper">
          <BookOpen size={28} className="mph-icon" />
        </div>
        <div className="mph-title-section">
          <span className="mph-subtitle">{getCoursePath()}CURSO SELECCIONADO</span>
          <div className="mph-title-input-wrapper">
            <input
              type="text"
              className="mph-title-input"
              value={activeCourse?.name || ''}
              onChange={(e) => onUpdateCourseName(activeCourseId, e.target.value)}
              placeholder="Nombre del curso..."
            />
            <Edit2 size={16} className="mph-edit-icon" />
          </div>
        </div>
      </div>

      <div className="mph-actions">
        <button 
          className="btn btn-outline btn-icon-circle" 
          onClick={onToggleTheme} 
          title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <div className="mph-selector">
          <div className="mph-select-wrapper">
            <select 
              value={activeCourseId} 
              onChange={(e) => onSelectCourse(e.target.value)}
              className="mph-select"
              title="Cambiar curso"
            >
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="mph-select-icon" />
          </div>
        </div>

        <div className="mph-divider"></div>

        <button className="btn btn-primary mph-create-btn" onClick={() => onCreateCourse(activeCourse?.folderId)}>
          <Plus size={16} />
          <span>Nuevo Curso</span>
        </button>

        <button 
          className="btn btn-primary" 
          onClick={handleExportPDF} 
          title="Exportar estructura a PDF" 
        >
          <FileDown size={16} />
          <span>Exportar PDF</span>
        </button>

        {user.role === 'admin' && (
          <button 
            className="btn btn-danger" 
            onClick={() => {
              showConfirm(
                '🗑️ Borrar Curso',
                '¿Estás seguro de que deseas eliminar este curso? Esta acción no se puede deshacer.',
                () => onDeleteCourse(activeCourseId),
                'danger',
                'Eliminar',
                'Cancelar'
              );
            }}
            title="Borrar curso permanentemente"
          >
            <Trash2 size={16} />
            <span>Borrar</span>
          </button>
        )}
      </div>
      {DialogRenderer}
    </div>
  );
};

export default PanelHeader;
