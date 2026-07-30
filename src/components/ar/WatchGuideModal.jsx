import React, { useEffect } from 'react';

/**
 * WatchGuideModal
 * ---------------
 * Shown as an entry-point alert every time the user enters the Watch category,
 * and also accessible via the in-AR help (?) icon.
 *
 * Props:
 *   isOpen   – boolean, controls visibility
 *   onAccept – callback when user clicks "Start Try-On" (entry mode)
 *   onClose  – callback when user dismisses (help mode)
 *   mode     – 'entry' | 'help'  (defaults to 'entry')
 */
export default function WatchGuideModal({ isOpen, onAccept, onClose, mode = 'entry' }) {
  // Prevent background scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrimary = () => {
    if (mode === 'entry') onAccept?.();
    else onClose?.();
  };

  const steps = [
    {
      stepNum: '01',
      accentColor: '#3b82f6',
      title: 'Palm Facing Camera',
      desc: 'Hold your wrist with the inside (pulse point) facing directly toward the camera. Both left and right wrists work.',
      svgContent: (
        <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="wgm-step-svg">
          <defs>
            <linearGradient id="wgm-skin1" x1="14" y1="10" x2="38" y2="50" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e2c9a8"/>
              <stop offset="1" stopColor="#c4a882"/>
            </linearGradient>
          </defs>
          {/* Palm */}
          <rect x="14" y="28" width="28" height="18" rx="6" fill="url(#wgm-skin1)"/>
          {/* Fingers */}
          <rect x="16" y="14" width="5" height="16" rx="2.5" fill="url(#wgm-skin1)"/>
          <rect x="23" y="10" width="5" height="20" rx="2.5" fill="url(#wgm-skin1)"/>
          <rect x="30" y="11" width="5" height="19" rx="2.5" fill="url(#wgm-skin1)"/>
          <rect x="37" y="16" width="5" height="14" rx="2.5" fill="url(#wgm-skin1)"/>
          {/* Thumb */}
          <rect x="9" y="28" width="7" height="12" rx="3.5" fill="url(#wgm-skin1)" transform="rotate(-15 9 28)"/>
          {/* Watch band */}
          <rect x="11" y="36" width="34" height="7" rx="3.5" fill="#3b82f6" opacity="0.9"/>
          <rect x="22" y="37.5" width="12" height="4" rx="2" fill="#60a5fa"/>
          {/* Watch face */}
          <circle cx="28" cy="39.5" r="3" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="0.8"/>
          {/* Camera icon indicator */}
          <circle cx="46" cy="10" r="5" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" strokeWidth="1.2"/>
          <circle cx="46" cy="10" r="2.5" fill="#22d3ee" opacity="0.7"/>
          {/* Arrow from wrist to camera */}
          <path d="M28 30 Q38 18 41 12" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="2.5 1.5" fill="none" markerEnd="url(#wgm-arrow)"/>
          <defs>
            <marker id="wgm-arrow" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
              <path d="M0 0 L4 2 L0 4 Z" fill="#22d3ee"/>
            </marker>
          </defs>
        </svg>
      ),
    },
    {
      stepNum: '02',
      accentColor: '#8b5cf6',
      title: 'Tilt at ~45° Angle',
      desc: 'Tilt your wrist slightly so the camera has a clear view of the wrist area. Avoid hiding the wrist by bending too far.',
      svgContent: (
        <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="wgm-step-svg">
          <defs>
            <linearGradient id="wgm-skin2" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e2c9a8"/>
              <stop offset="1" stopColor="#c4a882"/>
            </linearGradient>
          </defs>
          {/* Angled hand group */}
          <g transform="rotate(-35 28 34)">
            <rect x="14" y="28" width="28" height="16" rx="5" fill="url(#wgm-skin2)"/>
            <rect x="16" y="14" width="5" height="16" rx="2.5" fill="url(#wgm-skin2)"/>
            <rect x="23" y="11" width="5" height="19" rx="2.5" fill="url(#wgm-skin2)"/>
            <rect x="30" y="13" width="5" height="17" rx="2.5" fill="url(#wgm-skin2)"/>
            {/* Watch band */}
            <rect x="11" y="34" width="34" height="7" rx="3.5" fill="#8b5cf6" opacity="0.9"/>
          </g>
          {/* Angle arc */}
          <path d="M10 48 A24 24 0 0 1 38 24" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="3 2" fill="none" opacity="0.6"/>
          <text x="18" y="50" fontSize="8" fill="#8b5cf6" fontFamily="Inter, sans-serif" fontWeight="600">45°</text>
          {/* Vertical reference */}
          <line x1="10" y1="48" x2="10" y2="20" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 2"/>
        </svg>
      ),
    },
    {
      stepNum: '03',
      accentColor: '#10b981',
      title: 'Keep Wrist in Frame',
      desc: 'Make sure your full wrist is visible in the camera frame. Hold it steady — quick movements may cause the watch to jump.',
      svgContent: (
        <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="wgm-step-svg">
          <defs>
            <linearGradient id="wgm-skin3" x1="14" y1="10" x2="42" y2="50" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e2c9a8"/>
              <stop offset="1" stopColor="#c4a882"/>
            </linearGradient>
          </defs>
          {/* Camera frame */}
          <rect x="4" y="4" width="48" height="48" rx="6" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5"/>
          {/* Corner brackets */}
          <path d="M4 12 L4 4 L12 4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M44 4 L52 4 L52 12" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M4 44 L4 52 L12 52" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M52 44 L52 52 L44 52" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none"/>
          {/* Hand inside frame */}
          <rect x="18" y="22" width="20" height="16" rx="4" fill="url(#wgm-skin3)"/>
          <rect x="20" y="13" width="4" height="11" rx="2" fill="url(#wgm-skin3)"/>
          <rect x="25.5" y="10" width="4" height="14" rx="2" fill="url(#wgm-skin3)"/>
          <rect x="31" y="13" width="4" height="11" rx="2" fill="url(#wgm-skin3)"/>
          {/* Watch */}
          <rect x="15" y="30" width="26" height="5" rx="2.5" fill="#10b981" opacity="0.9"/>
          {/* Green checkmark in corner */}
          <circle cx="44" cy="44" r="6" fill="#10b981"/>
          <path d="M41 44 L43.5 46.5 L47 42" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      ),
    },
    {
      stepNum: '04',
      accentColor: '#f59e0b',
      title: 'Ensure Good Lighting',
      desc: 'Bright, even lighting helps the AI detect your wrist accurately. Avoid dark rooms or strong light directly behind your hand.',
      svgContent: (
        <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="wgm-step-svg">
          {/* Sun glow */}
          <circle cx="28" cy="16" r="10" fill="#f59e0b" opacity="0.15"/>
          <circle cx="28" cy="16" r="6" fill="#f59e0b" opacity="0.5"/>
          <circle cx="28" cy="16" r="3.5" fill="#fbbf24"/>
          {/* Sun rays */}
          {[0,45,90,135,180,225,270,315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 28 + Math.cos(rad) * 8;
            const y1 = 16 + Math.sin(rad) * 8;
            const x2 = 28 + Math.cos(rad) * 12;
            const y2 = 16 + Math.sin(rad) * 12;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>;
          })}
          {/* Light rays hitting hand */}
          <path d="M20 23 L18 34" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.5"/>
          <path d="M28 24 L28 34" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.5"/>
          <path d="M36 23 L38 34" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.5"/>
          {/* Hand */}
          <defs>
            <linearGradient id="wgm-skin4" x1="14" y1="34" x2="42" y2="54" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e2c9a8"/>
              <stop offset="1" stopColor="#c4a882"/>
            </linearGradient>
          </defs>
          <rect x="16" y="34" width="24" height="16" rx="5" fill="url(#wgm-skin4)"/>
          <rect x="18" y="26" width="4" height="10" rx="2" fill="url(#wgm-skin4)"/>
          <rect x="23" y="24" width="4" height="12" rx="2" fill="url(#wgm-skin4)"/>
          <rect x="28" y="25" width="4" height="11" rx="2" fill="url(#wgm-skin4)"/>
          {/* Watch */}
          <rect x="13" y="39" width="30" height="6" rx="3" fill="#f59e0b" opacity="0.85"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="wgm-overlay" onClick={mode === 'help' ? onClose : undefined}>
      <div className="wgm-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="wgm-header">
          <div className="wgm-header-badge">⌚</div>
          <div className="wgm-header-text">
            <h2 className="wgm-title">
              {mode === 'entry' ? 'Watch Try-On Guide' : 'Hand Position Guide'}
            </h2>
            <p className="wgm-subtitle">
              {mode === 'entry'
                ? 'Follow these steps for the best AR experience'
                : 'How to hold your wrist for accurate watch AR'}
            </p>
          </div>
          {mode === 'help' && (
            <button className="wgm-close-x" onClick={onClose} aria-label="Close guide">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        <div className="wgm-divider" />

        {/* ── Steps ── */}
        <div className="wgm-steps">
          {steps.map((step, idx) => (
            <div className="wgm-step" key={idx} style={{ '--step-accent': step.accentColor }}>
              <div className="wgm-step-icon-wrap">
                {step.svgContent}
                <span className="wgm-step-badge" style={{ background: step.accentColor }}>{step.stepNum}</span>
              </div>
              <div className="wgm-step-body">
                <div className="wgm-step-title" style={{ color: step.accentColor }}>{step.title}</div>
                <div className="wgm-step-desc">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Pro Tip ── */}
        <div className="wgm-protip">
          <svg viewBox="0 0 20 20" fill="currentColor" className="wgm-protip-icon">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>
            <strong>Pro Tip:</strong> Works with both <strong>left and right wrists</strong>. Keep fingers relaxed and slightly apart for best detection.
          </span>
        </div>

        {/* ── CTA ── */}
        <div className="wgm-footer">
          <button className="wgm-cta-btn" onClick={handlePrimary}>
            {mode === 'entry' ? (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
                Got it — Start Try-On
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Got it
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
