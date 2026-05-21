import React, { useState } from 'react';
import { type CourseDesign, type CourseTemplate, type TemplateBlockType, type CourseRow, defaultDesign, initialBlockCodes, mapFormatoToBlockType } from '../types';
import { Monitor, Palette, Type, Plus, Trash2, LayoutTemplate, Layers, FileCode, Info } from 'lucide-react';
import './DesignPanel.css';

interface DesignPanelProps {
  templates: CourseTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<CourseTemplate[]>>;
  rows: CourseRow[];
}

const fonts = [
  'Plus Jakarta Sans',
  'Manrope',
  'Inter',
  'Outfit',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins'
];

const replacePreviewPlaceholders = (code: string, row?: CourseRow) => {
  if (!code) return '';
  if (!row) {
    return code
      .replace(/\[NRO\]/g, '1')
      .replace(/\[MODULO\]/g, 'Introducción al Desarrollo Web')
      .replace(/\[DESCRIPCION\]/g, 'En esta clase aprenderás los conceptos fundamentales de HTML, CSS y JavaScript para dar tus primeros pasos en la programación.')
      .replace(/\[URL_VIDEO_VIMEO\]/g, 'https://player.vimeo.com/video/76979871')
      .replace(/\[URL_ENLACES_ADJUNTOS\]/g, '#')
      .replace(/\[URL_GENIALLY\]/g, 'https://view.genial.ly/609a87d00f7c220d9d4bfde7');
  }

  const nro = row.nro || '';
  const modulo = row.modulo || '';
  const descripcion = row.descripcion || '';
  const urlVideoVimeo = row.videoVimeo || row.videoDrive || row.links || '';
  const urlGenially = row.geniallyUrl || row.links || '';
  const urlEnlacesAdjuntos = row.links || '';

  return code
    .replace(/\[NRO\]/g, nro)
    .replace(/\[MODULO\]/g, modulo)
    .replace(/\[DESCRIPCION\]/g, descripcion)
    .replace(/\[URL_VIDEO_VIMEO\]/g, urlVideoVimeo)
    .replace(/\[URL_ENLACES_ADJUNTOS\]/g, urlEnlacesAdjuntos)
    .replace(/\[URL_GENIALLY\]/g, urlGenially);
};

const getBlockTypeLabel = (type: string) => {
  switch (type) {
    case 'text': return 'Texto';
    case 'video': return 'Video';
    case 'pdf': return 'Genially';
    case 'cuestionario': return 'Cuestionario';
    case 'custom': return 'Custom';
    default: return type;
  }
};

const DesignPanel: React.FC<DesignPanelProps> = ({ templates, setTemplates, rows }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [selectedBaseCodeType, setSelectedBaseCodeType] = useState<TemplateBlockType>('text');

  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  const updateActiveTemplate = (updatedTemplate: CourseTemplate) => {
    setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
  };

  const updateDesign = (field: keyof CourseDesign, value: string) => {
    if (!activeTemplate) return;
    updateActiveTemplate({
      ...activeTemplate,
      design: { ...activeTemplate.design, [field]: value }
    });
  };

  const updateBaseBlockCode = (type: TemplateBlockType, code: string) => {
    if (!activeTemplate) return;
    const currentCustomCodes = activeTemplate.customBlockCodes || { ...initialBlockCodes };
    updateActiveTemplate({
      ...activeTemplate,
      customBlockCodes: {
        ...currentCustomCodes,
        [type]: code
      }
    });
  };

  const applyBaseCodeToExistingBlocks = (type: TemplateBlockType) => {
    if (!activeTemplate) return;
    const codeToApply = activeTemplate.customBlockCodes?.[type] ?? initialBlockCodes[type];
    updateActiveTemplate({
      ...activeTemplate,
      blocks: activeTemplate.blocks.map(b => b.type === type ? { ...b, customCode: codeToApply } : b)
    });
  };

  const handleTemplateNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTemplate) return;
    updateActiveTemplate({ ...activeTemplate, name: e.target.value });
  };

  const addTemplate = () => {
    const initialBlocks = rows.map((row) => {
      const type = mapFormatoToBlockType(row.formato);
      return {
        id: row.id,
        type,
        customCode: initialBlockCodes[type]
      };
    });

    const newTemplate: CourseTemplate = {
      id: Date.now().toString(),
      name: `Nueva Plantilla ${templates.length + 1}`,
      design: { ...defaultDesign },
      blocks: initialBlocks,
      customBlockCodes: { ...initialBlockCodes }
    };
    setTemplates([...templates, newTemplate]);
    setSelectedTemplateId(newTemplate.id);
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (templates.length <= 1) return;
    const newTemplates = templates.filter(t => t.id !== id);
    setTemplates(newTemplates);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(newTemplates[0].id);
    }
  };

  const updateBlockCode = (blockId: string, code: string) => {
    if (!activeTemplate) return;
    updateActiveTemplate({
      ...activeTemplate,
      blocks: activeTemplate.blocks.map(b => b.id === blockId ? { ...b, customCode: code } : b)
    });
  };

  return (
    <div className="design-panel-wrapper">
      
      {/* Sidebar: Templates List */}
      <div className="design-sidebar glass-panel">
        <div className="sidebar-header">
          <h3><LayoutTemplate size={20} className="text-primary" /> Mis Plantillas</h3>
          <button className="add-template-btn" onClick={addTemplate} title="Añadir Plantilla">
            <Plus size={18} />
          </button>
        </div>
        <div className="templates-list">
          {templates.map(template => (
            <div 
              key={template.id} 
              className={`template-item ${template.id === selectedTemplateId ? 'active' : ''}`}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              <div className="template-item-content">
                <LayoutTemplate size={16} />
                <span>{template.name}</span>
              </div>
              {templates.length > 1 && (
                <button className="delete-btn" onClick={(e) => deleteTemplate(template.id, e)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Settings Panel for Active Template */}
      {activeTemplate && (
        <div className="design-controls glass-panel">
          <div className="template-name-editor">
            <input 
              type="text" 
              value={activeTemplate.name} 
              onChange={handleTemplateNameChange} 
              className="template-name-input"
            />
          </div>

          <h3 className="section-title">
            <Palette size={18} className="text-primary" /> Colores
          </h3>
          
          <div className="control-group">
            <label>Color Primario</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.primaryColor} 
                onChange={(e) => updateDesign('primaryColor', e.target.value)}
              />
              <span>{activeTemplate.design.primaryColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="control-group">
            <label>Color Secundario</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.secondaryColor} 
                onChange={(e) => updateDesign('secondaryColor', e.target.value)}
              />
              <span>{activeTemplate.design.secondaryColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="control-group">
            <label>Fondo</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.backgroundColor} 
                onChange={(e) => updateDesign('backgroundColor', e.target.value)}
              />
              <span>{activeTemplate.design.backgroundColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="control-group">
            <label>Superficie</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.surfaceColor} 
                onChange={(e) => updateDesign('surfaceColor', e.target.value)}
              />
              <span>{activeTemplate.design.surfaceColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="control-group">
            <label>Texto</label>
            <div className="color-input-wrapper">
              <input 
                type="color" 
                value={activeTemplate.design.textColor} 
                onChange={(e) => updateDesign('textColor', e.target.value)}
              />
              <span>{activeTemplate.design.textColor.toUpperCase()}</span>
            </div>
          </div>

          <h3 className="section-title mt-4">
            <Type size={18} className="text-primary" /> Tipografía
          </h3>

          <div className="control-group">
            <label>Titulares</label>
            <select 
              className="font-select"
              value={activeTemplate.design.headlineFont}
              onChange={(e) => updateDesign('headlineFont', e.target.value)}
            >
              {fonts.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="control-group">
            <label>Cuerpo</label>
            <select 
              className="font-select"
              value={activeTemplate.design.bodyFont}
              onChange={(e) => updateDesign('bodyFont', e.target.value)}
            >
              {fonts.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <h3 className="section-title mt-4">
            <FileCode size={18} className="text-primary" /> Códigos Base de Bloques
          </h3>
          <div className="base-code-editor-section" style={{
            background: 'rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div className="base-code-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '0.75rem', overflowX: 'auto', paddingBottom: '4px' }}>
              {(['text', 'video', 'pdf', 'cuestionario', 'custom'] as TemplateBlockType[]).map((type) => (
                <button
                  key={type}
                  className={`base-code-tab-btn ${selectedBaseCodeType === type ? 'active' : ''}`}
                  onClick={() => setSelectedBaseCodeType(type)}
                  style={{
                    flex: '1',
                    whiteSpace: 'nowrap',
                    padding: '6px 8px',
                    fontSize: '0.7rem',
                    borderRadius: '6px',
                    border: '1px solid transparent',
                    background: selectedBaseCodeType === type ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                    color: selectedBaseCodeType === type ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textTransform: 'none',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  {selectedBaseCodeType === type && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }}></span>}
                  {getBlockTypeLabel(type)}
                </button>
              ))}
            </div>
            
            <div className="base-code-textarea-wrapper">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  PLANTILLA BASE PARA EL BLOQUE:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--primary-color)', 
                      fontSize: '0.7rem', 
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => updateBaseBlockCode(selectedBaseCodeType, initialBlockCodes[selectedBaseCodeType])}
                    title="Restablecer este tipo al código base por defecto"
                  >
                    Restablecer
                  </button>
                  <button 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--primary-color)', 
                      fontSize: '0.7rem', 
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => applyBaseCodeToExistingBlocks(selectedBaseCodeType)}
                    title="Aplicar este código base a todos los bloques de este tipo ya colocados en la plantilla"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
              <textarea 
                style={{
                  width: '100%',
                  height: '110px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#10b981', 
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  padding: '0.5rem',
                  resize: 'vertical'
                }}
                value={activeTemplate.customBlockCodes?.[selectedBaseCodeType] ?? initialBlockCodes[selectedBaseCodeType]}
                onChange={(e) => updateBaseBlockCode(selectedBaseCodeType, e.target.value)}
                placeholder={`Escribe el código HTML/CSS base para bloques de tipo ${getBlockTypeLabel(selectedBaseCodeType)}...`}
              />
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: '1.2' }}>
                * Cualquier bloque nuevo de tipo <strong>{getBlockTypeLabel(selectedBaseCodeType)}</strong> se creará usando esta estructura base.
              </p>
            </div>
          </div>

          <h3 className="section-title mt-4" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={18} className="text-primary" /> Estructura de Clases
          </h3>
          
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.75rem',
            color: 'var(--text-color)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            lineHeight: '1.4'
          }}>
            <Info size={16} className="text-primary" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Sincronización Activa:</strong> Esta estructura se genera automáticamente según las clases y formatos configurados en el <strong>Panel 1: Contenido</strong>.
            </div>
          </div>

          {activeTemplate.blocks.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '1.5rem',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              No hay clases cargadas en el Panel 1 del curso actual.
            </div>
          ) : (
            <div className="blocks-list">
              {activeTemplate.blocks.map((block, index) => {
                const row = rows.find(r => r.id === block.id);
                const label = row 
                  ? `Clase ${row.nro}: ${row.modulo || 'Sin título'} (${getBlockTypeLabel(block.type)})`
                  : `Clase ${index + 1}: ${getBlockTypeLabel(block.type)}`;
                return (
                  <div key={block.id} className="block-item">
                    <div className="block-item-header">
                      <div className="block-item-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          background: 'rgba(255,255,255,0.1)', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          color: 'var(--text-muted)'
                        }}>{index + 1}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{label}</span>
                      </div>
                    </div>
                    <div className="block-custom-code">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          CÓDIGO HTML/CSS DEL BLOQUE:
                        </label>
                        <button 
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--primary-color)', 
                            fontSize: '0.65rem', 
                            cursor: 'pointer',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            transition: 'background 0.2s'
                          }}
                          onClick={() => updateBlockCode(block.id, activeTemplate.customBlockCodes?.[block.type] ?? initialBlockCodes[block.type] ?? '')}
                          title="Restablecer al código base de la plantilla"
                        >
                          Restablecer
                        </button>
                      </div>
                      <textarea 
                        value={block.customCode !== undefined ? block.customCode : (activeTemplate.customBlockCodes?.[block.type] ?? initialBlockCodes[block.type] ?? '')} 
                        onChange={(e) => updateBlockCode(block.id, e.target.value)}
                        placeholder={`Escribe el código HTML/CSS para el bloque de ${block.type}...`}
                        style={{
                          width: '100%',
                          height: '90px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '4px',
                          color: '#34d399', 
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          padding: '0.5rem',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Live Preview Area */}
      {activeTemplate && (
        <div className="design-preview-area">
          <div className="preview-header">
            <h4><Monitor size={16} style={{ display: 'inline', marginRight: '0.5rem' }} /> Vista Previa: {activeTemplate.name}</h4>
          </div>
          
          <div 
            className="preview-content"
            style={{
              '--theme-primary': activeTemplate.design.primaryColor,
              '--theme-secondary': activeTemplate.design.secondaryColor,
              '--theme-bg': activeTemplate.design.backgroundColor,
              '--theme-surface': activeTemplate.design.surfaceColor,
              '--theme-text': activeTemplate.design.textColor,
              '--font-headline': `"${activeTemplate.design.headlineFont}", sans-serif`,
              '--font-body': `"${activeTemplate.design.bodyFont}", sans-serif`
            } as React.CSSProperties}
          >
            
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <div className="preview-badge">Módulo Demostrativo</div>
              <h2 className="preview-title">Título <span>Principal</span></h2>
              <p className="preview-subtitle">Subtítulo o descripción breve del curso</p>
              <div style={{ width: '80px', height: '6px', backgroundColor: 'var(--theme-primary)', margin: '0 auto', borderRadius: '4px' }}></div>
            </div>

            {activeTemplate.blocks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--theme-secondary)' }}>
                No hay clases cargadas en el Panel 1 para el curso actual.
              </div>
            )}

            {activeTemplate.blocks.map(block => {
              const blockCode = block.customCode !== undefined ? block.customCode : (activeTemplate.customBlockCodes?.[block.type] ?? initialBlockCodes[block.type] ?? '');
              const row = rows.find(r => r.id === block.id);
              const renderedCode = replacePreviewPlaceholders(blockCode, row);
              return (
                <div key={block.id} className="preview-block-wrapper" style={{ width: '100%', marginBottom: '1.5rem' }}>
                  <div dangerouslySetInnerHTML={{ __html: renderedCode }} />
                </div>
              );
            })}

          </div>
        </div>
      )}
    </div>
  );
};

export default DesignPanel;
