import React, { useState, useEffect } from 'react';
import { RouterProvider, Route, useRouter } from './router';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import ModelEditPage from './pages/ModelEditPage';
import ARViewPage from './pages/ARViewPage';
import './index.css';

// Public Home Page
function HomePage() {
  const { navigate } = useRouter();
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch('/models/catalog.json')
      .then(res => res.json())
      .then(data => {
        if (data?.models) {
          setCatalog(data.models);
          const cats = [...new Set(data.models.map(m => m.category))];
          setCategories(cats);
        }
      })
      .catch(console.error);
  }, []);

  const CATEGORY_META = {
    eyewear:   { emoji: '👓', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', label: 'Eyewear' },
    necklace:  { emoji: '📿', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)', label: 'Necklaces' },
    rings:     { emoji: '💍', gradient: 'linear-gradient(135deg, #f59e0b, #f97316)', label: 'Rings' },
    bracelets: { emoji: '⌚', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)', label: 'Bracelets' },
    watch:     { emoji: '🕐', gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)', label: 'Watches' },
    earrings:  { emoji: '✨', gradient: 'linear-gradient(135deg, #a855f7, #ec4899)', label: 'Earrings' },
    nosepin:   { emoji: '💎', gradient: 'linear-gradient(135deg, #14b8a6, #0ea5e9)', label: 'Nose Pins' },
  };

  const handleCategorySelect = (cat) => {
    const firstModel = catalog.find(m => m.category === cat);
    if (firstModel) {
      navigate(`/ar/${cat}/${firstModel.id}`);
    }
  };

  return (
    <div className="home-container">
      <div className="home-bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <header className="home-header">
        <div className="home-logo">
          <img src="/ENSUREAR.png" alt="EnsureAR" style={{ display: 'block', margin: '0 auto', height: '80px', objectFit: 'contain' }} />
        </div>
        <p>Experience jewellery & eyewear in augmented reality</p>
        <div className="home-header-chips">
          <span className="home-chip">✦ Face Tracking</span>
          <span className="home-chip">✦ 3D Try-On</span>
          <span className="home-chip">✦ Real-Time</span>
        </div>
      </header>

      <div className="home-section-label">Choose a Category</div>
      <div className="category-grid">
        {categories.map(cat => {
          const meta = CATEGORY_META[cat] || { emoji: '📦', gradient: 'linear-gradient(135deg, #64748b, #475569)', label: cat };
          const count = catalog.filter(m => m.category === cat).length;
          return (
            <div
              key={cat}
              id={`category-${cat}`}
              className="category-card"
              onClick={() => handleCategorySelect(cat)}
            >
              <div className="category-icon" style={{ background: meta.gradient }}>
                <span>{meta.emoji}</span>
              </div>
              <h3>{meta.label}</h3>
              <p className="category-count">{count} models</p>
            </div>
          );
        })}
      </div>

      <button
        className="home-admin-link"
        onClick={() => navigate('/admin')}
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd"/>
        </svg>
        Admin Portal
      </button>
    </div>
  );
}

// Root App with Router
function AppRoutes() {
  const { currentPath } = useRouter();

  return (
    <>
      <Route pattern="/" component={HomePage} />
      <Route pattern="/admin" component={LoginPage} />
      <Route pattern="/admin/dashboard" component={AdminDashboard} />
      <Route pattern="/admin/model/:id/edit" component={ModelEditPage} />
      <Route pattern="/ar/:category/:modelId" component={ARViewPage} />
    </>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppRoutes />
    </RouterProvider>
  );
}
