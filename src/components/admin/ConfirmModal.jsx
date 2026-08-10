import React from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', confirmStyle = 'danger' }) {
  if (!isOpen) return null;

  const btnColors = {
    danger: { bg: '#ef4444', hover: '#dc2626' },
    primary: { bg: '#3b82f6', hover: '#2563eb' }
  };
  const currentStyle = btnColors[confirmStyle] || btnColors.danger;

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '400px',
        padding: '1.5rem',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600 }}>
          {title || 'Confirm Action'}
        </h3>
        <p style={{ margin: '0 0 1.5rem 0', color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem', borderRadius: '6px', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)', color: '#cbd5e1', cursor: 'pointer', fontWeight: 500
            }}
            onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
            onMouseOut={e => e.target.style.background = 'transparent'}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem', borderRadius: '6px', background: currentStyle.bg,
              border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 500
            }}
            onMouseOver={e => e.target.style.background = currentStyle.hover}
            onMouseOut={e => e.target.style.background = currentStyle.bg}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
