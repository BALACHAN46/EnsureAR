import React, { useEffect } from 'react';
import { getCategoryMeta } from '../../constants/categoryMeta';

// ─────────────────────────────────────────────────────────
// Per-category guide configuration
// ─────────────────────────────────────────────────────────
export const CATEGORY_GUIDES = {
  watch: {
    emoji: '⌚',
    accentColor: '#3b82f6',
    title: 'Watch Try-On Guide',
    subtitle: 'How to position your wrist for best AR accuracy',
    steps: [
      {
        num: '01', color: '#3b82f6',
        title: 'Palm Facing Camera',
        desc: 'Hold your wrist with the inner side (pulse point) facing directly toward the camera.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g-w1" x1="14" y1="10" x2="38" y2="50" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e2c9a8" /><stop offset="1" stopColor="#c4a882" />
              </linearGradient>
            </defs>
            <rect x="14" y="28" width="28" height="18" rx="6" fill="url(#g-w1)" />
            <rect x="16" y="14" width="5" height="16" rx="2.5" fill="url(#g-w1)" />
            <rect x="23" y="10" width="5" height="20" rx="2.5" fill="url(#g-w1)" />
            <rect x="30" y="11" width="5" height="19" rx="2.5" fill="url(#g-w1)" />
            <rect x="37" y="16" width="5" height="14" rx="2.5" fill="url(#g-w1)" />
            <rect x="9" y="28" width="7" height="12" rx="3.5" fill="url(#g-w1)" transform="rotate(-15 9 28)" />
            <rect x="11" y="36" width="34" height="7" rx="3.5" fill="#3b82f6" opacity="0.9" />
            <rect x="22" y="37.5" width="12" height="4" rx="2" fill="#60a5fa" />
            <circle cx="46" cy="10" r="5" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" strokeWidth="1.2" />
            <circle cx="46" cy="10" r="2.5" fill="#22d3ee" opacity="0.7" />
            <path d="M28 30 Q38 18 41 12" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="2.5 1.5" fill="none" />
          </svg>
        ),
      },
      {
        num: '02', color: '#8b5cf6',
        title: 'Tilt at ~45° Angle',
        desc: 'Tilt your wrist slightly so the wrist area is clearly visible. Avoid bending too far forward.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g-w2" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e2c9a8" /><stop offset="1" stopColor="#c4a882" />
              </linearGradient>
            </defs>
            <g transform="rotate(-35 28 34)">
              <rect x="14" y="28" width="28" height="16" rx="5" fill="url(#g-w2)" />
              <rect x="16" y="14" width="5" height="16" rx="2.5" fill="url(#g-w2)" />
              <rect x="23" y="11" width="5" height="19" rx="2.5" fill="url(#g-w2)" />
              <rect x="30" y="13" width="5" height="17" rx="2.5" fill="url(#g-w2)" />
              <rect x="11" y="34" width="34" height="7" rx="3.5" fill="#8b5cf6" opacity="0.9" />
            </g>
            <path d="M10 48 A24 24 0 0 1 38 24" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="3 2" fill="none" opacity="0.6" />
            <text x="18" y="50" fontSize="8" fill="#8b5cf6" fontFamily="Inter, sans-serif" fontWeight="600">45°</text>
            <line x1="10" y1="48" x2="10" y2="20" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 2" />
          </svg>
        ),
      },
      {
        num: '03', color: '#10b981',
        title: 'Keep Wrist in Frame',
        desc: 'Ensure your full wrist is visible in the camera. Hold steady — sudden movements may cause the watch to shift.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g-w3" x1="14" y1="10" x2="42" y2="50" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e2c9a8" /><stop offset="1" stopColor="#c4a882" />
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="48" height="48" rx="6" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5" />
            <path d="M4 12 L4 4 L12 4 M44 4 L52 4 L52 12 M4 44 L4 52 L12 52 M52 44 L52 52 L44 52" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none" />
            <rect x="18" y="22" width="20" height="16" rx="4" fill="url(#g-w3)" />
            <rect x="20" y="13" width="4" height="11" rx="2" fill="url(#g-w3)" />
            <rect x="25.5" y="10" width="4" height="14" rx="2" fill="url(#g-w3)" />
            <rect x="31" y="13" width="4" height="11" rx="2" fill="url(#g-w3)" />
            <rect x="15" y="30" width="26" height="5" rx="2.5" fill="#10b981" opacity="0.9" />
            <circle cx="44" cy="44" r="6" fill="#10b981" />
            <path d="M41 44 L43.5 46.5 L47 42" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        ),
      },
      {
        num: '04', color: '#f59e0b',
        title: 'Good Lighting',
        desc: 'Bright even light helps AI detect your wrist. Avoid dark rooms or strong backlight behind your hand.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="16" r="10" fill="#f59e0b" opacity="0.15" />
            <circle cx="28" cy="16" r="6" fill="#f59e0b" opacity="0.5" />
            <circle cx="28" cy="16" r="3.5" fill="#fbbf24" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
              const r = (deg * Math.PI) / 180;
              return <line key={i} x1={28 + Math.cos(r) * 8} y1={16 + Math.sin(r) * 8} x2={28 + Math.cos(r) * 12} y2={16 + Math.sin(r) * 12} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.7" />;
            })}
            <defs>
              <linearGradient id="g-w4" x1="14" y1="34" x2="42" y2="54" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e2c9a8" /><stop offset="1" stopColor="#c4a882" />
              </linearGradient>
            </defs>
            <rect x="16" y="34" width="24" height="16" rx="5" fill="url(#g-w4)" />
            <rect x="18" y="26" width="4" height="10" rx="2" fill="url(#g-w4)" />
            <rect x="23" y="24" width="4" height="12" rx="2" fill="url(#g-w4)" />
            <rect x="28" y="25" width="4" height="11" rx="2" fill="url(#g-w4)" />
            <rect x="13" y="39" width="30" height="6" rx="3" fill="#f59e0b" opacity="0.85" />
          </svg>
        ),
      },
    ],
    proTip: 'Works with both left and right wrists. Keep fingers relaxed and slightly apart for best detection.',
  },

  bracelets: {
    emoji: '🔗',
    accentColor: '#10b981',
    title: 'Bracelet Try-On Guide',
    subtitle: 'How to position your wrist for best AR accuracy',
    steps: [
      {
        num: '01', color: '#3b82f6',
        title: 'Palm Facing Camera',
        desc: 'Hold your wrist with the inner side (pulse point) facing directly toward the camera.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g-b1" x1="14" y1="10" x2="38" y2="50" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e2c9a8" /><stop offset="1" stopColor="#c4a882" />
              </linearGradient>
            </defs>
            <rect x="14" y="28" width="28" height="18" rx="6" fill="url(#g-b1)" />
            <rect x="16" y="14" width="5" height="16" rx="2.5" fill="url(#g-b1)" />
            <rect x="23" y="10" width="5" height="20" rx="2.5" fill="url(#g-b1)" />
            <rect x="30" y="11" width="5" height="19" rx="2.5" fill="url(#g-b1)" />
            <rect x="37" y="16" width="5" height="14" rx="2.5" fill="url(#g-b1)" />
            <rect x="9" y="28" width="7" height="12" rx="3.5" fill="url(#g-b1)" transform="rotate(-15 9 28)" />
            <rect x="11" y="36" width="34" height="7" rx="3.5" fill="#10b981" opacity="0.9" />
            <rect x="22" y="37.5" width="12" height="4" rx="2" fill="#34d399" />
            <circle cx="46" cy="10" r="5" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" strokeWidth="1.2" />
            <circle cx="46" cy="10" r="2.5" fill="#22d3ee" opacity="0.7" />
            <path d="M28 30 Q38 18 41 12" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="2.5 1.5" fill="none" />
          </svg>
        ),
      },
      {
        num: '02', color: '#8b5cf6',
        title: 'Tilt at ~45° Angle',
        desc: 'Tilt your wrist slightly so the wrist area is clearly visible. Avoid bending too far forward.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g-b2" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e2c9a8" /><stop offset="1" stopColor="#c4a882" />
              </linearGradient>
            </defs>
            <g transform="rotate(-35 28 34)">
              <rect x="14" y="28" width="28" height="16" rx="5" fill="url(#g-b2)" />
              <rect x="16" y="14" width="5" height="16" rx="2.5" fill="url(#g-b2)" />
              <rect x="23" y="11" width="5" height="19" rx="2.5" fill="url(#g-b2)" />
              <rect x="30" y="13" width="5" height="17" rx="2.5" fill="url(#g-b2)" />
              <rect x="11" y="34" width="34" height="7" rx="3.5" fill="#8b5cf6" opacity="0.9" />
            </g>
            <path d="M10 48 A24 24 0 0 1 38 24" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="3 2" fill="none" opacity="0.6" />
            <text x="18" y="50" fontSize="8" fill="#8b5cf6" fontFamily="Inter, sans-serif" fontWeight="600">45°</text>
            <line x1="10" y1="48" x2="10" y2="20" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 2" />
          </svg>
        ),
      },
      {
        num: '03', color: '#10b981',
        title: 'Keep Wrist in Frame',
        desc: 'Ensure your full wrist is visible in the camera. Hold steady — sudden movements may cause the bracelet to shift.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g-b3" x1="14" y1="10" x2="42" y2="50" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e2c9a8" /><stop offset="1" stopColor="#c4a882" />
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="48" height="48" rx="6" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5" />
            <path d="M4 12 L4 4 L12 4 M44 4 L52 4 L52 12 M4 44 L4 52 L12 52 M52 44 L52 52 L44 52" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none" />
            <rect x="18" y="22" width="20" height="16" rx="4" fill="url(#g-b3)" />
            <rect x="20" y="13" width="4" height="11" rx="2" fill="url(#g-b3)" />
            <rect x="25.5" y="10" width="4" height="14" rx="2" fill="url(#g-b3)" />
            <rect x="31" y="13" width="4" height="11" rx="2" fill="url(#g-b3)" />
            <rect x="15" y="30" width="26" height="5" rx="2.5" fill="#10b981" opacity="0.9" />
            <circle cx="44" cy="44" r="6" fill="#10b981" />
            <path d="M41 44 L43.5 46.5 L47 42" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        ),
      },
      {
        num: '04', color: '#f59e0b',
        title: 'Good Lighting',
        desc: 'Bright even light helps AI detect your wrist. Avoid dark rooms or strong backlight behind your hand.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="16" r="10" fill="#f59e0b" opacity="0.15" />
            <circle cx="28" cy="16" r="6" fill="#f59e0b" opacity="0.5" />
            <circle cx="28" cy="16" r="3.5" fill="#fbbf24" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
              const r = (deg * Math.PI) / 180;
              return <line key={i} x1={28 + Math.cos(r) * 8} y1={16 + Math.sin(r) * 8} x2={28 + Math.cos(r) * 12} y2={16 + Math.sin(r) * 12} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.7" />;
            })}
            <defs>
              <linearGradient id="g-b4" x1="14" y1="34" x2="42" y2="54" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e2c9a8" /><stop offset="1" stopColor="#c4a882" />
              </linearGradient>
            </defs>
            <rect x="16" y="34" width="24" height="16" rx="5" fill="url(#g-b4)" />
            <rect x="18" y="26" width="4" height="10" rx="2" fill="url(#g-b4)" />
            <rect x="23" y="24" width="4" height="12" rx="2" fill="url(#g-b4)" />
            <rect x="28" y="25" width="4" height="11" rx="2" fill="url(#g-b4)" />
            <rect x="13" y="39" width="30" height="6" rx="3" fill="#f59e0b" opacity="0.85" />
          </svg>
        ),
      },
    ],
    proTip: 'Works with both left and right wrists. Keep fingers relaxed and slightly apart for best detection.',
  },


  rings: {
    emoji: '💍',
    accentColor: '#8b5cf6',
    title: 'Ring Try-On Guide',
    subtitle: 'How to position your hand for accurate ring placement',
    steps: [
      {
        num: '01', color: '#8b5cf6',
        title: 'Show Back of Hand',
        desc: 'Hold your hand with the back facing the camera and fingers pointing upward or slightly toward it.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="g-r1" x1="10" y1="10" x2="46" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#d4b896" /><stop offset="1" stopColor="#b8956a" /></linearGradient></defs>
            <rect x="14" y="30" width="28" height="18" rx="6" fill="url(#g-r1)" />
            <rect x="16" y="10" width="5" height="22" rx="2.5" fill="url(#g-r1)" />
            <rect x="23" y="6" width="5" height="26" rx="2.5" fill="url(#g-r1)" />
            <rect x="30" y="8" width="5" height="24" rx="2.5" fill="url(#g-r1)" />
            <rect x="37" y="14" width="5" height="18" rx="2.5" fill="url(#g-r1)" />
            <rect x="8" y="30" width="8" height="14" rx="4" fill="url(#g-r1)" transform="rotate(-20 8 30)" />
            {/* Ring on ring finger */}
            <ellipse cx="32.5" cy="20" rx="3.5" ry="2" fill="none" stroke="#8b5cf6" strokeWidth="2" opacity="0.95" />
            <ellipse cx="32.5" cy="20" rx="3.5" ry="2" fill="none" stroke="#c4b5fd" strokeWidth="0.8" opacity="0.7" />
          </svg>
        ),
      },
      {
        num: '02', color: '#a78bfa',
        title: 'Fingers Spread',
        desc: 'Spread your fingers slightly so each finger is individually visible to the camera for precise ring fitting.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="g-r2" x1="8" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#d4b896" /><stop offset="1" stopColor="#b8956a" /></linearGradient></defs>
            <rect x="16" y="34" width="24" height="14" rx="5" fill="url(#g-r2)" />
            <rect x="12" y="12" width="5" height="24" rx="2.5" fill="url(#g-r2)" />
            <rect x="19" y="8" width="5" height="28" rx="2.5" fill="url(#g-r2)" />
            <rect x="27" y="8" width="5" height="28" rx="2.5" fill="url(#g-r2)" />
            <rect x="35" y="12" width="5" height="24" rx="2.5" fill="url(#g-r2)" />
            {/* Spread arrows */}
            <path d="M10 6 L6 10 M46 6 L50 10" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          </svg>
        ),
      },
      {
        num: '03', color: '#10b981',
        title: 'Hold Hand Steady',
        desc: 'Keep your hand still once the ring appears. Slow, smooth movements give the most accurate ring fit.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="g-r3" x1="8" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#d4b896" /><stop offset="1" stopColor="#b8956a" /></linearGradient></defs>
            <rect x="18" y="34" width="20" height="14" rx="5" fill="url(#g-r3)" />
            <rect x="14" y="12" width="5" height="24" rx="2.5" fill="url(#g-r3)" />
            <rect x="21" y="8" width="5" height="28" rx="2.5" fill="url(#g-r3)" />
            <rect x="29" y="8" width="5" height="28" rx="2.5" fill="url(#g-r3)" />
            <rect x="37" y="12" width="5" height="24" rx="2.5" fill="url(#g-r3)" />
            {/* Ring on ring finger */}
            <ellipse cx="31.5" cy="18" rx="3.5" ry="2" fill="none" stroke="#10b981" strokeWidth="2.5" />
            <ellipse cx="31.5" cy="18" rx="1.8" ry="1" fill="#10b981" opacity="0.35" />
            {/* Stability lines — horizontal steady bars */}
            <line x1="4" y1="28" x2="10" y2="28" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <line x1="4" y1="34" x2="10" y2="34" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <line x1="4" y1="40" x2="10" y2="40" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
            <line x1="46" y1="28" x2="52" y2="28" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <line x1="46" y1="34" x2="52" y2="34" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <line x1="46" y1="40" x2="52" y2="40" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
            {/* Checkmark badge */}
            <circle cx="46" cy="10" r="6" fill="#10b981" />
            <path d="M43 10 L45.5 12.5 L49 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        ),
      },

      {
        num: '04', color: '#f59e0b',
        title: 'Palm or Back',
        desc: 'Both palm-side and back-of-hand are supported. Try flipping your hand to see the ring from different angles.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="g-r4" x1="4" y1="10" x2="28" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#d4b896" /><stop offset="1" stopColor="#b8956a" /></linearGradient><linearGradient id="g-r4b" x1="28" y1="10" x2="52" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#b8956a" /><stop offset="1" stopColor="#d4b896" /></linearGradient></defs>
            <rect x="4" y="24" width="22" height="16" rx="5" fill="url(#g-r4)" />
            <rect x="6" y="10" width="4" height="16" rx="2" fill="url(#g-r4)" />
            <rect x="12" y="8" width="4" height="18" rx="2" fill="url(#g-r4)" />
            <rect x="18" y="10" width="4" height="16" rx="2" fill="url(#g-r4)" />
            <ellipse cx="15" cy="18" rx="3" ry="1.8" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <path d="M26 28 Q28 24 30 28" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            <rect x="30" y="24" width="22" height="16" rx="5" fill="url(#g-r4b)" />
            <rect x="32" y="10" width="4" height="16" rx="2" fill="url(#g-r4b)" />
            <rect x="38" y="8" width="4" height="18" rx="2" fill="url(#g-r4b)" />
            <rect x="44" y="10" width="4" height="16" rx="2" fill="url(#g-r4b)" />
            <ellipse cx="41" cy="18" rx="3" ry="1.8" fill="none" stroke="#f59e0b" strokeWidth="2" />
          </svg>
        ),
      },
    ],
    proTip: 'Spread fingers naturally. Select your preferred finger using the Finger Selector control below the screen.',
  },

  necklace: {
    emoji: '📿',
    accentColor: '#ec4899',
    title: 'Necklace Try-On Guide',
    subtitle: 'How to position yourself for best necklace AR',
    steps: [
      {
        num: '01', color: '#ec4899',
        title: 'Face the Camera',
        desc: 'Face the camera directly. Ensure your neck and upper chest area is fully visible in the frame.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="18" r="11" fill="#d4b896" opacity="0.85" />
            <ellipse cx="28" cy="36" rx="14" ry="10" fill="#c4a882" opacity="0.7" />
            <path d="M20 28 Q28 32 36 28" stroke="#ec4899" strokeWidth="2" strokeDasharray="3 2" fill="none" />
            <ellipse cx="28" cy="29" rx="9" ry="1.5" fill="none" stroke="#ec4899" strokeWidth="1.5" opacity="0.8" />
          </svg>
        ),
      },
      {
        num: '02', color: '#f472b6',
        title: 'Clear Neckline',
        desc: 'Wear a low neckline or remove any scarves so the AI can see your neck and collarbone clearly.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="16" r="10" fill="#d4b896" opacity="0.8" />
            <path d="M14 32 Q28 46 42 32" fill="#6366f1" opacity="0.5" />
            <path d="M18 30 Q28 42 38 30" fill="none" stroke="#f472b6" strokeWidth="2" />
            <path d="M22 28 Q28 36 34 28" fill="none" stroke="#f472b6" strokeWidth="1.5" strokeDasharray="2 2" />
          </svg>
        ),
      },
      {
        num: '03', color: '#10b981',
        title: 'Keep Still',
        desc: 'Stay as still as possible after placing the necklace. You can drag to fine-tune its position.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="16" r="10" fill="#d4b896" opacity="0.8" />
            <ellipse cx="28" cy="36" rx="13" ry="9" fill="#c4a882" opacity="0.65" />
            <path d="M18 28 Q28 34 38 28" stroke="#10b981" strokeWidth="2.5" strokeDasharray="3 2" fill="none" />
            {/* Still arrows */}
            <line x1="10" y1="28" x2="10" y2="28" stroke="#10b981" strokeWidth="2" />
            <circle cx="28" cy="28" r="10" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
          </svg>
        ),
      },
      {
        num: '04', color: '#f59e0b',
        title: 'Good Lighting',
        desc: 'Bright, even lighting on your face and neck helps the AI position the necklace accurately.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="10" r="6" fill="#fbbf24" />
            {[0, 60, 120, 180, 240, 300].map((d, i) => { const r = (d * Math.PI) / 180; return <line key={i} x1={28 + Math.cos(r) * 7} y1={10 + Math.sin(r) * 7} x2={28 + Math.cos(r) * 11} y2={10 + Math.sin(r) * 11} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.7" />; })}
            <circle cx="28" cy="26" r="10" fill="#d4b896" opacity="0.8" />
            <ellipse cx="28" cy="42" rx="13" ry="8" fill="#c4a882" opacity="0.65" />
            <path d="M18 33 Q28 38 38 33" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 2" fill="none" />
          </svg>
        ),
      },
    ],
    proTip: 'You can drag the necklace to reposition it. Use "Reset Position" button to snap it back to auto-detected placement.',
  },

  eyewear: {
    emoji: '👓',
    accentColor: '#22d3ee',
    title: 'Eyewear Try-On Guide',
    subtitle: 'How to position your face for glasses AR',
    steps: [
      {
        num: '01', color: '#22d3ee',
        title: 'Face Camera Straight',
        desc: 'Look directly into the camera with your face centered in the frame. Keep your head level.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="24" r="14" fill="#d4b896" opacity="0.85" />
            {/* Glasses */}
            <rect x="12" y="22" width="12" height="8" rx="4" fill="none" stroke="#22d3ee" strokeWidth="2" />
            <rect x="32" y="22" width="12" height="8" rx="4" fill="none" stroke="#22d3ee" strokeWidth="2" />
            <line x1="24" y1="26" x2="32" y2="26" stroke="#22d3ee" strokeWidth="1.5" />
            <line x1="8" y1="26" x2="12" y2="26" stroke="#22d3ee" strokeWidth="1.5" />
            <line x1="44" y1="26" x2="48" y2="26" stroke="#22d3ee" strokeWidth="1.5" />
            {/* Crosshair */}
            <line x1="28" y1="4" x2="28" y2="10" stroke="rgba(34,211,238,0.4)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="2" y1="24" x2="8" y2="24" stroke="rgba(34,211,238,0.4)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="48" y1="24" x2="54" y2="24" stroke="rgba(34,211,238,0.4)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        num: '02', color: '#06b6d4',
        title: 'Adequate Distance',
        desc: 'Position yourself about arm-length from the camera. Too close or too far will reduce detection accuracy.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="28" r="10" fill="#d4b896" opacity="0.8" />
            <rect x="12" y="25" width="8" height="6" rx="3" fill="none" stroke="#06b6d4" strokeWidth="1.8" />
            <rect x="36" y="25" width="8" height="6" rx="3" fill="none" stroke="#06b6d4" strokeWidth="1.8" />
            <line x1="20" y1="28" x2="36" y2="28" stroke="#06b6d4" strokeWidth="1.4" />
            <line x1="4" y1="44" x2="52" y2="44" stroke="rgba(6,182,212,0.4)" strokeWidth="1" strokeDasharray="3 2" />
            <path d="M4 50 L28 44 L52 50" stroke="rgba(6,182,212,0.3)" strokeWidth="1" fill="none" />
          </svg>
        ),
      },
      {
        num: '03', color: '#10b981',
        title: 'Keep Face Visible',
        desc: 'Make sure your full face including forehead and ears is in the camera frame for best fit.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="48" height="48" rx="6" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5" />
            <path d="M4 12 L4 4 L12 4 M44 4 L52 4 L52 12 M4 44 L4 52 L12 52 M52 44 L52 52 L44 52" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="28" cy="26" r="13" fill="#d4b896" opacity="0.8" />
            <rect x="14" y="23" width="10" height="7" rx="3.5" fill="none" stroke="#10b981" strokeWidth="2" />
            <rect x="32" y="23" width="10" height="7" rx="3.5" fill="none" stroke="#10b981" strokeWidth="2" />
            <line x1="24" y1="26.5" x2="32" y2="26.5" stroke="#10b981" strokeWidth="1.5" />
          </svg>
        ),
      },
      {
        num: '04', color: '#f59e0b',
        title: 'Good Lighting',
        desc: 'Even lighting on your face prevents shadows that might confuse the face detection.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="10" r="6" fill="#fbbf24" />
            {[0, 60, 120, 180, 240, 300].map((d, i) => { const r = (d * Math.PI) / 180; return <line key={i} x1={28 + Math.cos(r) * 7} y1={10 + Math.sin(r) * 7} x2={28 + Math.cos(r) * 11} y2={10 + Math.sin(r) * 11} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.7" />; })}
            <circle cx="28" cy="30" r="14" fill="#d4b896" opacity="0.8" />
            <rect x="14" y="27" width="11" height="8" rx="4" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <rect x="31" y="27" width="11" height="8" rx="4" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <line x1="25" y1="31" x2="31" y2="31" stroke="#f59e0b" strokeWidth="1.5" />
          </svg>
        ),
      },
    ],
    proTip: 'Look straight at the camera — slight head turns work too. Remove existing glasses for cleaner detection.',
  },

  earrings: {
    emoji: '💎',
    accentColor: '#a78bfa',
    title: 'Earring Try-On Guide',
    subtitle: 'How to position your face for earring AR',
    steps: [
      {
        num: '01', color: '#a78bfa',
        title: 'Face Camera',
        desc: 'Look directly at the camera. It will automatically detect both your left and right ears.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="24" r="12" fill="#d4b896" opacity="0.85" />
            <ellipse cx="28" cy="40" rx="11" ry="7" fill="#c4a882" opacity="0.6" />
            {/* Earrings */}
            <circle cx="16" cy="26" r="3" fill="#a78bfa" opacity="0.9" />
            <line x1="16" y1="29" x2="16" y2="35" stroke="#a78bfa" strokeWidth="1.5" />
            <circle cx="16" cy="37" r="2.5" fill="#c4b5fd" opacity="0.9" />
            <circle cx="40" cy="26" r="3" fill="#a78bfa" opacity="0.9" />
            <line x1="40" y1="29" x2="40" y2="35" stroke="#a78bfa" strokeWidth="1.5" />
            <circle cx="40" cy="37" r="2.5" fill="#c4b5fd" opacity="0.9" />
          </svg>
        ),
      },
      {
        num: '02', color: '#8b5cf6',
        title: 'Hair Pulled Back',
        desc: 'For best results, keep hair away from your ears so the ear area is clearly visible to the camera.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="22" r="12" fill="#d4b896" opacity="0.85" />
            <path d="M16 22 Q10 16 14 8 Q28 4 42 8 Q46 16 40 22" fill="#5a3a1a" opacity="0.7" />
            {/* Hair up arrow */}
            <path d="M28 6 L28 2 M25 4 L28 2 L31 4" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8" />
            {/* Clear ear highlight */}
            <circle cx="16" cy="24" r="4" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="2 1" />
            <circle cx="40" cy="24" r="4" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="2 1" />
          </svg>
        ),
      },
      {
        num: '03', color: '#10b981',
        title: 'Try Both Sides',
        desc: 'Tilt your head slightly left or right to preview each earring from a different angle.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="22" cy="24" r="11" fill="#d4b896" opacity="0.7" />
            <circle cx="34" cy="24" r="11" fill="#d4b896" opacity="0.7" />
            <circle cx="28" cy="24" r="12" fill="#d4b896" opacity="0.85" />
            <circle cx="16" cy="26" r="3" fill="#10b981" opacity="0.9" />
            <circle cx="40" cy="26" r="3" fill="#10b981" opacity="0.9" />
            <path d="M6 28 L12 24 M50 28 L44 24" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 1.5" />
          </svg>
        ),
      },
      {
        num: '04', color: '#f59e0b',
        title: 'Good Lighting',
        desc: 'Bright light on your face helps accurately detect ear positions for precise earring placement.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="10" r="6" fill="#fbbf24" />
            {[0, 60, 120, 180, 240, 300].map((d, i) => { const r = (d * Math.PI) / 180; return <line key={i} x1={28 + Math.cos(r) * 7} y1={10 + Math.sin(r) * 7} x2={28 + Math.cos(r) * 11} y2={10 + Math.sin(r) * 11} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.7" />; })}
            <circle cx="28" cy="30" r="12" fill="#d4b896" opacity="0.85" />
            <circle cx="16" cy="32" r="3" fill="#f59e0b" opacity="0.85" />
            <circle cx="40" cy="32" r="3" fill="#f59e0b" opacity="0.85" />
          </svg>
        ),
      },
    ],
    proTip: 'Both earrings are placed simultaneously. Turn your head slowly to see them from different angles.',
  },

  nosepin: {
    emoji: '✨',
    accentColor: '#14b8a6',
    title: 'Nose Pin Try-On Guide',
    subtitle: 'How to position your face for nose pin AR',
    steps: [
      {
        num: '01', color: '#14b8a6',
        title: 'Face Straight',
        desc: 'Look directly at the camera with your face fully visible. Keep your nose centered in the frame.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="24" r="14" fill="#d4b896" opacity="0.85" />
            {/* Nose highlight */}
            <path d="M25 22 Q28 28 31 22" fill="none" stroke="#14b8a6" strokeWidth="2" />
            <circle cx="28" cy="28" r="2" fill="#14b8a6" opacity="0.8" />
            <circle cx="26" cy="29" r="1.5" fill="#5eead4" opacity="0.9" />
            {/* Dot focus */}
            <circle cx="26" cy="29" r="5" fill="none" stroke="#14b8a6" strokeWidth="1.2" strokeDasharray="2 2" />
          </svg>
        ),
      },
      {
        num: '02', color: '#0d9488',
        title: 'Close-Up View',
        desc: 'Move slightly closer to the camera so your nose area is large enough for precise pin placement.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="28" r="18" fill="#d4b896" opacity="0.85" />
            <path d="M24 26 Q28 33 32 26" fill="none" stroke="#0d9488" strokeWidth="2.5" />
            <circle cx="25" cy="32" r="2.5" fill="#14b8a6" opacity="0.9" />
            {/* Zoom in arrows */}
            <path d="M4 4 L12 4 L12 12 M4 4 L10 10" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
            <path d="M52 4 L44 4 L44 12 M52 4 L46 10" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
          </svg>
        ),
      },
      {
        num: '03', color: '#10b981',
        title: 'Keep Head Still',
        desc: 'Once the nose pin appears, hold your head very still. Even small movements shift the nose pin position.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="24" r="14" fill="#d4b896" opacity="0.85" />
            <path d="M25 22 Q28 28 31 22" fill="none" stroke="#10b981" strokeWidth="2" />
            <circle cx="26" cy="28" r="2" fill="#10b981" opacity="0.9" />
            {/* Still/lock icon */}
            <rect x="22" y="40" width="12" height="10" rx="2" fill="none" stroke="#10b981" strokeWidth="1.5" />
            <path d="M24 40 L24 37 Q28 33 32 37 L32 40" fill="none" stroke="#10b981" strokeWidth="1.5" />
            <circle cx="28" cy="45" r="1.5" fill="#10b981" />
          </svg>
        ),
      },
      {
        num: '04', color: '#f59e0b',
        title: 'Good Lighting',
        desc: 'Bright light helps detect the nose tip precisely. Avoid shadows across your face.',
        svg: (
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="10" r="6" fill="#fbbf24" />
            {[0, 60, 120, 180, 240, 300].map((d, i) => { const r = (d * Math.PI) / 180; return <line key={i} x1={28 + Math.cos(r) * 7} y1={10 + Math.sin(r) * 7} x2={28 + Math.cos(r) * 11} y2={10 + Math.sin(r) * 11} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.7" />; })}
            <circle cx="28" cy="28" r="14" fill="#d4b896" opacity="0.85" />
            <path d="M25 26 Q28 32 31 26" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <circle cx="26" cy="31" r="2.5" fill="#f59e0b" opacity="0.9" />
          </svg>
        ),
      },
    ],
    proTip: 'The nose pin auto-detects the nostril side. Move slightly to either side to try it on the left or right nostril.',
  },
};

// Fallback for any unknown category
export const FALLBACK_GUIDE = {
  emoji: '📦',
  accentColor: '#6366f1',
  title: 'AR Try-On Guide',
  subtitle: 'Tips for the best AR experience',
  steps: [
    { num: '01', color: '#6366f1', title: 'Position Yourself', desc: 'Make sure the relevant body area is clearly visible in the camera frame.', svg: null },
    { num: '02', color: '#22d3ee', title: 'Good Lighting', desc: 'Use bright, even lighting for accurate detection.', svg: null },
    { num: '03', color: '#10b981', title: 'Hold Still', desc: 'Keep steady for the sharpest AR overlay.', svg: null },
    { num: '04', color: '#f59e0b', title: 'Enjoy!', desc: 'Swipe through models at the bottom to try different items.', svg: null },
  ],
  proTip: 'Swipe left/right on the bottom carousel to try different designs.',
};

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────
/**
 * ARGuideModal
 * ------------
 * Generic entry-point alert + in-AR help modal for every category.
 *
 * Props:
 *   isOpen    – boolean
 *   category  – string (watch | rings | bracelets | necklace | eyewear | earrings | nosepin)
 *   onAccept  – called when entry CTA clicked
 *   onClose   – called when help-mode is dismissed
 *   mode      – 'entry' | 'help'
 *   overrides – optional object from SuperAdmin config (title, subtitle, proTip, steps[])
 */
export default function ARGuideModal({ isOpen, category, onAccept, onClose, mode = 'entry', overrides = {} }) {
  const guide = CATEGORY_GUIDES[category] || FALLBACK_GUIDE;
  const catMeta = getCategoryMeta(category);

  // Merge admin overrides with defaults
  const title    = overrides.title    || guide.title;
  const subtitle = overrides.subtitle || guide.subtitle;
  const proTip   = overrides.proTip   || guide.proTip;
  const steps    = guide.steps.map((step, i) => ({
    ...step,
    title: overrides.steps?.[i]?.title || step.title,
    desc:  overrides.steps?.[i]?.desc  || step.desc,
  }));

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrimary = () => (mode === 'entry' ? onAccept?.() : onClose?.());

  return (
    <div className="wgm-overlay" onClick={mode === 'help' ? onClose : undefined}>
      <div className="wgm-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="wgm-header">
          <div className="wgm-header-badge" style={{ boxShadow: `0 0 20px ${guide.accentColor}40`, borderColor: `${guide.accentColor}4d` }}>
            {catMeta.icon
              ? <img src={catMeta.icon} alt={catMeta.label} style={{ width: '32px', height: '32px', objectFit: 'contain', display: 'block' }} />
              : guide.emoji
            }
          </div>
          <div className="wgm-header-text">
            <h2 className="wgm-title">{mode === 'entry' ? title : title.replace('Try-On Guide', 'Position Guide')}</h2>
            <p className="wgm-subtitle">{subtitle}</p>
          </div>
          {mode === 'help' && (
            <button className="wgm-close-x" onClick={onClose} aria-label="Close guide">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        <div className="wgm-divider" style={{ background: `linear-gradient(90deg, transparent, ${guide.accentColor}40, transparent)` }} />

        {/* Steps */}
        <div className="wgm-steps">
          {steps.map((step, idx) => (
            <div className="wgm-step" key={idx} style={{ '--step-accent': step.color }}>
              <div className="wgm-step-icon-wrap">
                {step.svg
                  ? <div className="wgm-step-svg">{step.svg}</div>
                  : <div className="wgm-step-svg wgm-step-svg--empty" style={{ background: `${step.color}18`, borderColor: `${step.color}30` }}>
                      {catMeta.icon
                        ? <img src={catMeta.icon} alt={catMeta.label} style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                        : guide.emoji
                      }
                    </div>
                }
                <span className="wgm-step-badge" style={{ background: step.color }}>{step.num}</span>
              </div>
              <div className="wgm-step-body">
                <div className="wgm-step-title" style={{ color: step.color }}>{step.title}</div>
                <div className="wgm-step-desc">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pro Tip */}
        <div className="wgm-protip" style={{ borderColor: `${guide.accentColor}30`, background: `${guide.accentColor}0d` }}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="wgm-protip-icon" style={{ color: guide.accentColor }}>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span><strong style={{ color: `${guide.accentColor}dd` }}>Pro Tip:</strong> {proTip}</span>
        </div>

        {/* CTA */}
        <div className="wgm-footer">
          <button
            className="wgm-cta-btn"
            style={{ background: `linear-gradient(135deg, ${guide.accentColor} 0%, ${guide.accentColor}cc 100%)`, boxShadow: `0 4px 20px ${guide.accentColor}55, 0 0 0 1px ${guide.accentColor}33` }}
            onClick={handlePrimary}
          >
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
