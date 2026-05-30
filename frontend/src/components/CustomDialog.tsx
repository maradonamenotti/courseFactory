import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DialogVariant = 'info' | 'warning' | 'danger' | 'success';

interface BaseDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  variant?: DialogVariant;
  onClose: () => void;
}

interface AlertDialogProps extends BaseDialogProps {
  type: 'alert';
  onConfirm?: never;
  options?: never;
  inputLabel?: never;
  inputPlaceholder?: never;
  defaultValue?: never;
}

interface ConfirmDialogProps extends BaseDialogProps {
  type: 'confirm';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  options?: never;
  inputLabel?: never;
  inputPlaceholder?: never;
  defaultValue?: never;
}

interface PromptDialogProps extends BaseDialogProps {
  type: 'prompt';
  inputLabel?: string;
  inputPlaceholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  options?: never;
}

interface SelectDialogProps extends BaseDialogProps {
  type: 'select';
  options: { id: string | null; label: string }[];
  onConfirm: (option: { id: string | null; label: string }) => void;
  inputLabel?: never;
  inputPlaceholder?: never;
  defaultValue?: never;
}

export type DialogProps =
  | AlertDialogProps
  | ConfirmDialogProps
  | PromptDialogProps
  | SelectDialogProps;

// ─── Icon helper ──────────────────────────────────────────────────────────────

const variantIcon = (variant: DialogVariant) => {
  switch (variant) {
    case 'danger':   return <AlertTriangle size={22} color="#ef4444" />;
    case 'warning':  return <AlertTriangle size={22} color="#f59e0b" />;
    case 'success':  return <CheckCircle   size={22} color="#10b981" />;
    default:         return <Info          size={22} color="var(--accent)" />;
  }
};

const variantColor = (variant: DialogVariant) => {
  switch (variant) {
    case 'danger':  return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'success': return '#10b981';
    default:        return 'var(--accent)';
  }
};

// ─── CustomDialog component ───────────────────────────────────────────────────

const CustomDialog: React.FC<DialogProps> = (props) => {
  const { isOpen, title, message, variant = 'info', onClose } = props;

  const [inputValue, setInputValue] = useState('');
  const [selectedOption, setSelectedOption] = useState<{ id: string | null; label: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (props.type === 'prompt') setInputValue(props.defaultValue || '');
      if (props.type === 'select') setSelectedOption(null);
      // Focus input or first element after transition
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accentColor = variantColor(variant);

  const handleConfirm = () => {
    if (props.type === 'confirm') {
      props.onConfirm();
      onClose();
    } else if (props.type === 'prompt') {
      if (!inputValue.trim()) return;
      props.onConfirm(inputValue.trim());
      onClose();
    } else if (props.type === 'select') {
      if (!selectedOption) return;
      props.onConfirm(selectedOption);
      onClose();
    } else {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
  };

  const confirmLabel =
    props.type === 'confirm' ? (props.confirmLabel || 'Confirmar') :
    props.type === 'alert'   ? 'Entendido' :
    props.type === 'prompt'  ? 'Aceptar' :
    'Seleccionar';

  const cancelLabel = props.type === 'confirm' ? (props.cancelLabel || 'Cancelar') : 'Cancelar';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 15, 15, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: props.type === 'select' ? '480px' : '420px',
          background: 'var(--bg-secondary)',
          border: `1px solid ${accentColor}22`,
          borderRadius: '18px',
          boxShadow: `0 32px 64px -12px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}18`,
          overflow: 'hidden',
          animation: 'dialogSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1.25rem 1.5rem 1rem',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {variantIcon(variant)}
          </div>
          <h3 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            flex: 1,
            fontFamily: 'var(--font-display)'
          }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-primary)'; e.currentTarget.style.color = 'var(--text-main)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6
          }}>
            {message}
          </p>

          {/* Prompt input */}
          {props.type === 'prompt' && (
            <div style={{ marginTop: '1rem' }}>
              {props.inputLabel && (
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  {props.inputLabel}
                </label>
              )}
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={props.inputPlaceholder || ''}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: `1.5px solid ${accentColor}50`,
                  borderRadius: '10px',
                  padding: '0.65rem 0.9rem',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={e => {
                  e.target.style.borderColor = accentColor;
                  e.target.style.boxShadow = `0 0 0 3px ${accentColor}20`;
                }}
                onBlur={e => {
                  e.target.style.borderColor = `${accentColor}50`;
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          )}

          {/* Select options */}
          {props.type === 'select' && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
              {props.options.map((opt, i) => {
                const isSelected = selectedOption?.label === opt.label;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedOption(opt)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: isSelected ? `${accentColor}18` : 'var(--bg-primary)',
                      border: isSelected ? `1.5px solid ${accentColor}` : '1.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '0.6rem 0.9rem',
                      color: isSelected ? accentColor : 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontFamily: 'var(--font-body)',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: isSelected ? `2px solid ${accentColor}` : '2px solid var(--border)',
                      background: isSelected ? accentColor : 'transparent',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.6rem',
          padding: '1rem 1.5rem 1.25rem',
          borderTop: '1px solid var(--border)'
        }}>
          {props.type !== 'alert' && (
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                border: '1.5px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '0.88rem',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={
              (props.type === 'prompt' && !inputValue.trim()) ||
              (props.type === 'select' && !selectedOption)
            }
            style={{
              padding: '0.5rem 1.4rem',
              borderRadius: '8px',
              border: 'none',
              background: variant === 'danger' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
                          variant === 'warning' ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                          `linear-gradient(135deg, var(--primary), var(--accent))`,
              color: 'white',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              transition: 'all 0.15s',
              opacity: (
                (props.type === 'prompt' && !inputValue.trim()) ||
                (props.type === 'select' && !selectedOption)
              ) ? 0.45 : 1,
              boxShadow: `0 4px 12px ${accentColor}30`
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes dialogSlideIn {
          from { opacity: 0; transform: scale(0.92) translateY(-12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default CustomDialog;

// ─── useDialog hook ────────────────────────────────────────────────────────────

type DialogState = (DialogProps & { isOpen: boolean }) | null;

export const useDialog = () => {
  const [dialog, setDialog] = useState<DialogState>(null);

  const close = () => setDialog(null);

  const showAlert = (title: string, message: string | React.ReactNode, variant?: DialogVariant) =>
    setDialog({ type: 'alert', isOpen: true, title, message, variant, onClose: close });

  const showConfirm = (
    title: string,
    message: string | React.ReactNode,
    onConfirm: () => void,
    variant?: DialogVariant,
    confirmLabel?: string,
    cancelLabel?: string
  ) =>
    setDialog({ type: 'confirm', isOpen: true, title, message, variant, onConfirm, onClose: close, confirmLabel, cancelLabel });

  const showPrompt = (
    title: string,
    message: string | React.ReactNode,
    onConfirm: (value: string) => void,
    opts?: { defaultValue?: string; inputLabel?: string; inputPlaceholder?: string; variant?: DialogVariant }
  ) =>
    setDialog({ type: 'prompt', isOpen: true, title, message, onConfirm, onClose: close, ...opts });

  const showSelect = (
    title: string,
    message: string | React.ReactNode,
    options: { id: string | null; label: string }[],
    onConfirm: (opt: { id: string | null; label: string }) => void,
    variant?: DialogVariant
  ) =>
    setDialog({ type: 'select', isOpen: true, title, message, options, onConfirm, onClose: close, variant });

  const DialogRenderer = dialog ? <CustomDialog {...dialog} /> : null;

  return { showAlert, showConfirm, showPrompt, showSelect, DialogRenderer };
};
