import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter } from '../router';
import FaceTracker from '../FaceTracker';
import HandTracker from '../HandTracker';
import Scene3D from '../Scene3D';
import ProductConfigurator from '../components/ar/ProductConfigurator';
import { getModelConfig, saveModelConfig, resetModelConfig, configToPosition, configToRotation, configToScale } from '../utils/modelConfig';
import { getCategoryMeta, orderCategories } from '../constants/categoryMeta';

export default function ARViewPage({ params }) {
  const { navigate } = useRouter();
  const landmarksRef = useRef(null);
  const poseLandmarksRef = useRef(null);
  const videoFrameRef = useRef(null);
  const headerRef = useRef(null);

  const [catalog, setCatalog] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [activeModel, setActiveModel] = useState(null);
  const [activeCategoryModels, setActiveCategoryModels] = useState([]);
  const [showFaceMesh, setShowFaceMesh] = useState(false);
  const [modelPos, setModelPos] = useState([0, 0, 0]);
  const [modelRot, setModelRot] = useState([0, 0, 0]);
  const [modelScale, setModelScale] = useState(1);
  const [showTuning, setShowTuning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState('tryon'); // 'tryon' | 'configurator'
  const [autoRotate, setAutoRotate] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(112);

  const category = params?.category;
  const modelId = params?.modelId;

  // Load catalog + defaults
  useEffect(() => {
    Promise.all([
      fetch('/models/catalog.json').then(r => r.json()),
      fetch('/models/model-defaults.json').then(r => r.json()),
    ]).then(([catalogData, defaultsData]) => {
      const models = catalogData.models || [];
      const defs = defaultsData.modelDefaults || {};
      setCatalog(models);
      setDefaults(defs);

      const catModels = models.filter(m => m.category === category);
      setActiveCategoryModels(catModels);

      const found = models.find(m => m.id === modelId) || catModels[0];
      if (found) {
        setActiveModel(found);
        applyModelConfig(found.id, defs);
      }
    }).catch(console.error);
  }, [category, modelId]);

  // Keep the fixed header's measured height in sync so the side rail / tuning
  // panel / hints never sit underneath it, regardless of how it wraps.
  useLayoutEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [category, viewMode]);

  const applyModelConfig = (id, defs) => {
    const cfg = getModelConfig(id, defs);
    setModelPos(configToPosition(cfg));
    setModelRot(configToRotation(cfg));
    setModelScale(configToScale(cfg));
  };

  const handleModelSelect = (model) => {
    setActiveModel(model);
    applyModelConfig(model.id, defaults);
    setResetTick(t => t + 1);
  };

  const handleCategorySwitch = (cat) => {
    if (cat === category) return;
    const firstOfCat = catalog.find(m => m.category === cat);
    if (firstOfCat) navigate(`/ar/${cat}/${firstOfCat.id}`);
  };

  const handleSaveTuning = () => {
    if (!activeModel) return;
    saveModelConfig(activeModel.id, {
      posX: modelPos[0],
      posY: modelPos[1],
      posZ: modelPos[2],
      rotX: modelRot[0],
      rotY: modelRot[1],
      rotZ: modelRot[2],
      scale: modelScale,
      category: activeModel.category,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetTuning = () => {
    if (!activeModel) return;
    resetModelConfig(activeModel.id);
    setModelPos([0, 0, 0]);
    setModelRot([0, 0, 0]);
    setModelScale(1);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isAdmin = sessionStorage.getItem('sa_auth') === 'true';
  const isHandTracking = category === 'watch' || category === 'bracelets' || category === 'rings';

  const availableCategories = [...new Set(catalog.map(m => m.category))];
  const orderedCategories = orderCategories(availableCategories);

  const railTop = headerHeight + 12;

  return (
    <div className="app-container">

      {/* ── Fixed header: back button, Try On / 3D Configurator switcher, mode-specific controls ── */}
      <div className="ar-header" ref={headerRef}>
        <div className="ar-topbar">
          <button
            className="ar-ctrl-btn ar-back-btn"
            onClick={() => { if (isAdmin) navigate('/admin/models'); else navigate('/'); }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            <span>{isAdmin ? 'Models' : 'Home'}</span>
          </button>

          <div className="ar-mode-switch">
            <button
              className={`ar-mode-btn ${viewMode === 'tryon' ? 'active' : ''}`}
              onClick={() => setViewMode('tryon')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span>Try On</span>
            </button>
            <button
              className={`ar-mode-btn ${viewMode === 'configurator' ? 'active' : ''}`}
              onClick={() => setViewMode('configurator')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2 3 6v8l7 4 7-4V6l-7-4zm0 2.311L14.86 7 10 9.689 5.14 7 10 4.311zM5 8.633l4 2.223v4.51l-4-2.223v-4.51zm6 6.733v-4.51l4-2.223v4.51l-4 2.223z" />
              </svg>
              <span>3D Configurator</span>
            </button>
          </div>

          <div className="ar-topbar-right">
            {viewMode === 'tryon' && category === 'eyewear' && (
              <button
                className={`ar-ctrl-btn ${showFaceMesh ? 'ar-ctrl-btn--active' : ''}`}
                onClick={() => setShowFaceMesh(p => !p)}
              >
                {showFaceMesh ? 'Hide Mesh' : 'Show Mesh'}
              </button>
            )}
            {viewMode === 'tryon' && isAdmin && (
              <button
                className={`ar-ctrl-btn ${showTuning ? 'ar-ctrl-btn--active' : ''}`}
                onClick={() => setShowTuning(p => !p)}
              >
                ⚙️ Tuning
              </button>
            )}
            {viewMode === 'configurator' && (
              <>
                <button
                  className={`ar-ctrl-btn ${autoRotate ? 'ar-ctrl-btn--active' : ''}`}
                  onClick={() => setAutoRotate(a => !a)}
                >
                  {autoRotate ? '⏸ Rotating' : '▶ Rotate'}
                </button>
                <button className="ar-ctrl-btn" onClick={() => setResetTick(t => t + 1)}>
                  ⟳ Reset View
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hint overlays for jewelry (Try On mode only) */}
      {viewMode === 'tryon' && category === 'rings' && (
        <div className="ar-hint">
          💍 Hold your hand up to try the ring — use Tuning to adjust position &amp; size
        </div>
      )}

      {/* Live Tuning Panel (Admin only, Try On mode only) */}
      {viewMode === 'tryon' && isAdmin && showTuning && (
        <div className="ar-tuning-panel" style={{ top: railTop }}>
          <div className="ar-tuning-header">
            <h4>Model Tuning</h4>
            <button className="ar-tuning-close" onClick={() => setShowTuning(false)}>✕</button>
          </div>

          <label className="ar-tuning-label">
            <span>Pos X (Left/Right): <strong>{modelPos[0].toFixed(2)}</strong></span>
            <input type="range" min="-5" max="5" step="0.01" value={modelPos[0]}
              onChange={e => setModelPos([parseFloat(e.target.value), modelPos[1], modelPos[2]])} />
          </label>
          <label className="ar-tuning-label">
            <span>Pos Y (Up/Down): <strong>{modelPos[1].toFixed(2)}</strong></span>
            <input type="range" min="-10" max="10" step="0.01" value={modelPos[1]}
              onChange={e => setModelPos([modelPos[0], parseFloat(e.target.value), modelPos[2]])} />
          </label>
          <label className="ar-tuning-label">
            <span>Pos Z (Forward/Back): <strong>{modelPos[2].toFixed(2)}</strong></span>
            <input type="range" min="-10" max="10" step="0.01" value={modelPos[2]}
              onChange={e => setModelPos([modelPos[0], modelPos[1], parseFloat(e.target.value)])} />
          </label>

          <div className="ar-tuning-divider" />

          <label className="ar-tuning-label">
            <span>Rot X (Pitch/Tilt): <strong>{(modelRot[0] * (180 / Math.PI)).toFixed(0)}°</strong></span>
            <input type="range" min="-3.14159" max="3.14159" step="0.01" value={modelRot[0]}
              onChange={e => setModelRot([parseFloat(e.target.value), modelRot[1], modelRot[2]])} />
          </label>
          <label className="ar-tuning-label">
            <span>Rot Y (Yaw/Turn): <strong>{(modelRot[1] * (180 / Math.PI)).toFixed(0)}°</strong></span>
            <input type="range" min="-3.14159" max="3.14159" step="0.01" value={modelRot[1]}
              onChange={e => setModelRot([modelRot[0], parseFloat(e.target.value), modelRot[2]])} />
          </label>
          <label className="ar-tuning-label">
            <span>Rot Z (Roll/Upside Down): <strong>{(modelRot[2] * (180 / Math.PI)).toFixed(0)}°</strong></span>
            <input type="range" min="-3.14159" max="3.14159" step="0.01" value={modelRot[2]}
              onChange={e => setModelRot([modelRot[0], modelRot[1], parseFloat(e.target.value)])} />
          </label>

          <div className="ar-tuning-divider" />

          <label className="ar-tuning-label">
            <span>Scale (Size): <strong>{parseFloat(modelScale).toFixed(2)}x</strong></span>
            <input type="range" min="-20" max="20" step="0.01" value={modelScale}
              onChange={e => setModelScale(parseFloat(e.target.value))} />
          </label>

          <div className="ar-tuning-actions">
            <button className={`ar-tuning-save-btn ${saved ? 'saved' : ''}`} onClick={handleSaveTuning}>
              {saved ? '✅ Saved!' : '💾 Save'}
            </button>
            <button className="ar-tuning-save-btn" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={handleResetTuning}>
              🔄 Reset
            </button>
            <button
              className="ar-tuning-edit-btn"
              onClick={() => navigate(`/admin/model/${activeModel?.id}/edit`)}
            >
              ✏️ Full Edit
            </button>
          </div>
        </div>
      )}

      {/* ── Main viewport: live AR try-on OR standalone 3D configurator ── */}
      {viewMode === 'tryon' ? (
        <div className="tracking-container">
          <div className="ar-content">
            {isHandTracking ? (
              <HandTracker onLandmarks={(lm, img, worldLm, handedness) => {
                landmarksRef.current = lm;
                if (landmarksRef.current && worldLm) {
                  landmarksRef.current.world = worldLm;
                  landmarksRef.current.handedness = handedness;
                }
                videoFrameRef.current = img;
              }} />
            ) : (
              category != "necklace" ? (
                <FaceTracker onLandmarks={(lm, img) => {
                  landmarksRef.current = lm;
                  videoFrameRef.current = img;
                }} />
              ) : (
                <FaceTracker
                  category={category}
                  onLandmarks={(lm, img) => {
                    landmarksRef.current = lm;
                    videoFrameRef.current = img;
                  }}
                  onPoseLandmarks={(lm) => {
                    poseLandmarksRef.current = lm;
                  }}
                />)
            )}
            <Scene3D
              landmarksRef={landmarksRef}
              poseLandmarksRef={poseLandmarksRef}
              videoFrameRef={videoFrameRef}
              showFaceMesh={showFaceMesh}
              modelPos={modelPos}
              modelRot={modelRot}
              modelScale={modelScale}
              activeModel={activeModel}
              isHandTracking={isHandTracking}
              category={category}
            />
          </div>
        </div>
      ) : (
        <div className="tracking-container configurator-mode">
          <ProductConfigurator
            key={`${activeModel?.id}-${resetTick}`}
            activeModel={activeModel}
            autoRotate={autoRotate}
          />
          <div className="ar-hint">🖱️ Drag to rotate · Scroll or pinch to zoom</div>
        </div>
      )}

      {/* ── Left dock: column 1 = categories, column 2 = models in that category ── */}
      <div className="ar-side-dock" style={{ top: railTop }}>
        <div className="ar-category-col">
          {orderedCategories.map(cat => {
            const meta = getCategoryMeta(cat);
            return (
              <button
                key={cat}
                className={`ar-category-tile ${category === cat ? 'active' : ''}`}
                style={{ '--chip-color': meta.color }}
                onClick={() => handleCategorySwitch(cat)}
                title={meta.label}
              >
                <span className="ar-category-tile-icon">{meta.emoji}</span>
                <span className="ar-category-tile-label">{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="ar-model-col">
          <div className="carousel-track">
            {activeCategoryModels.map(model => (
              <div
                key={model.id}
                className={`carousel-item ${activeModel?.id === model.id ? 'active' : ''}`}
                onClick={() => handleModelSelect(model)}
                title={model.name}
              >
                {model.thumbnailPath ? (
                  <img src={model.thumbnailPath} alt={model.name} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold', color: '#94a3b8' }}>
                    {model.name.charAt(0)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="carousel-title">
            {activeModel?.name || 'Select a model'} · {category}
          </div>
        </div>
      </div>
    </div>
  );
}
