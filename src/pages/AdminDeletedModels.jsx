import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import ModelCard from '../components/admin/ModelCard';
import { orderCategories } from '../constants/categoryMeta';
import { isAuthenticated } from '../utils/auth';
import { logout } from '../services/authApi';
import { getAllProducts } from '../services/productsApi';

export default function AdminDeletedModels() {
  const navigate = useNavigate();
  const routeParams = useParams();
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/admin');
    }
  }, []);

  const fetchModels = () => {
    getAllProducts({ includeInactive: true })
      .then(models => {
        setCatalog(models);
        const cats = orderCategories([...new Set(models.map(m => m.category))]);
        setCategories(cats);
        const requested = routeParams?.category;
        setActiveCategory(cats.includes(requested) ? requested : (cats[0] || null));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchModels();
  }, []);

  // Reset pagination on category or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery]);

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };



  const deletedCatalog = catalog.filter(m => m.deleted);
  const activeCatalogForSidebar = catalog.filter(m => !m.deleted);

  const deletedCounts = categories.reduce((acc, cat) => {
    acc[cat] = deletedCatalog.filter(m => m.category === cat).length;
    return acc;
  }, {});

  const activeCounts = categories.reduce((acc, cat) => {
    acc[cat] = activeCatalogForSidebar.filter(m => m.category === cat).length;
    return acc;
  }, {});

  const filteredModels = deletedCatalog.filter(m => {
    const matchesSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.id.includes(searchQuery);
    return m.category === activeCategory && matchesSearch;
  });

  const totalModels = deletedCatalog.length;

  const totalPages = Math.ceil(filteredModels.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedModels = filteredModels.slice(indexOfFirstItem, indexOfLastItem);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Loading deleted models...</p>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar
        activeNav="deleted-models"
        categories={categories}
        activeCategory={null}
        modelCounts={activeCounts}
        onCategorySelect={(cat) => navigate(`/admin/models/${cat}`)}
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
                ? `Deleted ${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Models`
                : 'Deleted Models'}
            </h2>
            <span className="admin-model-count-badge">
              {filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="admin-topbar-right">
            <div className="admin-stats-chip" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              {totalModels} deleted
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
              <span className="chip-count">{deletedCounts[cat] || 0}</span>
            </button>
          ))}
        </div>

        {/* Model Grid */}
        <div className="admin-model-grid">
          {filteredModels.length === 0 ? (
            <div className="admin-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7"/>
              </svg>
              <p>No deleted models found</p>
              {searchQuery && <span>Try a different search term</span>}
            </div>
          ) : (
            paginatedModels.map(model => (
              <ModelCard 
                key={model.id} 
                model={model} 
                isDeletedView={true} 
                onStatusChange={fetchModels} 
              />
            ))
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
