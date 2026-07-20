import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useRouter } from '../router';
import FaceTracker from '../FaceTracker';
import HandTracker from '../HandTracker';
import Scene3D from '../Scene3D';
import ProductConfigurator from '../components/ar/ProductConfigurator';
import { getModelConfig, saveModelConfig, resetModelConfig, configToPosition, configToRotation, configToScale } from '../utils/modelConfig';
import { getCategoryMeta, orderCategories } from '../constants/categoryMeta';

const PREDEFINED_COLORS = [
  { id: 'original', name: 'Original 3D Model', color: 'transparent' },
  { id: 'gold', name: 'Gold', color: '#F5D020' },
  { id: 'silver', name: 'Silver', color: '#C0C0C0' },
  { id: 'rosegold', name: 'Rose Gold', color: '#B76E79' },
  { id: 'whitegold', name: 'White Gold', color: '#E6E8FA' },
  { id: 'blackmetal', name: 'Black Metal', color: '#333333' }
];

const PREDEFINED_JEWELS = [
  { id: 'original_jewel', name: 'Original 3D Model', color: 'transparent' },
  { id: 'diamond', name: 'Diamond', color: '#ffffff', roughness: 0.1, metalness: 0.9 },
  { id: 'ruby', name: 'Ruby', color: '#e0115f', roughness: 0.1, metalness: 0.7 },
  { id: 'emerald', name: 'Emerald', color: '#50c878', roughness: 0.1, metalness: 0.7 },
  { id: 'sapphire', name: 'Sapphire', color: '#0f52ba', roughness: 0.1, metalness: 0.7 },
  { id: 'amethyst', name: 'Amethyst', color: '#9966cc', roughness: 0.1, metalness: 0.7 }
];

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
  const [modelSparkles, setModelSparkles] = useState(false);
  const [showTuning, setShowTuning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState('tryon'); // 'tryon' | 'configurator'
  const [autoRotate, setAutoRotate] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(112);

  const [customMaterials, setCustomMaterials] = useState({});
  const [modelMeshes, setModelMeshes] = useState([]);
  const [showMaterialEditor, setShowMaterialEditor] = useState(false);
  const [cameraView, setCameraView] = useState(null);
  const [activeColorId, setActiveColorId] = useState('original');
  const [activeSecondaryColorId, setActiveSecondaryColorId] = useState('original_jewel');
  const [customPrimaryColor, setCustomPrimaryColor] = useState('#ffffff');
  const [customSecondaryColor, setCustomSecondaryColor] = useState('#ffffff');
  const primaryColorInputRef = useRef(null);
  const secondaryColorInputRef = useRef(null);

  const primaryMeshes = useMemo(() => {
    return modelMeshes.filter(m => !/diamond|gem|stone|crystal|glass|lens/i.test(m.name));
  }, [modelMeshes]);

  const secondaryMeshes = useMemo(() => {
    return modelMeshes.filter(m => /diamond|gem|stone|crystal|glass|lens/i.test(m.name));
  }, [modelMeshes]);

  const hasCustomizations = Object.keys(customMaterials).length > 0;

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
    setModelSparkles(!!cfg.enableSparkles);
  };

  const handleModelSelect = (model) => {
    setActiveModel(model);
    applyModelConfig(model.id, defaults);
    setResetTick(t => t + 1);
    setCustomMaterials({});
    setModelMeshes([]);
    setActiveColorId('original');
    setCameraView(null);
  };

  const handleCategorySwitch = (cat) => {
    if (cat === category) return;
    const firstOfCat = catalog.find(m => m.category === cat);
    if (firstOfCat) navigate(`/ar/${cat}/${firstOfCat.id}`);
  };

  const handleSaveTuning = async () => {
    if (!activeModel) return;
    const res = await saveModelConfig(activeModel.id, {
      posX: modelPos[0],
      posY: modelPos[1],
      posZ: modelPos[2],
      rotX: modelRot[0],
      rotY: modelRot[1],
      rotZ: modelRot[2],
      scale: modelScale,
      enableSparkles: modelSparkles,
      category: activeModel.category,
    });

    if (res && res.action === 'insert') {
      setSaved('Inserted!');
    } else {
      setSaved('Updated!');
    }
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetTuning = () => {
    if (!activeModel) return;
    resetModelConfig(activeModel.id);
    setModelPos([0, 0, 0]);
    setModelRot([0, 0, 0]);
    setModelScale(1);
    setSaved('Reset!');
    setTimeout(() => setSaved(false), 2000);
  };

  const isAdmin = sessionStorage.getItem('sa_auth') === 'true';
  const isHandTracking = category === 'watch' || category === 'bracelets' || category === 'rings';

  const availableCategories = [...new Set(catalog.map(m => m.category))];
  const orderedCategories = orderCategories(availableCategories);

  const railTop = headerHeight + 12;

  const handleColorSelect = (colorObj) => {
    setActiveColorId(colorObj.id);
    if (colorObj.id === 'original') {
      // Clear custom materials for primary meshes
      setCustomMaterials(prev => {
        const newMats = { ...prev };
        primaryMeshes.forEach(mesh => {
          delete newMats[mesh.id];
        });
        return newMats;
      });
    } else {
      // Apply to primary meshes only
      setCustomMaterials(prev => {
        const newMats = { ...prev };
        primaryMeshes.forEach(mesh => {
          newMats[mesh.id] = { ...newMats[mesh.id], color: colorObj.color };
        });
        return newMats;
      });
    }
  };

  const handleCapture = () => {
    try {
      const video = document.querySelector('video');
      const webglCanvas = document.querySelector('canvas');

      if (!video) {
        alert("Capture failed: Could not find video feed.");
        return;
      }
      if (!webglCanvas) {
        alert("Capture failed: Could not find 3D scene.");
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || video.clientWidth || 640;
      canvas.height = video.videoHeight || video.clientHeight || 480;
      const ctx = canvas.getContext('2d');

      // We assume the video is horizontally mirrored in CSS (selfie cam)
      const isFlipped = window.getComputedStyle(video).transform.includes('matrix(-1');
      const isGlFlipped = window.getComputedStyle(webglCanvas).transform.includes('matrix(-1');

      if (isFlipped) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      if (isGlFlipped) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(webglCanvas, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        ctx.drawImage(webglCanvas, 0, 0, canvas.width, canvas.height);
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `ensure-ar-capture-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Capture error:', err);
      alert("Error capturing image: " + err.message);
    }
  };

  const handleSecondaryColorSelect = (colorObj) => {
    setActiveSecondaryColorId(colorObj.id);
    if (colorObj.id === 'original_jewel') {
      // Clear custom materials for secondary meshes
      setCustomMaterials(prev => {
        const newMats = { ...prev };
        secondaryMeshes.forEach(mesh => {
          delete newMats[mesh.id];
        });
        return newMats;
      });
    } else {
      // Apply to secondary meshes only
      setCustomMaterials(prev => {
        const newMats = { ...prev };
        secondaryMeshes.forEach(mesh => {
          newMats[mesh.id] = {
            ...newMats[mesh.id],
            color: colorObj.color,
            roughness: colorObj.roughness,
            metalness: colorObj.metalness
          };
        });
        return newMats;
      });
    }
  };

  if (viewMode === 'configurator') {
    return (
      <div className="configurator-split-layout">
        <div className="configurator-main">
          <ProductConfigurator
            key={`${activeModel?.id}-${resetTick}`}
            activeModel={activeModel}
            autoRotate={autoRotate}
            customMaterials={customMaterials}
            onMeshesLoaded={setModelMeshes}
            cameraView={cameraView}
          />
        </div>
        <div className="configurator-sidebar">
          <div className="configurator-sidebar-top" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="configurator-tryon-btn" onClick={() => setViewMode('tryon')}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              Try On in AR
            </button>
            
            <button className="configurator-close-btn" onClick={() => setViewMode('tryon')} title="Close Configurator">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="configurator-header-title">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L22 12L12 22L2 12L12 2Z" /></svg>
            3D Configurator
          </div>
          <div className="configurator-model-name">
            {activeModel?.name || 'Loading...'}
          </div>

          <div className="configurator-badges">
            <span className="configurator-badge primary">
              <svg style={{ width: 12, height: 12 }} viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8 11V7a2 2 0 114 0v4a2 2 0 11-4 0z" /></svg>
              <div className="badge-text">
                <span className="badge-num">{primaryMeshes.length}</span>
                <span className="badge-label">PRIMARY</span>
              </div>
            </span>
            <span className="configurator-badge secondary">
              <svg style={{ width: 12, height: 12 }} viewBox="0 0 20 20" fill="currentColor"><path d="M10 2L2 10l8 8 8-8-8-8z" /></svg>
              <div className="badge-text">
                <span className="badge-num">{secondaryMeshes.length}</span>
                <span className="badge-label">SECONDARY</span>
              </div>
            </span>
            <span className="configurator-badge total">
              <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
              <div className="badge-text">
                <span className="badge-num">{modelMeshes.length || 1}</span>
                <span className="badge-label">TOTAL</span>
              </div>
            </span>
          </div>

          <div className="configurator-status-row">
            <span className="configurator-status-saved">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)' }} />
              All changes saved
            </span>
            <span className="configurator-status-original" onClick={() => handleColorSelect(PREDEFINED_COLORS[0])}>
              Original 3D Model
            </span>
          </div>

          <div className="configurator-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287-.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
            Primary Material
            <span className="configurator-mesh-count">{primaryMeshes.length} meshes</span>
          </div>

          <div className="configurator-swatch-grid">
            {PREDEFINED_COLORS.map(colorObj => {
              const isOriginal = colorObj.id === 'original';
              const isActive = activeColorId === colorObj.id;
              return (
                <div
                  key={colorObj.id}
                  className={`configurator-swatch-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleColorSelect(colorObj)}
                >
                  <div className={`configurator-swatch-circle ${isOriginal ? 'is-original' : ''}`}
                    style={{ '--swatch-color': colorObj.color }} />
                  <div className="configurator-swatch-label">{colorObj.name}</div>
                </div>
              );
            })}

            <div
              className={`configurator-swatch-item ${activeColorId === 'custom' ? 'active' : ''}`}
              onClick={() => primaryColorInputRef.current?.click()}
            >
              <div
                className="configurator-swatch-circle"
                style={{
                  background: activeColorId === 'custom' ? customPrimaryColor : 'conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red)',
                  border: 'none',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)'
                }}
              />
              <div className="configurator-swatch-label">Custom</div>
              <input
                type="color"
                ref={primaryColorInputRef}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                value={customPrimaryColor}
                onChange={(e) => {
                  const c = e.target.value;
                  setCustomPrimaryColor(c);
                  handleColorSelect({ id: 'custom', name: 'Custom', color: c });
                }}
              />
            </div>
          </div>

          {secondaryMeshes.length > 0 && (
            <>
              <div className="configurator-section-title" style={{ marginTop: '1.5rem' }}>
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2L2 10l8 8 8-8-8-8z" /></svg>
                Secondary Material
                <span className="configurator-mesh-count" style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22d3ee', borderColor: 'rgba(34, 211, 238, 0.3)' }}>{secondaryMeshes.length} meshes</span>
              </div>

              <div className="configurator-swatch-grid">
                {PREDEFINED_JEWELS.map(colorObj => {
                  const isOriginal = colorObj.id === 'original_jewel';
                  const isActive = activeSecondaryColorId === colorObj.id;
                  return (
                    <div
                      key={colorObj.id}
                      className={`configurator-swatch-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleSecondaryColorSelect(colorObj)}
                    >
                      <div className={`configurator-swatch-circle ${isOriginal ? 'is-original' : ''}`}
                        style={{ '--swatch-color': colorObj.color }} />
                      <div className="configurator-swatch-label">{colorObj.name}</div>
                    </div>
                  );
                })}

                <div
                  className={`configurator-swatch-item ${activeSecondaryColorId === 'custom_jewel' ? 'active' : ''}`}
                  onClick={() => secondaryColorInputRef.current?.click()}
                >
                  <div
                    className="configurator-swatch-circle"
                    style={{
                      background: activeSecondaryColorId === 'custom_jewel' ? customSecondaryColor : 'conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red)',
                      border: 'none',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)'
                    }}
                  />
                  <div className="configurator-swatch-label">Custom</div>
                  <input
                    type="color"
                    ref={secondaryColorInputRef}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                    value={customSecondaryColor}
                    onChange={(e) => {
                      const c = e.target.value;
                      setCustomSecondaryColor(c);
                      handleSecondaryColorSelect({ id: 'custom_jewel', name: 'Custom', color: c, roughness: 0.1, metalness: 0.8 });
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div className="configurator-section-title" style={{ marginTop: secondaryMeshes.length > 0 ? '1.5rem' : '0' }}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" /></svg>
            Camera
          </div>

          <div className="configurator-camera-grid">
            {['front', 'back', 'left', 'right', 'top', 'reset'].map(cam => (
              <button
                key={cam}
                className={`configurator-camera-btn ${cameraView === cam ? 'active' : ''}`}
                onClick={() => setCameraView(cam)}
              >
                {cam === 'front' && <div style={{ width: 16, height: 16, background: '#fff', borderRadius: 2 }} />}
                {cam === 'back' && <div style={{ width: 16, height: 16, background: '#475569', borderRadius: 2 }} />}
                {cam === 'left' && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 7l-5 5 5 5V7z" /></svg>}
                {cam === 'right' && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 17l5-5-5-5v10z" /></svg>}
                {cam === 'top' && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z" /></svg>}
                {cam === 'reset' && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>}
                <span>{cam.charAt(0).toUpperCase() + cam.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
            {viewMode === 'tryon' && (
              <button
                className="ar-ctrl-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '8px' }}
                onClick={handleCapture}
                title="Take Photo"
              >
                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" /></svg>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Capture</span>
              </button>
            )}
            {viewMode === 'tryon' && hasCustomizations && (
              <button
                className="ar-ctrl-btn"
                style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)', background: 'rgba(251, 191, 36, 0.1)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '8px' }}
                onClick={() => {
                  setCustomMaterials({});
                  setActiveColorId('original');
                  setActiveSecondaryColorId('original_jewel');
                }}
                title="Reset to Original Model"
              >
                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Reset Design</span>
              </button>
            )}
            {viewMode === 'tryon' && isAdmin && (
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
          </div>
        </div>
      </div>

      {/* Hint overlays for jewelry (Try On mode only) */}
      {viewMode === 'tryon' && category === 'rings' && (
        <div className="ar-hint">
          💍 Show the back of your hand to try the ring — use Tuning to adjust position &amp; size
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

          <label className="ar-tuning-label" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <span>✨ Sparkling Effect</span>
            <input type="checkbox" checked={modelSparkles} onChange={e => setModelSparkles(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#fbbf24', cursor: 'pointer' }} />
          </label>

          <div className="ar-tuning-actions">
            <button className={`ar-tuning-save-btn ${saved ? 'saved' : ''}`} onClick={handleSaveTuning}>
              {saved ? `✔ ${typeof saved === 'string' ? saved : 'Saved!'}` : '💾 Save'}
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

      {/* ── Main viewport: live AR try-on ── */}
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
              <FaceTracker key="face" onLandmarks={(lm, img) => {
                landmarksRef.current = lm;
                videoFrameRef.current = img;
              }} />
            ) : (
              <FaceTracker
                key="necklace"
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
            modelSparkles={modelSparkles}
            activeModel={activeModel}
            isHandTracking={isHandTracking}
            category={category}
            customMaterials={customMaterials}
          />
        </div>
      </div>
      {/* ── Left dock: Categories ── */}
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
                <span className="ar-category-tile-icon">
                  {meta.icon ? <img src={meta.icon} alt={meta.label} style={{ width: '20px', height: '20px', objectFit: 'contain' }} /> : meta.emoji}
                </span>
                <span className="ar-category-tile-label">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bottom dock: Models ── */}
      <div className="ar-bottom-dock">
        <div className="ar-model-bar">
          <div className="carousel-track horizontal">
            {activeCategoryModels.map(model => (
              <div
                key={model.id}
                className={`carousel-item ${activeModel?.id === model.id ? 'active' : ''}`}
                onClick={() => handleModelSelect(model)}
                title={model.name}
              >
                {model.thumbnailPath ? (
                  <img
                    src={model.thumbnailPath}
                    alt={model.name}
                    style={{
                      background: model.thumbnailPath.toLowerCase().endsWith('.png') ? 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.2) 100%)' : 'transparent'
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold', color: '#94a3b8' }}>
                    {model.name.charAt(0)}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* <div className="carousel-title">
            {activeModel?.name || 'Select a model'} · {category}
          </div> */}
        </div>
      </div>
    </div>
  );
}
