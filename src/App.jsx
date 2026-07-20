import React, { useState, useEffect } from 'react';
import { RouterProvider, Route, useRouter } from './router';
import LoginPage from './pages/LoginPage';
import AdminOverview from './pages/AdminOverview';
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
    eyewear:   { emoji: '👓', icon: '/eyeware.png', gradient: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', label: 'Eyewear', shadow: 'rgba(14, 165, 233, 0.5)' },
    necklace:  { emoji: '📿', icon: '/necklaces.png', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)', label: 'Necklaces', shadow: 'rgba(236, 72, 153, 0.5)' },
    rings:     { emoji: '💍', gradient: 'linear-gradient(135deg, #f59e0b, #f97316)', label: 'Rings', shadow: 'rgba(245, 158, 11, 0.5)' },
    bracelets: { emoji: '🔗', icon: '/bracelets.png', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)', label: 'Bracelets', shadow: 'rgba(16, 185, 129, 0.5)' },
    watch:     { emoji: '⌚', icon: '/watch.png', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', label: 'Watches', shadow: 'rgba(99, 102, 241, 0.5)' },
    earrings:  { emoji: '✨', gradient: 'linear-gradient(135deg, #a855f7, #ec4899)', label: 'Earrings', shadow: 'rgba(168, 85, 247, 0.5)' },
    nosepin:   { emoji: '💎', gradient: 'linear-gradient(135deg, #14b8a6, #0ea5e9)', label: 'Nose Pins', shadow: 'rgba(20, 184, 166, 0.5)' },
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

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-badge">
          <svg style={{width: 14, height: 14}} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Next-Gen Try-On Engine v2.0
        </div>
        <h1>
          Experience the Future of<br/>
          <span>Augmented Reality</span>
        </h1>
        <p>
          Instantly try on stunning jewelry and high-end eyewear in real-time, right from your browser. No app required.
        </p>
        <div className="home-hero-features">
          <span className="home-hero-feature">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
            High-Fidelity Tracking
          </span>
          <span className="home-hero-feature">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" /></svg>
            Real-Time Rendering
          </span>
          <span className="home-hero-feature">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
            Interactive Configurator
          </span>
        </div>
      </section>

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
                  {meta.icon ? <img src={meta.icon} alt={meta.label} style={{ width: '28px', height: '28px', objectFit: 'contain' }} /> : meta.emoji}
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
  const { currentPath } = useRouter();

  return (
    <>
      <Route pattern="/" component={HomePage} />
      <Route pattern="/admin" component={LoginPage} />
      <Route pattern="/admin/dashboard" component={AdminOverview} />
      <Route pattern="/admin/models" component={AdminDashboard} />
      <Route pattern="/admin/models/:category" component={AdminDashboard} />
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
