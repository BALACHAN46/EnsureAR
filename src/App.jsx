import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminOverview from './pages/AdminOverview';
import AdminDashboard from './pages/AdminDashboard';
import ModelEditPage from './pages/ModelEditPage';
import ARViewPage from './pages/ARViewPage';
import ARGuideSettingsPage from './pages/ARGuideSettingsPage';
import UploadPage from './pages/UploadPage';
import './index.css';

// Public Home Page
function HomePage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch('/models/catalog.json')
      .then(res => res.json())
      .then(data => {
        if (data?.models) {
          const activeModels = data.models.filter(m => !m.deleted);
          setCatalog(activeModels);
          const cats = [...new Set(activeModels.map(m => m.category))];
          setCategories(cats);
        }
      })
      .catch(console.error);
  }, []);

  const CATEGORY_META = {
    eyewear:   { emoji: '👓', icon: '/eyeware.png', gradient: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', label: 'Eyewear', shadow: 'rgba(14, 165, 233, 0.5)' },
    necklace:  { emoji: '📿', icon: '/necklaces.png', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)', label: 'Necklaces', shadow: 'rgba(236, 72, 153, 0.5)' },
    rings:     { emoji: '💍', icon: '/rings.png', gradient: 'linear-gradient(135deg, #f59e0b, #f97316)', label: 'Rings', shadow: 'rgba(245, 158, 11, 0.5)' },
    bracelets: { emoji: '🔗', icon: '/bracelets.png', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)', label: 'Bracelets', shadow: 'rgba(16, 185, 129, 0.5)' },
    watch:     { emoji: '⌚', icon: '/watch.png', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', label: 'Watches', shadow: 'rgba(99, 102, 241, 0.5)' },
    earrings:  { emoji: '✨', icon: '/earrings_thumbnail.png', gradient: 'linear-gradient(135deg, #a855f7, #ec4899)', label: 'Earrings', shadow: 'rgba(168, 85, 247, 0.5)' },
    nosepin:   { emoji: '💎', icon: '/models/nosepin/nosepin_thumnail.png', gradient: 'linear-gradient(135deg, #14b8a6, #0ea5e9)', label: 'Nose Pins', shadow: 'rgba(20, 184, 166, 0.5)' },
  };

  const handleCategorySelect = (cat) => {
    const firstModel = catalog.find(m => m.category === cat);
    if (firstModel) {
      navigate(`/ar/${cat}/${firstModel.id}`);
    }
  };

  return (
    <div className="home-container">
      <div className="home-bg-orbs" />
      
      {/* Top Navigation */}
      <nav className="home-navbar">
        <img src="/ENSUREAR.png" alt="EnsureAR" className="home-nav-logo" />
        <button className="home-nav-admin-btn" onClick={() => navigate('/admin')}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
          </svg>
          Admin Portal
        </button>
      </nav>

      <div className="home-section-label">Explore Catalog</div>
      
      <div className="category-grid">
        {categories.map((cat, index) => {
          const meta = CATEGORY_META[cat] || { emoji: '📦', gradient: 'linear-gradient(135deg, #64748b, #475569)', label: cat, shadow: 'rgba(100,116,139,0.5)' };
          const count = catalog.filter(m => m.category === cat).length;
          
          return (
            <div className="category-card-wrapper" key={cat} style={{ animation: `fadeUp 0.6s ease-out forwards ${0.8 + index * 0.1}s`, opacity: 0 }}>
              <div
                id={`category-${cat}`}
                className="category-card"
                onClick={() => handleCategorySelect(cat)}
                style={{ 
                  '--card-glow': meta.gradient,
                  '--card-shadow': meta.shadow
                }}
              >
                <div className="category-icon">
                  {meta.icon ? <img src={meta.icon} alt={meta.label} style={{ width: '80px', height: '80px', objectFit: 'contain' }} /> : meta.emoji}
                </div>
                <h3>{meta.label}</h3>
                <p className="category-count">
                  <svg style={{width: 14, height: 14}} viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
                  {count} models available
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Root App with Router
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin" element={<LoginPage />} />
      <Route path="/admin/dashboard" element={<AdminOverview />} />
      <Route path="/admin/models" element={<AdminDashboard />} />
      <Route path="/admin/models/:category" element={<AdminDashboard />} />
      <Route path="/admin/model/:id/edit" element={<ModelEditPage />} />
      <Route path="/admin/ar-guide" element={<ARGuideSettingsPage />} />
      <Route path="/admin/upload" element={<UploadPage />} />
      <Route path="/ar/:category/:modelId" element={<ARViewPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

