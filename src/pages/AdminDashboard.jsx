import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import ModelCard from '../components/admin/ModelCard';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const routeParams = useParams();
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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
        if (data?.models) {
          setCatalog(data.models);
          const cats = [...new Set(data.models.map(m => m.category))];
          setCategories(cats);
          // Arriving from the Overview page's "browse by category" links
          // preselects that category via the /admin/models/:category route.
          const requested = routeParams?.category;
          setActiveCategory(cats.includes(requested) ? requested : (cats[0] || null));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('sa_auth');
    navigate('/admin');
  };

  const modelCounts = categories.reduce((acc, cat) => {
    acc[cat] = catalog.filter(m => m.category === cat).length;
    return acc;
  }, {});

  const filteredModels = catalog.filter(m => {
    const inCategory = m.category === activeCategory;
    const matchesSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.id.includes(searchQuery);
    return inCategory && matchesSearch;
  });

  const totalModels = catalog.length;

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar
        categories={categories}
        activeCategory={activeCategory}
        modelCounts={modelCounts}
        onCategorySelect={(cat) => { setActiveCategory(cat); setSearchQuery(''); setSidebarOpen(false); }}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="admin-main">
        {/* Top Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              className="admin-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
            </button>
            <h2 className="admin-page-title">
              {activeCategory
                ? `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Models`
                : 'All Models'}
            </h2>
            <span className="admin-model-count-badge">
              {filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="admin-topbar-right">
            <div className="admin-search-wrapper">
              <svg className="admin-search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
              </svg>
              <input
                id="admin-search-input"
                type="text"
                className="admin-search-input"
                placeholder="Search models..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="admin-stats-chip">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
              </svg>
              {totalModels} total
            </div>
          </div>
        </header>

        {/* Category Stats Strip */}
        <div className="admin-category-strip">
          {categories.map(cat => (
            <button
              key={cat}
              className={`admin-cat-chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
              <span className="chip-count">{modelCounts[cat]}</span>
            </button>
          ))}
        </div>

        {/* Model Grid */}
        <div className="admin-model-grid">
          {filteredModels.length === 0 ? (
            <div className="admin-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
              </svg>
              <p>No models found</p>
              {searchQuery && <span>Try a different search term</span>}
            </div>
          ) : (
            filteredModels.map(model => (
              <ModelCard key={model.id} model={model} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
