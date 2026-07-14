import React, { useState, useRef, useEffect } from 'react';
import FaceTracker from './FaceTracker';
import Scene3D from './Scene3D';
import './index.css';

function App() {
  const landmarksRef = useRef(null);
  const videoFrameRef = useRef(null);

  // State for Navigation and Data
  const [activeView, setActiveView] = useState('home'); // 'home' | 'ar'
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeModel, setActiveModel] = useState(null);

  // AR State
  const [showFaceMesh, setShowFaceMesh] = useState(true);
  const [modelPos, setModelPos] = useState([0, 0, 0]);
  const [modelRot, setModelRot] = useState([0, 0, 0]);

  // Load Catalog on Mount
  useEffect(() => {
    fetch('/models/catalog.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.models) {
          setCatalog(data.models);
          const uniqueCategories = [...new Set(data.models.map(m => m.category))];
          setCategories(uniqueCategories);
        }
      })
      .catch(err => console.error("Error loading catalog:", err));
  }, []);

  const handleCategorySelect = (category) => {
    setActiveCategory(category);
    // Find the first model in this category
    const firstModel = catalog.find(m => m.category === category);
    setActiveModel(firstModel);
    setActiveView('ar');
  };

  const activeCategoryModels = catalog.filter(m => m.category === activeCategory);

  if (activeView === 'home') {
    return (
      <div className="home-container">
        <header className="home-header">
          <h1>Mystic AR</h1>
          <p>Select a category to try on</p>
        </header>
        <div className="category-grid">
          {categories.map(cat => (
            <div key={cat} className="category-card" onClick={() => handleCategorySelect(cat)}>
              <div className="category-icon">
                {/* Fallback styling for category thumbnail using its name */}
                <span>{cat.charAt(0).toUpperCase()}</span>
              </div>
              <h3>{cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // AR View
  return (
    <div className="app-container">

      {/* Navigation and Controls */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000, display: 'flex', gap: '10px' }}>
        <button 
          className="btn back-btn" 
          onClick={() => setActiveView('home')}
        >
          ← Back
        </button>
        <button 
          className="btn back-btn" 
          onClick={() => setShowFaceMesh(!showFaceMesh)}
        >
          {showFaceMesh ? 'Hide Mask' : 'Show Mask'}
        </button>
      </div>

      {/* Live Tuning Panel for Perfect Alignment (Safely outside AR view!) */}
      <div
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 99999,
          background: 'rgba(0, 0, 0, 0.7)', padding: '15px', borderRadius: '8px',
          color: 'white', display: 'flex', flexDirection: 'column', gap: '10px',
          width: '250px', fontSize: '12px', pointerEvents: 'auto'
        }}
      >
        <h4 style={{ margin: 0, borderBottom: '1px solid #555', paddingBottom: '5px' }}>Model Tuning</h4>

        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Pos Y (Up/Down): {modelPos[1].toFixed(2)}
          <input type="range" min="-5" max="5" step="0.01" value={modelPos[1]} onChange={e => setModelPos([modelPos[0], parseFloat(e.target.value), modelPos[2]])} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Pos Z (Forward/Back): {modelPos[2].toFixed(2)}
          <input type="range" min="-5" max="5" step="0.01" value={modelPos[2]} onChange={e => setModelPos([modelPos[0], modelPos[1], parseFloat(e.target.value)])} />
        </label>

        <div style={{ height: '1px', background: '#555', margin: '5px 0' }} />

        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Rot X (Pitch/Tilt): {(modelRot[0] * (180 / Math.PI)).toFixed(0)}°
          <input type="range" min="-3.14" max="3.14" step="0.01" value={modelRot[0]} onChange={e => setModelRot([parseFloat(e.target.value), modelRot[1], modelRot[2]])} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Rot Y (Yaw/Turn): {(modelRot[1] * (180 / Math.PI)).toFixed(0)}°
          <input type="range" min="-3.14" max="3.14" step="0.01" value={modelRot[1]} onChange={e => setModelRot([modelRot[0], parseFloat(e.target.value), modelRot[2]])} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Rot Z (Roll/Upside down): {(modelRot[2] * (180 / Math.PI)).toFixed(0)}°
          <input type="range" min="-3.14" max="3.14" step="0.01" value={modelRot[2]} onChange={e => setModelRot([modelRot[0], modelRot[1], parseFloat(e.target.value)])} />
        </label>
      </div>

      <div className="tracking-container">
        <div className="ar-content">
          <FaceTracker onLandmarks={(lm, img) => {
            landmarksRef.current = lm;
            videoFrameRef.current = img;
          }} />
          <Scene3D
            landmarksRef={landmarksRef}
            videoFrameRef={videoFrameRef}
            showFaceMesh={showFaceMesh}
            modelPos={modelPos}
            modelRot={modelRot}
            activeModel={activeModel}
          />
        </div>
      </div>

      {/* Bottom Model Carousel */}
      <div className="carousel-container">
        <div className="carousel-track">
          {activeCategoryModels.map(model => (
            <div
              key={model.id}
              className={`carousel-item ${activeModel?.id === model.id ? 'active' : ''}`}
              onClick={() => setActiveModel(model)}
            >
              <img src={model.thumbnailPath} alt={model.name} />
            </div>
          ))}
        </div>
        <div className="carousel-title">
          {activeModel?.name} - {activeCategory}
        </div>
      </div>
    </div>
  );
}

export default App;
