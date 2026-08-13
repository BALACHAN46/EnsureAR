import React, { useEffect, useState } from 'react';

/**
 * Professional Toast Notification Component
 * Props:
 *  - message: string
 *  - isError: bool
 *  - onClose: () => void
 *  - duration: number (ms, default 4000)
 */
export default function Toast({ message, isError, onClose, duration = 4000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    // Trigger slide-in
    const showTimer = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 400); // wait for slide-out animation
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [message, duration, onClose]);

  if (!message) return null;

  const iconSuccess = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );

  const iconError = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes toastSlideOut {
          from { transform: translateX(0);    opacity: 1; }
          to   { transform: translateX(120%); opacity: 0; }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .ens-toast-wrap {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 99999;
          min-width: 320px;
          max-width: 420px;
          pointer-events: all;
        }
        .ens-toast {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 18px 20px 22px 20px;
          border-radius: 14px;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.35), 0 2px 12px rgba(0,0,0,0.2);
          animation: toastSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.12);
        }
        .ens-toast.hide {
          animation: toastSlideOut 0.38s ease-in forwards;
        }
        .ens-toast.success {
          background: linear-gradient(135deg, rgba(20,30,20,0.97) 0%, rgba(18,42,18,0.97) 100%);
        }
        .ens-toast.error {
          background: linear-gradient(135deg, rgba(30,12,12,0.97) 0%, rgba(42,10,10,0.97) 100%);
        }
        .ens-toast-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
        }
        .ens-toast.success .ens-toast-icon {
          background: rgba(34,197,94,0.15);
          color: #4ade80;
          box-shadow: 0 0 18px rgba(34,197,94,0.25);
        }
        .ens-toast.error .ens-toast-icon {
          background: rgba(239,68,68,0.15);
          color: #f87171;
          box-shadow: 0 0 18px rgba(239,68,68,0.25);
        }
        .ens-toast-body {
          flex: 1;
        }
        .ens-toast-title {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .ens-toast.success .ens-toast-title { color: #4ade80; }
        .ens-toast.error   .ens-toast-title { color: #f87171; }
        .ens-toast-msg {
          font-size: 13.5px;
          color: rgba(255,255,255,0.82);
          line-height: 1.5;
        }
        .ens-toast-close {
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.4);
          padding: 2px;
          transition: color 0.2s;
          flex-shrink: 0;
          margin-top: -2px;
        }
        .ens-toast-close:hover { color: rgba(255,255,255,0.9); }
        .ens-toast-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          border-radius: 0 0 14px 14px;
          animation: toastProgress linear forwards;
        }
        .ens-toast.success .ens-toast-progress { background: linear-gradient(90deg, #16a34a, #4ade80); }
        .ens-toast.error   .ens-toast-progress { background: linear-gradient(90deg, #dc2626, #f87171); }
      `}</style>

      <div className="ens-toast-wrap">
        <div
          className={`ens-toast ${isError ? 'error' : 'success'} ${!visible ? 'hide' : ''}`}
          role="alert"
          aria-live="polite"
        >
          {/* Icon */}
          <div className="ens-toast-icon">
            {isError ? iconError : iconSuccess}
          </div>

          {/* Body */}
          <div className="ens-toast-body">
            <div className="ens-toast-title">
              {isError ? 'Failed to Send Email' : 'Email Sent!'}
            </div>
            <div className="ens-toast-msg">{message}</div>
          </div>

          {/* Close button */}
          <button
            className="ens-toast-close"
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 400);
            }}
            aria-label="Close notification"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Progress bar */}
          <div
            className="ens-toast-progress"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      </div>
    </>
  );
}
