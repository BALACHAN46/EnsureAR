import React, { useState, useEffect } from 'react';
import { useRouter } from '../router';
import Sidebar from '../components/admin/Sidebar';
import ModelCard from '../components/admin/ModelCard';
import { hasCustomConfig } from '../utils/modelConfig';
import { getCategoryMeta, orderCategories } from '../constants/categoryMeta';

const RECENT_COUNT = 8;

export default function AdminOverview() {
  const { navigate } = useRouter();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth guard
  useEffect(() => {
    if (sessionStorage.getItem('sa_auth') !== 'true') {
      navigate('/admin');
    }
  }, []);

  useEffect(() => {
    fetch('/models/catalog.json')
      .then(res => res.json())
      .then(data => {
        setCatalog(data?.models || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('sa_auth');
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Loading overview...</p>
      </div>
    );
  }

  const categories = orderCategories([...new Set(catalog.map(m => m.category))]);
  const modelCounts = categories.reduce((acc, cat) => {
    acc[cat] = catalog.filter(m => m.category === cat).length;
    return acc;
  }, {});

  const totalModels = catalog.length;
  const tunedCount = catalog.filter(m => hasCustomConfig(m.id)).length;
  const untunedCount = totalModels - tunedCount;

  const recentModels = [...catalog]
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))
    .slice(0, RECENT_COUNT);

  return (
    <div className="admin-layout">
      <Sidebar
        activeNav="overview"
        categories={categories}
        activeCategory={null}
        modelCounts={modelCounts}
        onCategorySelect={(cat) => { setSidebarOpen(false); navigate(`/admin/models/${cat}`); }}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              className="admin-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            <div>
              <h2 className="admin-page-title">Overview</h2>
            </div>
          </div>
          <div className="admin-topbar-right">
            <div className="admin-stats-chip">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              {totalModels} total
            </div>
          </div>
        </header>

        <div className="overview-content">
          <p className="overview-welcome">Welcome back, SuperAdmin. Here's what's in the catalog right now.</p>

          {/* Stat cards */}
          <div className="overview-stats">
            <div className="stat-card stat-card--cyan">
              <div className="stat-card-icon">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2 3 6v8l7 4 7-4V6l-7-4zm0 2.311L14.86 7 10 9.689 5.14 7 10 4.311zM5 8.633l4 2.223v4.51l-4-2.223v-4.51zm6 6.733v-4.51l4-2.223v4.51l-4 2.223z" /></svg>
              </div>
              <div className="stat-card-value">{totalModels}</div>
              <div className="stat-card-label">Total Models</div>
            </div>

            <div className="stat-card stat-card--violet">
              <div className="stat-card-icon">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zM11 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zM11 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
              </div>
              <div className="stat-card-value">{categories.length}</div>
              <div className="stat-card-label">Categories</div>
            </div>

            <div className="stat-card stat-card--green">
              <div className="stat-card-icon">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </div>
              <div className="stat-card-value">{tunedCount}</div>
              <div className="stat-card-label">Tuned</div>
            </div>

            <div className="stat-card stat-card--slate">
              <div className="stat-card-icon">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
              </div>
              <div className="stat-card-value">{untunedCount}</div>
              <div className="stat-card-label">Using Defaults</div>
            </div>
          </div>

          {/* Browse by category */}
          <div className="overview-section-header">
            <h3>Browse by Category</h3>
            <p>Jump straight to a category's model list</p>
          </div>
          <div className="overview-category-grid">
            {categories.map(cat => {
              const meta = getCategoryMeta(cat);
              return (
                <button
                  key={cat}
                  className="overview-category-card"
                  style={{ '--cat-color': meta.color }}
                  onClick={() => navigate(`/admin/models/${cat}`)}
                >
                  <span className="overview-category-icon">
                    {meta.icon ? <img src={meta.icon} alt={meta.label} style={{ width: '28px', height: '28px', objectFit: 'contain' }} /> : meta.emoji}
                  </span>
                  <span className="overview-category-name">{meta.label}</span>
                  <span className="overview-category-count">{modelCounts[cat]} models</span>
                </button>
              );
            })}
          </div>

          {/* Recently added */}
          {recentModels.length > 0 && (
            <>
              <div className="overview-section-header">
                <h3>Recently Added</h3>
                <p>The newest models uploaded to the catalog</p>
              </div>
              <div className="admin-model-grid overview-recent-grid">
                {recentModels.map(model => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
