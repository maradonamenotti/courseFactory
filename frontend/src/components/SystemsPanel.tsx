import React, { useState, useEffect } from 'react';
import { type CourseRow, type CourseTemplate } from '../types';
import { previewApi, getToken } from '../services/api';

import { PlayCircle, CheckCircle, Copy, Server, Loader2, ChevronDown, ChevronRight, Settings, Database, Download } from 'lucide-react';
import './SystemsPanel.css';
import { useDialog } from './CustomDialog';

interface SystemsPanelProps {
  rows: CourseRow[];
  templates: CourseTemplate[];
  courseId?: string;
  moodleCourseId?: string;
  moodleCourseName?: string;
  onSaveMoodleConfig?: (shortname: string, fullname: string) => Promise<void>;
  updateRow?: (id: string, field: keyof CourseRow | Partial<CourseRow>, value?: any) => void;
}



const SystemsPanel: React.FC<SystemsPanelProps> = ({ rows, courseId, moodleCourseId: initialMoodleCourseId = '', moodleCourseName: initialMoodleCourseName = '', onSaveMoodleConfig, updateRow }) => {
  // Se consideran listos aquellos cuyo diseño ha sido APROBADO en el Panel 3 (Verificación)
  const readyRows = rows.filter(
    r => r.aprobacionDiseno === 'APROBADO' && r.generatedHtml
  );

  const [coursePreviewToken, setCoursePreviewToken] = useState<string>('');
  const [courseBypassToken, setCourseBypassToken] = useState<string>('');
  const [loadingScheduleTokens, setLoadingScheduleTokens] = useState<boolean>(false);
  const [cronogramaTab, setCronogramaTab] = useState<'student' | 'teacher'>('student');
  const [cronogramaHeight, setCronogramaHeight] = useState<number>(600);
  const [downloadingBackup, setDownloadingBackup] = useState<boolean>(false);

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    try {
      const token = getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/backup/download`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al generar la copia de seguridad');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('content-disposition');
      let fileName = `coursefactory_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading backup:', err);
      alert('Error al descargar la copia de seguridad: ' + err.message);
    } finally {
      setDownloadingBackup(false);
    }
  };

  const [courseBackups, setCourseBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState<boolean>(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState<boolean>(false);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);

  const loadCourseBackups = async () => {
    if (!courseId) return;
    setLoadingBackups(true);
    try {
      const token = getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/backup/courses/${courseId}/list`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCourseBackups(data);
      }
    } catch (err) {
      console.error('Error al cargar backups del curso:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateCourseSnapshot = async () => {
    if (!courseId) return;
    setCreatingSnapshot(true);
    try {
      const token = getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/backup/courses/${courseId}/snapshot`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al crear punto de restauración');
      }
      alert('Punto de restauración creado con éxito');
      loadCourseBackups();
    } catch (err: any) {
      console.error('Error creating course snapshot:', err);
      alert(err.message);
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleRestoreCourseBackup = async (filename: string) => {
    if (!courseId) return;
    if (!window.confirm('ATENCIÓN: Se eliminarán todas las clases actuales de este curso y se reemplazarán por el estado guardado en esta copia de seguridad. ¿Estás seguro de que deseas continuar?')) {
      return;
    }
    setRestoringBackup(filename);
    try {
      const token = getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/backup/courses/${courseId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ filename })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al restaurar copia de seguridad');
      }
      alert('El curso ha sido restaurado con éxito. Por favor, haz clic en Aceptar para recargar la página.');
      window.location.reload();
    } catch (err: any) {
      console.error('Error restoring course backup:', err);
      alert(err.message);
    } finally {
      setRestoringBackup(null);
    }
  };

  const handleDownloadCourseBackup = async (filename: string) => {
    if (!courseId) return;
    try {
      const token = getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/backup/courses/${courseId}/download/${filename}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        throw new Error('Error al descargar el archivo de backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading course backup:', err);
      alert(err.message);
    }
  };

  useEffect(() => {
    if (!courseId) return;
    setLoadingScheduleTokens(true);
    previewApi.share(courseId)
      .then(res => {
        setCoursePreviewToken(res.token);
        setCourseBypassToken(res.bypassToken || '');
      })
      .catch(err => {
        console.error('Error fetching course schedule tokens:', err);
      })
      .finally(() => {
        setLoadingScheduleTokens(false);
      });
    loadCourseBackups();
  }, [courseId]);




  const [manuallyCopied, setManuallyCopied] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('coursefactory_manually_copied');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeTabs, setActiveTabs] = useState<Record<string, 'iframe' | 'html'>>({});
  const [iframeMode, setIframeMode] = useState<Record<string, 'clase' | 'countdown' | 'docente'>>({});

  const getRowPreviewUrl = (rowId: string) => {
    const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
    const baseUrl = apiBase.startsWith('http') ? apiBase : window.location.origin;
    return `${baseUrl}/api/preview/clase/${rowId}`;
  };


  
  const { showAlert, DialogRenderer } = useDialog();

  // ── Configuración global Moodle del curso ────────────────────────────────────
  const [moodleShortname, setMoodleShortname] = useState(initialMoodleCourseId);
  const [moodleFullname, setMoodleFullname] = useState(initialMoodleCourseName);
  const [savingMoodle, setSavingMoodle] = useState(false);
  const [moodleConfigOpen, setMoodleConfigOpen] = useState(!initialMoodleCourseId);

  const handleSaveMoodleConfig = async () => {
    if (!onSaveMoodleConfig) return;
    setSavingMoodle(true);
    try {
      await onSaveMoodleConfig(moodleShortname.trim(), moodleFullname.trim());
      showAlert('✅ Configuración guardada', 'Moodle configurado. Al aprobar diseños en Panel 3, se publicarán automáticamente en Moodle.', 'success');
      setMoodleConfigOpen(false);
    } catch {
      showAlert('Error', 'No se pudo guardar la configuración de Moodle.', 'danger');
    } finally {
      setSavingMoodle(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  // Estados de agrupamiento colapsables (iguales al panel 3)
  const [collapsedMaterias, setCollapsedMaterias] = useState<Set<string>>(new Set());
  const [collapsedModulos, setCollapsedModulos] = useState<Set<string>>(new Set());

  const toggleMateria = (materia: string) => {
    setCollapsedMaterias(prev => {
      const next = new Set(prev);
      if (next.has(materia)) next.delete(materia);
      else next.add(materia);
      return next;
    });
  };

  const toggleModulo = (key: string) => {
    setCollapsedModulos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleManuallyCopied = (rowId: string) => {
    setManuallyCopied(prev => {
      const updated = { ...prev, [rowId]: !prev[rowId] };
      try {
        localStorage.setItem('coursefactory_manually_copied', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };



  /**
   * Construye el HTML completo listo para Moodle:
   * Cabezal del sistema (100% inline CSS) + contenido generado por IA.
   * Sin dependencias de React, CSS externo ni fuentes — Moodle puede sanitizar el HTML
   * pero respeta los estilos inline.
   */
  const buildMoodleHtml = (html: string, row: CourseRow): string => {
    const cleanHtml = html
      .replace(/<h3[^>]*>[\s\S]*?📖[\s\S]*?<\/h3>/i, '')
      .replace(
        /(<div[^>]*class="[^"]*block-text[^"]*"[^>]*>[\s\S]{0,300}?)<h3[^>]*>\s*\d+\.\s*[\s\S]{1,150}<\/h3>\s*<p[^>]*>[\s\S]{1,250}<\/p>\s*<p[^>]*>[\s\S]{0,150}<\/p>/gi,
        '$1'
      );

    const headerHtml = `
<div style="
  background: linear-gradient(135deg, #0d3d38 0%, #0a2e2a 100%);
  border-left: 5px solid #14b8a6;
  padding: 2rem 2.5rem;
  margin-bottom: 1.5rem;
  font-family: 'Manrope', Arial, sans-serif;
  border-radius: 12px;
">
  ${row.materia ? `<p style="margin:0 0 0.4rem 0;font-size:0.9rem;font-weight:700;color:#14b8a6;text-transform:uppercase;letter-spacing:0.12em;font-family:Arial,sans-serif;">${row.materia}</p>` : ''}
  <h2 style="margin:0;font-family:Impact,Arial,sans-serif;font-size:2.2rem;font-weight:900;color:#ffffff;line-height:1.05;letter-spacing:0.03em;text-transform:uppercase;">${row.modulo || ''}</h2>
</div>`;

    return `${headerHtml}\n${cleanHtml}`;
  };



  const openPreview = (html: string, row?: { nro?: number | string; materia?: string; modulo?: string; descripcion?: string }) => {
    const headerHtml = row ? `
      <div style="
        background: linear-gradient(135deg, #0d3d38 0%, #0a2e2a 100%);
        border-left: 5px solid #14b8a6;
        padding: 2rem 2.5rem;
        margin-bottom: 1.5rem;
        font-family: 'Manrope', sans-serif;
      ">
        ${row.materia ? `<p style="margin:0 0 0.4rem 0;font-size:0.9rem;font-weight:700;color:#14b8a6;text-transform:uppercase;letter-spacing:0.12em;">${row.materia}</p>` : ''}
        <h2 style="margin:0;font-family:'Bebas Neue',Impact,sans-serif;font-size:2.4rem;font-weight:400;color:#ffffff;line-height:1.05;letter-spacing:0.03em;text-transform:uppercase;">${row.modulo || ''}</h2>
      </div>
    ` : '';
    const cleanHtml = html
      .replace(/<h3[^>]*>[\s\S]*?📖[\s\S]*?<\/h3>/i, '')
      .replace(
        /(<div[^>]*class="[^"]*block-text[^"]*"[^>]*>[\s\S]{0,300}?)<h3[^>]*>\s*\d+\.\s*[\s\S]{1,150}<\/h3>\s*<p[^>]*>[\s\S]{1,250}<\/p>\s*<p[^>]*>[\s\S]{0,150}<\/p>/gi,
        '$1'
      );
    const fullDoc = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet"><style>body{margin:0;padding:2rem;background:#f9fafb;}</style></head><body>${headerHtml}${cleanHtml}</body></html>`;
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  if (readyRows.length === 0) {
    return (
      <div className="panel-container empty-state animate-fade-in">
        <Server size={48} className="text-muted" />
        <h3>No hay clases con diseño aprobado</h3>
        <p className="text-muted">Las clases deben ser generadas con Gemini y tener su diseño aprobado en el Panel 3 (Verificación) antes de publicarse aquí.</p>
      </div>
    );
  }

  const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
  const baseUrl = apiBase.startsWith('http') ? apiBase : window.location.origin;
  const studentScheduleUrl = `${baseUrl}/api/preview/cronograma/${coursePreviewToken}`;
  const teacherScheduleUrl = `${baseUrl}/api/preview/cronograma/${coursePreviewToken}?token=${courseBypassToken}`;

  return (
    <div className="systems-panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
        <div className="header-top">
          <div>
            <h3>Panel Sistemas / Operador</h3>
            <p className="text-muted">Exportación y Publicación de Clases con Diseño Aprobado en Moodle.</p>
          </div>
        </div>
      </div>

      {/* ── Cronograma General del Curso (iFrame Moodle) ─────────────────────── */}
      {courseId && (
        <div className="cronograma-widget-container" style={{
          background: 'rgba(20, 184, 166, 0.05)',
          border: '1px solid rgba(20, 184, 166, 0.25)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Server size={20} style={{ color: '#14b8a6' }} />
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Cronograma General del Curso (iFrame Moodle)
              </h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Widget interactivo que lista todas las materias y clases. Los alumnos verán countdowns para clases futuras y podrán acceder directamente al contenido disponible.
              </p>
            </div>
          </div>

          {loadingScheduleTokens ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', justifyContent: 'center' }}>
              <Loader2 size={16} className="spin" style={{ color: '#14b8a6' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cargando enlaces del cronograma...</span>
            </div>
          ) : !coursePreviewToken ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#ef4444', fontSize: '0.85rem' }}>
              ❌ No se pudo generar el token de vista previa del curso.
            </div>
          ) : (
            <div className="cronograma-code-block" style={{
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Header de código con pestañas */}
              <div style={{
                padding: '0.5rem 0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px' }}>
                  <button
                    onClick={() => setCronogramaTab('student')}
                    style={{
                      border: 'none',
                      background: cronogramaTab === 'student' ? '#14b8a6' : 'transparent',
                      color: cronogramaTab === 'student' ? '#fff' : 'var(--text-muted)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Vista Estudiante (Recomendado)
                  </button>
                  <button
                    onClick={() => setCronogramaTab('teacher')}
                    style={{
                      border: 'none',
                      background: cronogramaTab === 'teacher' ? '#14b8a6' : 'transparent',
                      color: cronogramaTab === 'teacher' ? '#fff' : 'var(--text-muted)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Vista Docente (Bypass)
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => window.open(cronogramaTab === 'student' ? studentScheduleUrl : teacherScheduleUrl, '_blank')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
                      color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <PlayCircle size={14} /> Preview
                  </button>
                  <button
                    onClick={() => {
                      const code = cronogramaTab === 'teacher'
                        ? `<iframe id="moodle-cronograma-iframe" src="${teacherScheduleUrl}" width="100%" height="${cronogramaHeight}" frameborder="0" style="border:none; border-radius:12px; width: 100%; height: ${cronogramaHeight}px; transition: height 0.2s ease; overflow: auto;"></iframe>
<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'resize-iframe') {
      var iframe = document.getElementById('moodle-cronograma-iframe');
      if (iframe) { iframe.style.height = e.data.height + 'px'; }
    }
  });
</script>`
                        : `<div id="cf-cronograma-container"></div>
<script>
  (function() {
    var courseToken = "${coursePreviewToken}";
    var baseUrl = "${baseUrl}";
    var width = "100%";
    var height = "${cronogramaHeight}";
    
    var userId = (window.M && window.M.cfg && window.M.cfg.userid) || '';
    var userFullName = (window.M && window.M.cfg && window.M.cfg.userfullname) || '';
    
    var isTeacher = false;
    if (document.body.classList.contains('editing') || 
        document.body.classList.contains('path-admin') || 
        !!document.querySelector('.editing_button') || 
        !!document.querySelector('#node-tab-administration') ||
        (window.M && window.M.cfg && window.M.cfg.userrole === 'editingteacher')) {
      isTeacher = true;
    }
    
    var rol = isTeacher ? 'docente' : 'estudiante';
    var iframeUrl = baseUrl + '/api/preview/cronograma/' + courseToken + 
                    '?alumnoId=' + encodeURIComponent(userId) + 
                    '&alumnoNombre=' + encodeURIComponent(userFullName) + 
                    '&rol=' + rol;
    
    var iframe = document.createElement('iframe');
    iframe.id = 'moodle-cronograma-iframe';
    iframe.src = iframeUrl;
    iframe.width = width;
    iframe.height = height;
    iframe.frameBorder = '0';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.style.width = '100%';
    iframe.style.height = height + 'px';
    iframe.style.transition = 'height 0.2s ease';
    iframe.style.overflow = 'auto';
    
    document.getElementById('cf-cronograma-container').appendChild(iframe);
    
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'resize-iframe') {
        iframe.style.height = e.data.height + 'px';
      }
    });
  })();
</script>`;
                      navigator.clipboard.writeText(code);
                      showAlert('✅ Widget Copiado', 'Insertá este código HTML en Moodle para mostrar el cronograma adaptable.', 'success');
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
                      color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <Copy size={14} /> Copiar Código
                  </button>
                </div>
              </div>

              {/* Altura del iFrame */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                background: 'rgba(255, 255, 255, 0.01)'
              }}>
                <span>Altura del iFrame:</span>
                <input 
                  type="range" 
                  min="400" 
                  max="1500" 
                  step="50"
                  value={cronogramaHeight} 
                  onChange={(e) => setCronogramaHeight(parseInt(e.target.value))}
                  style={{ accentColor: '#14b8a6', cursor: 'pointer', width: '120px' }}
                />
                <span style={{ fontWeight: 700, color: '#14b8a6' }}>{cronogramaHeight}px</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>(Ajustar si Moodle bloquea el auto-escalado)</span>
              </div>

              {/* Textarea del iframe */}
              <textarea
                readOnly
                value={cronogramaTab === 'teacher'
                  ? `<iframe id="moodle-cronograma-iframe" src="${teacherScheduleUrl}" width="100%" height="${cronogramaHeight}" frameborder="0" style="border:none; border-radius:12px; width: 100%; height: ${cronogramaHeight}px; transition: height 0.2s ease; overflow: auto;"></iframe>
<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'resize-iframe') {
      var iframe = document.getElementById('moodle-cronograma-iframe');
      if (iframe) { iframe.style.height = e.data.height + 'px'; }
    }
  });
</script>`
                  : `<div id="cf-cronograma-container"></div>
<script>
  (function() {
    var courseToken = "${coursePreviewToken}";
    var baseUrl = "${baseUrl}";
    var width = "100%";
    var height = "${cronogramaHeight}";
    
    var userId = (window.M && window.M.cfg && window.M.cfg.userid) || '';
    var userFullName = (window.M && window.M.cfg && window.M.cfg.userfullname) || '';
    
    var isTeacher = false;
    if (document.body.classList.contains('editing') || 
        document.body.classList.contains('path-admin') || 
        !!document.querySelector('.editing_button') || 
        !!document.querySelector('#node-tab-administration') ||
        (window.M && window.M.cfg && window.M.cfg.userrole === 'editingteacher')) {
      isTeacher = true;
    }
    
    var rol = isTeacher ? 'docente' : 'estudiante';
    var iframeUrl = baseUrl + '/api/preview/cronograma/' + courseToken + 
                    '?alumnoId=' + encodeURIComponent(userId) + 
                    '&alumnoNombre=' + encodeURIComponent(userFullName) + 
                    '&rol=' + rol;
    
    var iframe = document.createElement('iframe');
    iframe.id = 'moodle-cronograma-iframe';
    iframe.src = iframeUrl;
    iframe.width = width;
    iframe.height = height;
    iframe.frameBorder = '0';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.style.width = '100%';
    iframe.style.height = height + 'px';
    iframe.style.transition = 'height 0.2s ease';
    iframe.style.overflow = 'auto';
    
    document.getElementById('cf-cronograma-container').appendChild(iframe);
    
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'resize-iframe') {
        iframe.style.height = e.data.height + 'px';
      }
    });
  })();
</script>`}
                style={{
                  width: '100%',
                  height: '90px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  padding: '0.75rem',
                  resize: 'none',
                  outline: 'none',
                  display: 'block',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{
                background: 'rgba(20,184,166,0.06)',
                borderTop: '1px solid rgba(20,184,166,0.15)',
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                color: '#14b8a6',
                textAlign: 'left'
              }}>
                {cronogramaTab === 'student' ? (
                  <span>💡 <strong>Vista Estudiante:</strong> Muestra countdowns para clases con fecha futura. Al cumplirse el plazo, se auto-libera en Moodle.</span>
                ) : (
                  <span>🔑 <strong>Vista Docente (Bypass):</strong> Muestra todas las clases desbloqueadas independientemente de la fecha. Ideal para supervisión.</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Configuración Moodle del Curso ──────────────────────────────────── */}
      <div style={{
        background: 'rgba(20, 184, 166, 0.06)',
        border: '1px solid rgba(20, 184, 166, 0.25)',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setMoodleConfigOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.85rem 1.25rem', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-primary)',
          }}
        >
          <Settings size={16} style={{ color: '#14b8a6' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Configuración Moodle del Curso</span>
          {moodleShortname ? (
            <span style={{
              marginLeft: 'auto', background: '#14b8a6', color: '#fff',
              fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px',
              borderRadius: '20px', letterSpacing: '0.06em'
            }}>✓ CONFIGURADO: {moodleShortname}</span>
          ) : (
            <span style={{
              marginLeft: 'auto', background: 'rgba(255,200,0,0.15)', color: '#f59e0b',
              fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px',
              borderRadius: '20px', letterSpacing: '0.06em'
            }}>⚠ SIN CONFIGURAR</span>
          )}
          {moodleConfigOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {moodleConfigOpen && (
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                Shortname del curso en Moodle
              </label>
              <input
                type="text"
                placeholder="Ej: 26LIC-PF-B"
                value={moodleShortname}
                onChange={e => setMoodleShortname(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                Nombre completo del curso
              </label>
              <input
                type="text"
                placeholder="Ej: Preparador Físico 26"
                value={moodleFullname}
                onChange={e => setMoodleFullname(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              onClick={handleSaveMoodleConfig}
              disabled={savingMoodle || !moodleShortname.trim()}
              style={{
                padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none',
                background: '#14b8a6', color: '#fff', fontWeight: 700,
                fontSize: '0.82rem', cursor: savingMoodle ? 'wait' : 'pointer',
                opacity: !moodleShortname.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
              }}
            >
              {savingMoodle ? <><Loader2 size={14} className="spin" /> Guardando...</> : 'Guardar'}
            </button>
          </div>
        )}
      </div>
      {/* ──────────────────────────────────────────────────────────────────────── */}

      {/* ── Copia de Seguridad y Backups ───────────────────────────────────── */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.06)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.85rem 1.25rem', color: 'var(--text-primary)',
          borderBottom: '1px solid rgba(59, 130, 246, 0.15)'
        }}>
          <Database size={16} style={{ color: '#3b82f6' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Copias de Seguridad y Restauración del Curso</span>
          <span style={{
            marginLeft: 'auto', background: '#3b82f6', color: '#fff',
            fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px',
            borderRadius: '20px', letterSpacing: '0.06em'
          }}>GESTIÓN DE VERSIONES</span>
        </div>
        
        <div style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '1.25rem' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.45' }}>
                Resguarda las clases, agenda, videos y configuraciones de este curso. Puedes crear puntos de restauración manuales antes de realizar cambios importantes, o restaurar a una versión previa (del historial automático de la última semana).
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={handleCreateCourseSnapshot}
                disabled={creatingSnapshot}
                style={{
                  padding: '0.55rem 1.1rem', borderRadius: '8px', border: 'none',
                  background: '#3b82f6', color: '#fff', fontWeight: 700,
                  fontSize: '0.8rem', cursor: creatingSnapshot ? 'wait' : 'pointer',
                  opacity: creatingSnapshot ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem'
                }}
              >
                {creatingSnapshot ? <Loader2 size={14} className="spin" /> : <Database size={14} />}
                Crear Punto de Restauración
              </button>
              <button
                onClick={handleDownloadBackup}
                disabled={downloadingBackup}
                style={{
                  padding: '0.55rem 1.1rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.4)',
                  background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontWeight: 700,
                  fontSize: '0.8rem', cursor: downloadingBackup ? 'wait' : 'pointer',
                  opacity: downloadingBackup ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem'
                }}
              >
                {downloadingBackup ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                Descargar DB Global (.sql)
              </button>
            </div>
          </div>

          {/* Historial de Backups del Curso */}
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{
              padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)'
            }}>
              <span>FECHA Y HORA</span>
              <span>TIPO</span>
              <span>TAMAÑO</span>
              <span style={{ textAlign: 'right' }}>ACCIONES</span>
            </div>
            
            {loadingBackups ? (
              <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <Loader2 size={16} className="spin" /> Cargando historial de copias...
              </div>
            ) : courseBackups.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No hay puntos de restauración registrados para este curso.
              </div>
            ) : (
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {courseBackups.map((b) => (
                  <div key={b.filename} style={{
                    padding: '0.65rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.03)',
                    display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr', alignItems: 'center', fontSize: '0.8rem'
                  }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {new Date(b.date).toLocaleString()}
                    </span>
                    <span>
                      {b.isAuto ? (
                        <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>AUTOMÁTICO</span>
                      ) : (
                        <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>MANUAL</span>
                      )}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {(b.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => handleDownloadCourseBackup(b.filename)}
                        style={{
                          background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 700
                        }}
                        title="Descargar snapshot JSON"
                      >
                        <Download size={12} /> Bajar
                      </button>
                      <button
                        onClick={() => handleRestoreCourseBackup(b.filename)}
                        disabled={restoringBackup !== null}
                        style={{
                          background: 'none', border: 'none', color: '#ef4444', cursor: restoringBackup !== null ? 'wait' : 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 700,
                          opacity: restoringBackup !== null ? 0.5 : 1
                        }}
                        title="Restaurar este estado"
                      >
                        {restoringBackup === b.filename ? (
                          <><Loader2 size={12} className="spin" />...</>
                        ) : (
                          <>Restaurar</>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ──────────────────────────────────────────────────────────────────────── */}

      {(() => {
        const materias = Array.from(new Set(readyRows.map(r => r.materia)));
        return materias.map((materiaName, materiaIndex) => {
          const materiaRows = readyRows.filter(r => r.materia === materiaName);
          const modulos = Array.from(new Set(materiaRows.map(r => r.modulo))).sort((a, b) => {
            const rowA = materiaRows.find(r => r.modulo === a);
            const rowB = materiaRows.find(r => r.modulo === b);
            const numA = parseInt(rowA?.moduloNumero || '0', 10);
            const numB = parseInt(rowB?.moduloNumero || '0', 10);
            const hasA = !isNaN(numA) && rowA?.moduloNumero !== '';
            const hasB = !isNaN(numB) && rowB?.moduloNumero !== '';
            if (hasA && hasB) return numA - numB;
            if (hasA && !hasB) return -1;
            if (!hasA && hasB) return 1;
            return (a || '').localeCompare(b || '');
          });
          const isMateriaCollapsed = collapsedMaterias.has(materiaName);

          return (
            <div key={`materia-${materiaIndex}`} className="materia-group" style={{ marginBottom: '2rem' }}>
              {/* Materia Header */}
              <div 
                className="materia-header" 
                onClick={() => toggleMateria(materiaName)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  background: 'rgba(0, 150, 143, 0.12)', 
                  padding: '0.8rem 1rem', 
                  borderRadius: '8px', 
                  borderBottom: '2px solid rgba(0, 150, 143, 0.25)',
                  marginBottom: isMateriaCollapsed ? '0' : '1.5rem',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}
                  onClick={(e) => { e.stopPropagation(); toggleMateria(materiaName); }}
                >
                  {isMateriaCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                </button>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  MATERIA: {materiaName || 'Sin Materia'}
                </span>
              </div>

              {!isMateriaCollapsed && modulos.map((modName, modIndex) => {
                const modRows = materiaRows.filter(r => r.modulo === modName);
                const firstRow = modRows[0];
                const moduloNumero = firstRow?.moduloNumero || '';
                const moduloKey = `${materiaName}::${modName}`;
                const isModuloCollapsed = collapsedModulos.has(moduloKey);

                return (
                  <div key={`mod-${modIndex}`} className="modulo-group" style={{ marginLeft: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Módulo Header */}
                    <div 
                      className="modulo-header" 
                      onClick={() => toggleModulo(moduloKey)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        background: 'rgba(81, 172, 192, 0.08)', 
                        padding: '0.6rem 1rem', 
                        borderRadius: '6px', 
                        borderBottom: '1px solid rgba(81, 172, 192, 0.15)',
                        marginBottom: isModuloCollapsed ? '0' : '1.5rem',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary-hover)', display: 'flex', alignItems: 'center' }}
                        onClick={(e) => { e.stopPropagation(); toggleModulo(moduloKey); }}
                      >
                        {isModuloCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {moduloNumero && (
                        <span style={{
                          background: 'var(--primary)', color: '#fff',
                          borderRadius: '6px', padding: '2px 8px',
                          fontSize: '0.72rem', fontWeight: 800, flexShrink: 0,
                          marginLeft: '0.25rem', marginRight: '0.25rem'
                        }}>
                          #{moduloNumero}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        CLASE: {modName || 'Sin Clase'}
                      </span>
                    </div>

                    {(() => {
                      const mainReadyRow = modRows.find(r => r.aprobacionDiseno === 'APROBADO' && r.generatedHtml);
                      if (!mainReadyRow) return null;
                      
                      const row = mainReadyRow;
                      const status: string = 'idle';

                      const html = row.generatedHtml || '';
                      const moduleName = row.modulo || 'Sin Clase';
                      const activeTab = activeTabs[row.id] || 'iframe';
                      const currentIframeMode = iframeMode[row.id] || 'clase';

                      let codeToDisplay = '';
                      let previewUrl = '';

                      if (activeTab === 'html') {
                        codeToDisplay = buildMoodleHtml(html, row);
                      } else {
                        if (currentIframeMode === 'clase') {
                          previewUrl = getRowPreviewUrl(row.id);
                          codeToDisplay = `<iframe src="${previewUrl}" width="100%" height="900" frameborder="0" style="border:none; border-radius:12px;"></iframe>`;
                        } else if (currentIframeMode === 'countdown') {
                          previewUrl = `${getRowPreviewUrl(row.id)}?mode=countdown`;
                          codeToDisplay = `<iframe src="${previewUrl}" width="100%" height="120" frameborder="0" style="border:none;"></iframe>`;
                        } else {
                          previewUrl = `${getRowPreviewUrl(row.id)}?token=${row.bypassToken || ''}`;
                          codeToDisplay = previewUrl;
                        }
                      }

                      const handleCopyClick = () => {
                        navigator.clipboard.writeText(codeToDisplay);
                        if (activeTab === 'html') {
                          showAlert('✅ Código copiado', 'HTML completo con cabezal copiado.', 'success');
                        } else {
                          if (currentIframeMode === 'clase') {
                            showAlert('✅ iFrame de Clase Copiado', 'Insertá este código en el Contenido Moodle.', 'success');
                          } else if (currentIframeMode === 'countdown') {
                            showAlert('✅ iFrame de Cuenta Regresiva Copiado', 'Insertá este código en la Descripción Moodle.', 'success');
                          } else {
                            showAlert('✅ Enlace Docente Copiado', 'Enlace de vista previa especial con bypass copiado.', 'success');
                          }
                        }

                        // Marcar como copiado
                        setManuallyCopied(prev => {
                          const updated = { ...prev, [row.id]: true };
                          try {
                            localStorage.setItem('coursefactory_manually_copied', JSON.stringify(updated));
                          } catch (err) {
                            console.error(err);
                          }
                          return updated;
                        });
                      };

                      const handlePreviewClick = () => {
                        if (activeTab === 'html') {
                          openPreview(html, row);
                        } else {
                          window.open(previewUrl, '_blank');
                        }
                      };

                      return (
                        <div className="systems-row-layout" key={row.id}>
                          <div 
                            className={`system-card-horizontal ${status === 'published' || (status === 'idle' && manuallyCopied[row.id]) ? 'card-completed' : ''}`} 
                            style={{ 
                              borderLeft: `4px solid ${
                                status === 'published' || (status === 'idle' && manuallyCopied[row.id]) 
                                  ? 'var(--status-available)' 
                                  : 'var(--primary)'
                              }` 
                            }}
                          >
                            {/* Columna Izquierda: Información de Clase y Estado */}
                            <div className="system-col-info">
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <span className="badge" style={{ background: 'var(--accent)', color: '#fff', marginBottom: '0.4rem' }}>
                                  {row.materia || 'Sin Materia'}
                                </span>
                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.3 }}>
                                  {row.moduloNumero && (
                                    <span style={{
                                      background: 'var(--primary)',
                                      color: '#fff',
                                      borderRadius: '4px',
                                      padding: '2px 6px',
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                      marginRight: '0.5rem',
                                      display: 'inline-block',
                                      verticalAlign: 'middle'
                                    }}>
                                      #{row.moduloNumero}
                                    </span>
                                  )}
                                  <span style={{ verticalAlign: 'middle' }}>{moduleName}</span>
                                </h4>
                              </div>
                              
                              <div 
                                className={`systems-status-badge ${status} ${status === 'idle' && manuallyCopied[row.id] ? 'manual-copied' : ''}`} 
                                style={{ 
                                  fontSize: '0.75rem', 
                                  cursor: status === 'idle' ? 'pointer' : 'default',
                                  width: 'fit-content',
                                  marginTop: '0.85rem'
                                }}
                                onClick={() => status === 'idle' && toggleManuallyCopied(row.id)}
                                title={status === 'idle' ? "Clic para alternar estado de copiado manual" : undefined}
                              >
                                {status === 'idle' && (
                                  manuallyCopied[row.id] ? (
                                    <><CheckCircle size={12} /> Copiado Manualmente</>
                                  ) : (
                                    'Listo para Moodle'
                                  )
                                )}
                                {status === 'publishing' && <><Loader2 size={12} className="spin" /> Conectando API...</>}
                                {status === 'published' && <><CheckCircle size={12} /> Publicado</>}
                              </div>
                            </div>

                            <div className="system-col-code">
                              <div className="code-block">
                                <div className="code-header" style={{ padding: '0.4rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px' }}>
                                    <button
                                      onClick={() => setActiveTabs(prev => ({ ...prev, [row.id]: 'iframe' }))}
                                      style={{
                                        border: 'none',
                                        background: activeTab === 'iframe' ? '#14b8a6' : 'transparent',
                                        color: activeTab === 'iframe' ? '#fff' : 'var(--text-muted)',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      iFrame (Recomendado)
                                    </button>
                                    <button
                                      onClick={() => setActiveTabs(prev => ({ ...prev, [row.id]: 'html' }))}
                                      style={{
                                        border: 'none',
                                        background: activeTab === 'html' ? '#14b8a6' : 'transparent',
                                        color: activeTab === 'html' ? '#fff' : 'var(--text-muted)',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      HTML Clásico
                                    </button>
                                  </div>
                                  <div className="code-actions">
                                    <button onClick={handlePreviewClick} title="Vista Previa"><PlayCircle size={16} /> Preview</button>
                                    <button onClick={handleCopyClick} title="Copiar"><Copy size={16} /> Copiar</button>
                                  </div>
                                </div>

                                {activeTab === 'iframe' && (
                                  <div style={{ display: 'flex', gap: '6px', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <button
                                      onClick={() => setIframeMode(prev => ({ ...prev, [row.id]: 'clase' }))}
                                      style={{
                                        flex: 1, border: '1px solid rgba(20,184,166,0.3)', borderRadius: '6px',
                                        background: currentIframeMode === 'clase' ? 'rgba(20,184,166,0.15)' : 'transparent',
                                        color: currentIframeMode === 'clase' ? '#14b8a6' : 'var(--text-muted)',
                                        fontSize: '0.7rem', fontWeight: 600, padding: '4px 6px', cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      iFrame Clase
                                    </button>
                                    <button
                                      onClick={() => setIframeMode(prev => ({ ...prev, [row.id]: 'countdown' }))}
                                      style={{
                                        flex: 1, border: '1px solid rgba(20,184,166,0.3)', borderRadius: '6px',
                                        background: currentIframeMode === 'countdown' ? 'rgba(20,184,166,0.15)' : 'transparent',
                                        color: currentIframeMode === 'countdown' ? '#14b8a6' : 'var(--text-muted)',
                                        fontSize: '0.7rem', fontWeight: 600, padding: '4px 6px', cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      iFrame Cuenta Regresiva
                                    </button>
                                    <button
                                      onClick={() => setIframeMode(prev => ({ ...prev, [row.id]: 'docente' }))}
                                      style={{
                                        flex: 1, border: '1px solid rgba(20,184,166,0.3)', borderRadius: '6px',
                                        background: currentIframeMode === 'docente' ? 'rgba(20,184,166,0.15)' : 'transparent',
                                        color: currentIframeMode === 'docente' ? '#14b8a6' : 'var(--text-muted)',
                                        fontSize: '0.7rem', fontWeight: 600, padding: '4px 6px', cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      Vista Docente (Bypass)
                                    </button>
                                  </div>
                                )}

                                <textarea readOnly value={codeToDisplay} className="html-textarea" />
                                
                                <div style={{ 
                                  background: 'rgba(20,184,166,0.06)', 
                                  borderTop: '1px solid rgba(20,184,166,0.15)', 
                                  padding: '0.5rem 0.75rem', 
                                  fontSize: '0.75rem', 
                                  color: '#14b8a6', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '6px' 
                                }}>
                                  {activeTab === 'html' ? (
                                    <span>⚠️ <strong>HTML Clásico:</strong> Si hacés cambios, tenés que volver a copiar y pegar en Moodle.</span>
                                  ) : currentIframeMode === 'clase' ? (
                                    <span>💡 <strong>iFrame de Clase:</strong> Para la pestaña de Contenido del recurso. Habilitará el acceso el día programado.</span>
                                  ) : currentIframeMode === 'countdown' ? (
                                    <span>⏳ <strong>Cuenta Regresiva:</strong> Widget pequeño para el campo Descripción. Avisa al alumno el tiempo restante.</span>
                                  ) : (
                                    <span>🔑 <strong>Enlace Docente:</strong> Link directo que ignora la fecha de bloqueo (bypass). Guardar para tu uso personal.</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Columna Derecha: Disponibilidad por Fecha */}
                            <div className="system-col-moodle">
                              <div style={{
                                background: 'rgba(20, 184, 166, 0.05)',
                                border: '1px solid rgba(20, 184, 166, 0.2)',
                                borderRadius: '10px',
                                padding: '1.25rem 1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.6rem',
                                height: '100%',
                                boxSizing: 'border-box',
                                justifyContent: 'center'
                              }}>
                                <h5 style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', margin: '0', color: '#14b8a6', fontWeight: 700 }}>
                                  📅 Disponibilidad
                                </h5>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0', lineHeight: 1.4 }}>
                                  Establecé la fecha de inicio. Antes de este día, los alumnos verán un reloj con cuenta regresiva.
                                </p>
                                <input 
                                  type="date" 
                                  value={row.fechaDisponibilidad || ''}
                                  onChange={(e) => {
                                    if (updateRow) {
                                      updateRow(row.id, 'fechaDisponibilidad', e.target.value || null);
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          );
        });
      })()}
      {DialogRenderer}
    </div>
  );
};

export default SystemsPanel;
