import React from 'react';
import { useRouter } from '../../router';
import { hasCustomConfig } from '../../utils/modelConfig';

const CATEGORY_ICONS = {
  eyewear:   { emoji: '👓', color: '#6366f1' },
  necklace:  { emoji: '📿', color: '#ec4899' },
  rings:     { emoji: '💍', color: '#f59e0b' },
  bracelets: { emoji: '⌚', color: '#10b981' },
  watch:     { emoji: '🕐', color: '#3b82f6' },
  earrings:  { emoji: '✨', color: '#a855f7' },
};

export default function Sidebar({ categories, activeCategory, modelCounts, onCategorySelect, onLogout }) {
  const { navigate } = useRouter();

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="sidebar-brand">Mystic AR</div>
            <div className="sidebar-role">SuperAdmin</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Model Categories</div>
        {categories.map(cat => {
          const icon = CATEGORY_ICONS[cat] || { emoji: '📦', color: '#64748b' };
          const count = modelCounts[cat] || 0;
          const isActive = activeCategory === cat;

          return (
            <button
              key={cat}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onCategorySelect(cat)}
            >
              <span className="sidebar-item-icon" style={{ background: `${icon.color}20`, color: icon.color }}>
                {icon.emoji}
              </span>
              <span className="sidebar-item-label">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
              <span className="sidebar-item-count">{count}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-home-btn" onClick={() => navigate('/')}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
          </svg>
          Public Home
        </button>
        <button className="sidebar-logout-btn" onClick={onLogout}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
