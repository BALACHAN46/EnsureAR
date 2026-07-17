import React from 'react';
import { useRouter } from '../../router';
import { getCategoryMeta } from '../../constants/categoryMeta';

export default function Sidebar({ activeNav, categories, activeCategory, modelCounts, onCategorySelect, onLogout, isOpen, onClose }) {
  const { navigate } = useRouter();

  return (
    <>
      {isOpen && <div className="admin-sidebar-overlay" onClick={onClose} />}
      <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-inner">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4 6.5V4.5A1 1 0 0 1 5 3.5H7" />
                  <path d="M13 3.5H15A1 1 0 0 1 16 4.5V6.5" />
                  <path d="M16 13.5V15.5A1 1 0 0 1 15 16.5H13" />
                  <path d="M7 16.5H5A1 1 0 0 1 4 15.5V13.5" />
                </svg>
              </div>
              <span className="sidebar-brand">EnsureAR</span>
              <div className="sidebar-role-badge">SuperAdmin</div>
            </div>
            <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-primary-nav">
            <button
              className={`sidebar-item ${activeNav === 'overview' ? 'active' : ''}`}
              onClick={() => navigate('/admin/dashboard')}
            >
              <span className="sidebar-item-icon" style={{ background: 'rgba(34, 211, 238, 0.14)', color: 'var(--sa-cyan)' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zM11 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zM11 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </span>
              <span className="sidebar-item-label">Overview</span>
            </button>
          </div>

          <div className="sidebar-nav-divider" />

          <div className="sidebar-section-label">Model Categories</div>
          {categories.map(cat => {
            const meta = getCategoryMeta(cat);
            const count = modelCounts[cat] || 0;
            const isActive = activeCategory === cat;

            return (
              <button
                key={cat}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => onCategorySelect(cat)}
              >
                <span className="sidebar-item-icon" style={{ background: `${meta.color}20`, color: meta.color }}>
                  {meta.emoji}
                </span>
                <span className="sidebar-item-label">
                  {meta.label}
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
    </>
  );
}
