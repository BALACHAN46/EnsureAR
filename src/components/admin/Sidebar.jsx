import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategoryMeta } from '../../constants/categoryMeta';

export default function Sidebar({ activeNav, categories, activeCategory, modelCounts, onCategorySelect, onLogout, isOpen, onClose }) {
  const navigate = useNavigate();

  return (
    <>
      {isOpen && <div className="admin-sidebar-overlay" onClick={onClose} />}
      <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-inner">
            <div className="sidebar-logo">
              <img src="/ENSUREAR.png" alt="EnsureAR Logo" style={{ width: '200px', objectFit: 'contain', marginBottom: '4px' }} />
              <div className="sidebar-role-badge">SuperAdmin</div>
            </div>
            <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
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

            <button
              className={`sidebar-item ${activeNav === 'upload' ? 'active' : ''}`}
              onClick={() => navigate('/admin/upload')}
            >
              <span className="sidebar-item-icon" style={{ background: 'rgba(201,151,58,0.14)', color: '#f5d48e' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="sidebar-item-label">Upload Model</span>
            </button>

            <button
              className={`sidebar-item ${activeNav === 'ar-guide' ? 'active' : ''}`}
              onClick={() => navigate('/admin/ar-guide')}
            >
              <span className="sidebar-item-icon" style={{ background: 'rgba(139,92,246,0.14)', color: '#a78bfa' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="sidebar-item-label">AR Guide Settings</span>
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
                <span className="sidebar-item-icon" style={{ background: `${meta.color}20`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {meta.icon ? <img src={meta.icon} alt={meta.label} style={{ width: '16px', height: '16px', objectFit: 'contain' }} /> : meta.emoji}
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
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Public Home
          </button>
          <button className="sidebar-logout-btn" onClick={onLogout}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
