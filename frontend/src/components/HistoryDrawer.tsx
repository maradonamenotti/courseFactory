import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, RotateCcw, X, ChevronRight, User2, AlertCircle, Loader2 } from 'lucide-react';
import { historyApi, type ApiRowHistory } from '../services/api';

interface HistoryDrawerProps {
  rowId: string;
  courseId: string;
  rowLabel: string; // ej: "Clase 3 - Introducción"
  panel: number;
  onRestored: () => void; // callback para refrescar la tabla
  onClose: () => void;
}

const PANEL_LABELS: Record<number, string> = {
  1: 'Contenido',
  2: 'Multimedia',
  3: 'Verificación',
};

const PANEL_COLORS: Record<number, string> = {
  1: '#6366f1',
  2: '#f59e0b',
  3: '#10b981',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PanelBadge({ panel }: { panel: number }) {
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '2px 7px',
      borderRadius: '999px',
      background: PANEL_COLORS[panel] + '22',
      color: PANEL_COLORS[panel],
      border: `1px solid ${PANEL_COLORS[panel]}44`,
    }}>
      Panel {panel} · {PANEL_LABELS[panel] || 'Cambio'}
    </span>
  );
}

export function HistoryDrawer({
  rowId,
  courseId,
  rowLabel,
  panel,
  onRestored,
  onClose,
}: HistoryDrawerProps) {
  const [history, setHistory] = useState<ApiRowHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await historyApi.getRowHistory(courseId, rowId);
      setHistory(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [courseId, rowId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRestore = async (historyId: string) => {
    if (confirmId !== historyId) {
      setConfirmId(historyId);
      return;
    }
    setRestoringId(historyId);
    setConfirmId(null);
    try {
      await historyApi.restore(courseId, rowId, historyId);
      onRestored();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al restaurar');
      setRestoringId(null);
    }
  };

  const drawer = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Historial de cambios"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '440px',
        height: '100%',
        background: 'var(--bg-primary, #0f172a)',
        borderLeft: '1px solid var(--border, rgba(255,255,255,0.08))',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
        animation: 'slideInRight 0.25s ease-out',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--primary, #14b8a6)" />
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main, #f1f5f9)' }}>
                Historial de Cambios
              </span>
            </div>
            <button
              onClick={onClose}
              title="Cerrar"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted, #94a3b8)',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', paddingLeft: '26px' }}>
            {rowLabel}
          </span>
          <div style={{ paddingLeft: '26px', marginTop: '2px' }}>
            <PanelBadge panel={panel} />
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-muted, #94a3b8)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {error && (
            <div style={{
              margin: '16px',
              padding: '12px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '0.82rem',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--text-muted, #94a3b8)',
            }}>
              <Clock size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ margin: 0, fontSize: '0.88rem' }}>Sin historial de cambios todavía.</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', opacity: 0.7 }}>
                Los cambios se registrarán automáticamente.
              </p>
            </div>
          )}

          {!loading && history.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                position: 'relative',
                padding: '0 20px 0 44px',
                marginBottom: '2px',
              }}
            >
              {/* Timeline line */}
              {idx < history.length - 1 && (
                <div style={{
                  position: 'absolute',
                  left: '28px',
                  top: '28px',
                  bottom: '-4px',
                  width: '2px',
                  background: 'var(--border, rgba(255,255,255,0.06))',
                }} />
              )}

              {/* Timeline dot */}
              <div style={{
                position: 'absolute',
                left: '22px',
                top: '14px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: PANEL_COLORS[entry.panel] || '#64748b',
                border: '2px solid var(--bg-primary, #0f172a)',
                boxShadow: `0 0 0 2px ${PANEL_COLORS[entry.panel] || '#64748b'}44`,
              }} />

              <div style={{
                background: 'var(--bg-secondary, #1e293b)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '8px',
                border: '1px solid var(--border, rgba(255,255,255,0.06))',
              }}>
                {/* Meta row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <User2 size={12} color="var(--text-muted, #94a3b8)" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main, #f1f5f9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.userName}
                    </span>
                  </div>
                  <PanelBadge panel={entry.panel} />
                </div>

                {/* Date */}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} />
                  {formatDate(entry.createdAt)}
                </div>

                {/* Description */}
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary, #cbd5e1)',
                  lineHeight: 1.5,
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  marginBottom: '10px',
                  wordBreak: 'break-word',
                }}>
                  {entry.description || entry.changedFields.join(', ')}
                </div>

                {/* Restore button */}
                {confirmId === entry.id ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleRestore(entry.id)}
                      disabled={!!restoringId}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      {restoringId === entry.id
                        ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        : <RotateCcw size={12} />}
                      Confirmar Restaurar
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      style={{
                        padding: '6px 10px',
                        background: 'transparent',
                        color: 'var(--text-muted, #94a3b8)',
                        border: '1px solid var(--border, rgba(255,255,255,0.08))',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleRestore(entry.id)}
                    disabled={!!restoringId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      background: 'transparent',
                      color: 'var(--primary, #14b8a6)',
                      border: '1px solid var(--primary, #14b8a6)44',
                      borderRadius: '6px',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary, #14b8a6)18';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <RotateCcw size={11} />
                    Restaurar este estado
                    <ChevronRight size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border, rgba(255,255,255,0.08))',
            fontSize: '0.72rem',
            color: 'var(--text-muted, #94a3b8)',
            textAlign: 'center',
          }}>
            {history.length} cambio{history.length !== 1 ? 's' : ''} registrado{history.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  return createPortal(drawer, document.body);
}

export default HistoryDrawer;
