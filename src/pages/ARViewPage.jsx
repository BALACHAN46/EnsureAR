import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FaceTracker from '../FaceTracker';
import HandTracker from '../HandTracker';
import Scene3D from '../Scene3D';
import ProductConfigurator from '../components/ar/ProductConfigurator';
import { getModelConfig, saveModelConfig, resetModelConfig, configToPosition, configToRotation, configToScale, configToLeftPosition, configToLeftRotation } from '../utils/modelConfig';
import { getCategoryMeta, orderCategories } from '../constants/categoryMeta';
import ARGuideModal from '../components/ar/ARGuideModal';
import { loadARGuideConfig } from '../utils/arGuideConfig';

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

export default function ARViewPage() {
  const navigate = useNavigate();
  const routeParams = useParams();
  const category = routeParams?.category;
  const modelId = routeParams?.modelId;
  const landmarksRef = useRef(null);
  const poseLandmarksRef = useRef(null);
  const videoFrameRef = useRef(null);
  const headerRef = useRef(null);

  const [catalog, setCatalog] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [activeModel, setActiveModel] = useState(null);
  const [activeCategoryModels, setActiveCategoryModels] = useState([]);
  const [showFaceMesh, setShowFaceMesh] = useState(false);
  const [showOccluder, setShowOccluder] = useState(false);
  const [modelPos, setModelPos] = useState([0, 0, 0]);
  const [modelRot, setModelRot] = useState([0, 0, 0]);
  const [leftModelPos, setLeftModelPos] = useState([0, 0, 0]);
  const [leftModelRot, setLeftModelRot] = useState([0, 0, 0]);
  const [tuningHand, setTuningHand] = useState('right');
  const [modelScale, setModelScale] = useState(1);
  const [modelSparkles, setModelSparkles] = useState(false);
  const [ringTuning, setRingTuning] = useState({
    rightHandFrontOffset: -0.05,
    rightHandBackOffset: 0.00,
    leftHandFrontOffset: -0.06,
    leftHandBackOffset: -0.06,
    frontScale: 0.23,
    backScale: 0.20,
    selectedFinger: 2, // 0=index, 1=middle, 2=ring, 3=pinky
  });
  const [showTuning, setShowTuning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragResetTick, setDragResetTick] = useState(0);
  const [viewMode, setViewMode] = useState('tryon'); // 'tryon' | 'configurator'
  const [autoRotate, setAutoRotate] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(112);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Category AR guide modal (entry-point + in-AR help)
  const [guideOpen, setGuideOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideAccepted, setGuideAccepted] = useState(false);

  // Toggle state for top-right AR controls
  const [showTopControls, setShowTopControls] = useState(false);

  // Whether the sidebar's category strip / model grid / promo content is expanded
  const [categoryStripOpen, setCategoryStripOpen] = useState(true);

  // Which page of the model grid is showing (paginated)
  const [modelPage, setModelPage] = useState(0);

  // Phone/tablet bottom sheet shows 1 row of 3 (rest via pagination);
  // desktop sidebar shows 3 rows of 3 (9 per page)
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobileLayout(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const MODELS_PER_PAGE = isMobileLayout ? 3 : 9;

  // Reset to the first page whenever the active category changes
  useEffect(() => {
    setModelPage(0);
  }, [category]);

  // Also reset to the first page if the layout switches between mobile/desktop
  // page sizes (otherwise modelPage could point past the end of the new,
  // smaller page size)
  useEffect(() => {
    setModelPage(0);
  }, [MODELS_PER_PAGE]);

  // Phone-only bottom bar (zoom/capture/category row) — hidden by default,
  // revealed by tapping its toggle arrow
  const [mobileBarOpen, setMobileBarOpen] = useState(false);

  // Category strip: auto-scrolls continuously and non-stop, at all times —
  // the user can also grab and drag it (mouse) or swipe it (touch, native) to
  // move it manually at any moment. Hovering pauses it; moving off resumes it
  // smoothly. Positioning is done via a CSS transform on the track (not
  // scrollLeft) — this page also runs a heavy WebGL/face-tracking render loop
  // every frame, and reading scrollLeft right after writing it (as a
  // scrollLeft-based approach requires) forces a synchronous layout on every
  // single animation frame, which combined with that render load is what was
  // causing the visible stutter. A transform is compositor-only and doesn't
  // force layout, so it stays smooth under that same load.
  const categoryStripRef = useRef(null);
  const categoryTrackRef = useRef(null);
  const categoryOffsetRef = useRef(0);
  const categoryDragRef = useRef({ isDown: false, startX: 0, startOffset: 0, moved: false });

  useEffect(() => {
    const strip = categoryStripRef.current;
    const track = categoryTrackRef.current;
    if (!strip || !track) return;

    let rafId;
    let lastTime = null;
    let hovered = false;
    let halfWidth = track.scrollWidth / 2;
    const SPEED_PX_PER_SEC = 40; // time-based (not per-frame) so it stays a
    // constant, visible speed regardless of the actual frame rate.

    const applyOffset = () => {
      track.style.transform = `translateX(${-categoryOffsetRef.current}px)`;
    };
    applyOffset();

    const tick = (time) => {
      if (lastTime === null) lastTime = time;
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (!hovered && !categoryDragRef.current.isDown && halfWidth > 0) {
        categoryOffsetRef.current += SPEED_PX_PER_SEC * dt;
        if (categoryOffsetRef.current >= halfWidth) categoryOffsetRef.current -= halfWidth;
        applyOffset();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Re-measure whenever the track's actual rendered width changes — not just
    // on window resize, but also the moment the category list first populates
    // (orderedCategories loads asynchronously from catalog.json), which a
    // one-time measurement at mount would otherwise miss, leaving halfWidth
    // stuck at 0 and the auto-scroll permanently doing nothing until some
    // unrelated resize happened to fire.
    const ro = new ResizeObserver(() => { halfWidth = track.scrollWidth / 2; });
    ro.observe(track);

    const onMouseEnter = () => { hovered = true; };
    const onMouseLeave = () => { hovered = false; };

    const onDown = (clientX) => {
      categoryDragRef.current = { isDown: true, startX: clientX, startOffset: categoryOffsetRef.current, moved: false };
    };
    const onMove = (clientX) => {
      const drag = categoryDragRef.current;
      if (!drag.isDown) return;
      const dx = clientX - drag.startX;
      if (Math.abs(dx) > 4) drag.moved = true;
      let next = drag.startOffset - dx;
      if (halfWidth > 0) next = ((next % halfWidth) + halfWidth) % halfWidth;
      categoryOffsetRef.current = next;
      applyOffset();
    };
    const onUp = () => {
      categoryDragRef.current.isDown = false;
    };

    const onMouseDown = (e) => onDown(e.clientX);
    const onMouseMove = (e) => onMove(e.clientX);
    const onTouchStart = (e) => onDown(e.touches[0].clientX);
    const onTouchMove = (e) => onMove(e.touches[0].clientX);

    strip.addEventListener('mouseenter', onMouseEnter);
    strip.addEventListener('mouseleave', onMouseLeave);
    strip.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    strip.addEventListener('touchstart', onTouchStart, { passive: true });
    strip.addEventListener('touchmove', onTouchMove, { passive: true });
    strip.addEventListener('touchend', onUp);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      strip.removeEventListener('mouseenter', onMouseEnter);
      strip.removeEventListener('mouseleave', onMouseLeave);
      strip.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      strip.removeEventListener('touchstart', onTouchStart);
      strip.removeEventListener('touchmove', onTouchMove);
      strip.removeEventListener('touchend', onUp);
    };
  }, [categoryStripOpen]);

  // Phone-only bottom sheet (models + promo) — opened by tapping a category
  // chip in the mobile bottom bar, or the bar's chevron
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Draggable help button position
  const [helpBtnPos, setHelpBtnPos] = useState({ x: null, y: null });
  const helpDragRef = useRef(null);
  const helpDragState = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // AR Guide config (loaded from localStorage, set by SuperAdmin)
  const [arGuideConfig, setArGuideConfig] = useState(() => loadARGuideConfig());

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

  // Load catalog + defaults
  useEffect(() => {
    Promise.all([
      fetch('/models/catalog.json').then(r => r.json()),
      fetch('/models/model-defaults.json').then(r => r.json()),
    ]).then(([catalogData, defaultsData]) => {
      const models = (catalogData.models || []).filter(m => !m.deleted);
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

  // Show AR guide modal every time category changes (respects SuperAdmin config)
  useEffect(() => {
    const cfg = loadARGuideConfig(); // Re-read in case admin changed it
    setArGuideConfig(cfg);
    if (category && cfg.entryModalEnabled) {
      setGuideOpen(true);
      setGuideAccepted(false);
    } else {
      setGuideOpen(false);
      setGuideAccepted(!cfg.entryModalEnabled); // auto-accept if modal disabled
    }
  }, [category]);

  // Draggable help button handlers
  const onHelpDragStart = (clientX, clientY) => {
    const el = helpDragRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    helpDragState.current = { dragging: true, startX: clientX, startY: clientY, origX: rect.left, origY: rect.top };
    el.style.transition = 'none';
  };
  const onHelpDragMove = (clientX, clientY) => {
    if (!helpDragState.current.dragging) return;
    const { startX, startY, origX, origY } = helpDragState.current;
    const nx = origX + (clientX - startX);
    const ny = origY + (clientY - startY);
    const vw = window.innerWidth, vh = window.innerHeight;
    const size = 42;
    const finalX = Math.min(Math.max(nx, 4), vw - size - 4);
    const finalY = Math.min(Math.max(ny, 4), vh - size - 4);

    if (helpDragRef.current) {
      helpDragRef.current.style.position = 'fixed';
      helpDragRef.current.style.left = `${finalX}px`;
      helpDragRef.current.style.top = `${finalY}px`;
      helpDragRef.current.style.bottom = 'unset';
      helpDragRef.current.style.right = 'unset';
    }
  };
  const onHelpDragEnd = () => {
    helpDragState.current.dragging = false;
    if (helpDragRef.current) {
      helpDragRef.current.style.transition = '';
      const left = parseFloat(helpDragRef.current.style.left);
      const top = parseFloat(helpDragRef.current.style.top);
      if (!isNaN(left) && !isNaN(top)) {
        setHelpBtnPos({ x: left, y: top });
      }
    }
  };

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
    setLeftModelPos(configToLeftPosition(cfg));
    setLeftModelRot(configToLeftRotation(cfg));
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
      leftPosX: leftModelPos[0],
      leftPosY: leftModelPos[1],
      leftPosZ: leftModelPos[2],
      leftRotX: leftModelRot[0],
      leftRotY: leftModelRot[1],
      leftRotZ: leftModelRot[2],
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
    setLeftModelPos([0, 0, 0]);
    setLeftModelRot([0, 0, 0]);
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
            Camera Angles
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

  // Shared between the desktop sidebar and the phone bottom sheet
  const renderModelGridAndPromo = () => (
    <>
      <div className="carousel-track grid">
        {activeCategoryModels.slice(modelPage * MODELS_PER_PAGE, modelPage * MODELS_PER_PAGE + MODELS_PER_PAGE).map(model => (
          <div
            key={model.id}
            className={`carousel-item ${activeModel?.id === model.id ? 'active' : ''}`}
            onClick={() => handleModelSelect(model)}
            title={model.name}
          >
            {model.thumbnailPath ? (
              <img src={model.thumbnailPath} alt={model.name} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#94a3b8' }}>
                {model.name.charAt(0)}
              </div>
            )}
          </div>
        ))}
      </div>

      {activeCategoryModels.length > MODELS_PER_PAGE && (
        <div className="tryon-pagination">
          <button
            type="button"
            onClick={() => setModelPage(p => Math.max(0, p - 1))}
            disabled={modelPage === 0}
            aria-label="Previous models"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span>{modelPage + 1} / {Math.ceil(activeCategoryModels.length / MODELS_PER_PAGE)}</span>
          <button
            type="button"
            onClick={() => setModelPage(p => Math.min(Math.ceil(activeCategoryModels.length / MODELS_PER_PAGE) - 1, p + 1))}
            disabled={modelPage >= Math.ceil(activeCategoryModels.length / MODELS_PER_PAGE) - 1}
            aria-label="Next models"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      )}

      <div className="tryon-sidebar-promo">
        <h3>Try before you buy — virtually</h3>
        <p>A seamless blend of technology and style — see how your favorite pieces look on you instantly.</p>
      </div>
    </>
  );

  return (
    <div className="tryon-split-layout">
    <div className="tryon-camera-pane">

      {/* ── Fixed header: back button, Try On / 3D Configurator switcher, mode-specific controls ── */}
      <div className="ar-header" ref={headerRef}>
        <div className="ar-topbar">
          <div className="ar-topbar-left" style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              className="ar-ctrl-btn ar-back-btn"
              onClick={() => { if (isAdmin) navigate('/admin/models'); else navigate('/'); }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              <span>{isAdmin ? 'Models' : 'Home'}</span>
            </button>
          </div>

          <div className="ar-mode-switch" style={{ flexShrink: 0 }}>
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

          <div className="ar-topbar-right" style={{ flex: 1, minWidth: 0, display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }} />
        </div>
      </div>

      {/* ── Vertical control stack: capture at top, zoom/reset/admin toggles below, expand chevron at bottom ── */}
      {viewMode === 'tryon' && (
        <div className="ar-vertical-controls">
          <button
            className="ar-ctrl-btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', borderRadius: '50%' }}
            onClick={handleCapture}
            title="Take Photo"
          >
            <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" /></svg>
          </button>

          <button
            className="ar-ctrl-btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', borderRadius: '50%' }}
            onClick={() => setZoomLevel(z => Math.max(1.0, z - 0.2))}
            title="Zoom Out"
          >
            <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <button
            className="ar-ctrl-btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', borderRadius: '50%' }}
            onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.2))}
            title="Zoom In"
          >
            <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>

          {showTopControls && (
            <>
              {(category === 'necklace' || category === 'earrings') && (
                <button
                  className="ar-ctrl-btn"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', borderRadius: '50%' }}
                  onClick={() => setDragResetTick(t => t + 1)}
                  title="Undo any drag-to-reposition and snap the model back to its original placement"
                >
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
                </button>
              )}

              {hasCustomizations && (
                <button
                  className="ar-ctrl-btn"
                  style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)', background: 'rgba(251, 191, 36, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', borderRadius: '50%' }}
                  onClick={() => {
                    setCustomMaterials({});
                    setActiveColorId('original');
                    setActiveSecondaryColorId('original_jewel');
                  }}
                  title="Reset to Original Model"
                >
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
                </button>
              )}

              {isAdmin && (
                <button
                  className={`ar-ctrl-btn ${showFaceMesh ? 'ar-ctrl-btn--active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', borderRadius: '50%' }}
                  onClick={() => setShowFaceMesh(p => !p)}
                  title={showFaceMesh ? 'Hide Mesh' : 'Show Mesh'}
                >
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                </button>
              )}

              {isAdmin && (
                <button
                  className={`ar-ctrl-btn ${showOccluder ? 'ar-ctrl-btn--active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', borderRadius: '50%' }}
                  onClick={() => setShowOccluder(p => !p)}
                  title={showOccluder ? 'Hide Occluder' : 'Show Occluder'}
                >
                  {showOccluder ? (
                    <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  ) : (
                    <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  )}
                </button>
              )}

              {isAdmin && (
                <button
                  className={`ar-ctrl-btn ${showTuning ? 'ar-ctrl-btn--active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', borderRadius: '50%' }}
                  onClick={() => setShowTuning(p => !p)}
                  title="Tuning"
                >
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                </button>
              )}
            </>
          )}

          <button
            className="ar-ctrl-btn"
            onClick={() => setShowTopControls(!showTopControls)}
            title={showTopControls ? "Hide Controls" : "Show Controls"}
            style={{ padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {showTopControls ? (
              // Chevron Up (to close)
              <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            ) : (
              // Chevron Down (to open)
              <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* AR Help (?) floating button – draggable, appears after guide accepted, respects config */}
      {viewMode === 'tryon' && guideAccepted && arGuideConfig.helpIconEnabled && (
        <button
          ref={helpDragRef}
          className="watch-help-btn"
          style={
            helpBtnPos.x !== null
              ? { position: 'fixed', left: helpBtnPos.x, top: helpBtnPos.y, bottom: 'unset', right: 'unset' }
              : {}
          }
          onClick={(e) => {
            // Only open help if not dragged
            if (!helpDragState.current.wasDragged) setHelpOpen(true);
            helpDragState.current.wasDragged = false;
          }}
          onMouseDown={(e) => {
            helpDragState.current.wasDragged = false;
            onHelpDragStart(e.clientX, e.clientY);
            const move = (ev) => { onHelpDragMove(ev.clientX, ev.clientY); helpDragState.current.wasDragged = true; };
            const up = () => { onHelpDragEnd(); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
          }}
          onTouchStart={(e) => {
            helpDragState.current.wasDragged = false;
            const t = e.touches[0];
            onHelpDragStart(t.clientX, t.clientY);
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            onHelpDragMove(t.clientX, t.clientY);
            helpDragState.current.wasDragged = true;
          }}
          onTouchEnd={onHelpDragEnd}
          title="AR Try-On Help — drag to move"
          aria-label="AR guide help"
        >
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* AR Entry-Point Guide Modal (all categories) */}
      <ARGuideModal
        isOpen={guideOpen}
        category={category}
        mode="entry"
        overrides={arGuideConfig.categoryOverrides?.[category] || {}}
        onAccept={() => {
          setGuideOpen(false);
          setGuideAccepted(true);
        }}
      />

      {/* AR In-AR Help Modal (all categories) */}
      <ARGuideModal
        isOpen={helpOpen}
        category={category}
        mode="help"
        overrides={arGuideConfig.categoryOverrides?.[category] || {}}
        onClose={() => setHelpOpen(false)}
      />

      {/* Live Tuning Panel (Admin only, Try On mode only) */}
      {viewMode === 'tryon' && isAdmin && showTuning && (
        <div className="ar-tuning-panel" style={{ top: railTop }}>
          <div className="ar-tuning-header">
            <h4>Model Tuning</h4>
            <button className="ar-tuning-close" onClick={() => setShowTuning(false)}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
            <button
              style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', background: tuningHand === 'right' ? '#3b82f6' : 'transparent', color: tuningHand === 'right' ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
              onClick={() => setTuningHand('right')}
            >
              {category === 'earrings' ? 'Left Ear' : 'Left Hand'}
            </button>
            <button
              style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', background: tuningHand === 'left' ? '#3b82f6' : 'transparent', color: tuningHand === 'left' ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
              onClick={() => setTuningHand('left')}
            >
              {category === 'earrings' ? 'Right Ear' : 'Right Hand'}
            </button>
          </div>

          <label className="ar-tuning-label">
            <span>Pos X (Left/Right): <strong>{(tuningHand === 'right' ? modelPos[0] : leftModelPos[0]).toFixed(2)}</strong></span>
            <input type="range" min={category === 'nosepin' ? -0.5 : -20} max={category === 'nosepin' ? 0.5 : 20} step="0.01" value={tuningHand === 'right' ? modelPos[0] : leftModelPos[0]}
              onChange={e => {
                const val = parseFloat(e.target.value);
                tuningHand === 'right' ? setModelPos([val, modelPos[1], modelPos[2]]) : setLeftModelPos([val, leftModelPos[1], leftModelPos[2]]);
              }} />
          </label>
          <label className="ar-tuning-label">
            <span>Pos Y (Up/Down): <strong>{(tuningHand === 'right' ? modelPos[1] : leftModelPos[1]).toFixed(2)}</strong></span>
            <input type="range" min={category === 'nosepin' ? -0.5 : -20} max={category === 'nosepin' ? 0.5 : 20} step="0.01" value={tuningHand === 'right' ? modelPos[1] : leftModelPos[1]}
              onChange={e => {
                const val = parseFloat(e.target.value);
                tuningHand === 'right' ? setModelPos([modelPos[0], val, modelPos[2]]) : setLeftModelPos([leftModelPos[0], val, leftModelPos[2]]);
              }} />
          </label>
          <label className="ar-tuning-label">
            <span>Pos Z (Forward/Back): <strong>{(tuningHand === 'right' ? modelPos[2] : leftModelPos[2]).toFixed(2)}</strong></span>
            <input type="range" min={category === 'nosepin' ? -0.5 : -20} max={category === 'nosepin' ? 0.5 : 20} step="0.01" value={tuningHand === 'right' ? modelPos[2] : leftModelPos[2]}
              onChange={e => {
                const val = parseFloat(e.target.value);
                tuningHand === 'right' ? setModelPos([modelPos[0], modelPos[1], val]) : setLeftModelPos([leftModelPos[0], leftModelPos[1], val]);
              }} />
          </label>

          <div className="ar-tuning-divider" />

          <label className="ar-tuning-label">
            <span>Rot X (Pitch/Tilt): <strong>{((tuningHand === 'right' ? modelRot[0] : leftModelRot[0]) * (180 / Math.PI)).toFixed(0)}°</strong></span>
            <input type="range" min="-3.14159" max="3.14159" step="0.01" value={tuningHand === 'right' ? modelRot[0] : leftModelRot[0]}
              onChange={e => {
                const val = parseFloat(e.target.value);
                tuningHand === 'right' ? setModelRot([val, modelRot[1], modelRot[2]]) : setLeftModelRot([val, leftModelRot[1], leftModelRot[2]]);
              }} />
          </label>
          <label className="ar-tuning-label">
            <span>Rot Y (Yaw/Turn): <strong>{((tuningHand === 'right' ? modelRot[1] : leftModelRot[1]) * (180 / Math.PI)).toFixed(0)}°</strong></span>
            <input type="range" min="-3.14159" max="3.14159" step="0.01" value={tuningHand === 'right' ? modelRot[1] : leftModelRot[1]}
              onChange={e => {
                const val = parseFloat(e.target.value);
                tuningHand === 'right' ? setModelRot([modelRot[0], val, modelRot[2]]) : setLeftModelRot([leftModelRot[0], val, leftModelRot[2]]);
              }} />
          </label>
          <label className="ar-tuning-label">
            <span>Rot Z (Roll/Upside Down): <strong>{((tuningHand === 'right' ? modelRot[2] : leftModelRot[2]) * (180 / Math.PI)).toFixed(0)}°</strong></span>
            <input type="range" min="-3.14159" max="3.14159" step="0.01" value={tuningHand === 'right' ? modelRot[2] : leftModelRot[2]}
              onChange={e => {
                const val = parseFloat(e.target.value);
                tuningHand === 'right' ? setModelRot([modelRot[0], modelRot[1], val]) : setLeftModelRot([leftModelRot[0], leftModelRot[1], val]);
              }} />
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

      {/* Ring Tuning Panel (Admin only, Try On mode only) */}
      {viewMode === 'tryon' && isAdmin && showTuning && category === 'rings' && (
        <div className="ar-tuning-panel" style={{ top: railTop, right: '340px' }}>
          <div className="ar-tuning-header">
            <h4>Ring Fit Tuning</h4>
          </div>

          <label className="ar-tuning-label">
            <span>Right Hand (Palm Offset): <strong>{ringTuning.rightHandFrontOffset.toFixed(2)}</strong></span>
            <input type="range" min="-0.15" max="0.15" step="0.01" value={ringTuning.rightHandFrontOffset}
              onChange={e => setRingTuning({ ...ringTuning, rightHandFrontOffset: parseFloat(e.target.value) })} />
          </label>
          <label className="ar-tuning-label">
            <span>Right Hand (Back Offset): <strong>{ringTuning.rightHandBackOffset.toFixed(2)}</strong></span>
            <input type="range" min="-0.15" max="0.15" step="0.01" value={ringTuning.rightHandBackOffset}
              onChange={e => setRingTuning({ ...ringTuning, rightHandBackOffset: parseFloat(e.target.value) })} />
          </label>
          <label className="ar-tuning-label">
            <span>Left Hand (Palm Offset): <strong>{ringTuning.leftHandFrontOffset.toFixed(2)}</strong></span>
            <input type="range" min="-0.15" max="0.15" step="0.01" value={ringTuning.leftHandFrontOffset}
              onChange={e => setRingTuning({ ...ringTuning, leftHandFrontOffset: parseFloat(e.target.value) })} />
          </label>
          <label className="ar-tuning-label">
            <span>Left Hand (Back Offset): <strong>{ringTuning.leftHandBackOffset.toFixed(2)}</strong></span>
            <input type="range" min="-0.15" max="0.15" step="0.01" value={ringTuning.leftHandBackOffset}
              onChange={e => setRingTuning({ ...ringTuning, leftHandBackOffset: parseFloat(e.target.value) })} />
          </label>

          <div className="ar-tuning-divider" />

          <label className="ar-tuning-label">
            <span>Size (Palm side): <strong>{ringTuning.frontScale.toFixed(2)}</strong></span>
            <input type="range" min="0.1" max="0.4" step="0.01" value={ringTuning.frontScale}
              onChange={e => setRingTuning({ ...ringTuning, frontScale: parseFloat(e.target.value) })} />
          </label>
          <label className="ar-tuning-label">
            <span>Size (Back side): <strong>{ringTuning.backScale.toFixed(2)}</strong></span>
            <input type="range" min="0.1" max="0.4" step="0.01" value={ringTuning.backScale}
              onChange={e => setRingTuning({ ...ringTuning, backScale: parseFloat(e.target.value) })} />
          </label>
        </div>
      )}

    {/* ── Main viewport: live AR try-on ── */}
      <div className="tracking-container">
        <div className="ar-content" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}>
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
            showOccluder={showOccluder}
            modelPos={modelPos}
            modelRot={modelRot}
            leftModelPos={leftModelPos}
            leftModelRot={leftModelRot}
            modelScale={modelScale}
            modelSparkles={modelSparkles}
            activeModel={activeModel}
            isHandTracking={isHandTracking}
            category={category}
            customMaterials={customMaterials}
            ringTuning={ringTuning}
            dragResetTick={dragResetTick}
          />
        </div>
      </div>
    </div>{/* /tryon-camera-pane */}

      {/* ── Sidebar: category strip + models in category ── */}
      <div className="tryon-sidebar">
        <button
          type="button"
          className="tryon-sidebar-header"
          onClick={() => setCategoryStripOpen(o => !o)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {getCategoryMeta(category).label}
          </span>
          <svg
            style={{ width: 16, height: 16, transform: categoryStripOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {categoryStripOpen && (
          <div className="tryon-category-strip" ref={categoryStripRef}>
            <div className="tryon-category-track" ref={categoryTrackRef}>
              {[...orderedCategories, ...orderedCategories].map((cat, i) => {
                const meta = getCategoryMeta(cat);
                return (
                  <button
                    key={`${cat}-${i}`}
                    className={`tryon-category-chip ${category === cat ? 'active' : ''}`}
                    onClick={() => { if (categoryDragRef.current.moved) return; handleCategorySwitch(cat); }}
                  >
                    <span className="frame">
                      {meta.icon ? <img src={meta.icon} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} /> : meta.emoji}
                    </span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {renderModelGridAndPromo()}
      </div>

      {/* ── Phone-only bottom bar: hidden by default, revealed by the toggle arrow ── */}
      {viewMode === 'tryon' && (
        <div className="tryon-mobile-bar">
          <button
            className="tryon-mobile-bar-toggle"
            onClick={() => setMobileBarOpen(o => {
              const next = !o;
              if (!next) setMobileSheetOpen(false); // hiding the bar also hides the model sheet
              return next;
            })}
            title={mobileBarOpen ? 'Hide controls' : 'Show controls'}
          >
            <svg style={{ width: 18, height: 18, transform: mobileBarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>

          <div className={`tryon-mobile-bar-content ${mobileBarOpen ? 'open' : ''}`}>
            <div className="tryon-mobile-controls">
              <button className="ar-ctrl-btn" onClick={() => setZoomLevel(z => Math.max(1.0, z - 0.2))} title="Zoom Out">
                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
              <button className="ar-ctrl-btn tryon-mobile-capture" onClick={handleCapture} title="Take Photo">
                <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" /></svg>
              </button>
              <button className="ar-ctrl-btn" onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.2))} title="Zoom In">
                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
            </div>

            <div className="tryon-mobile-categories">
              {orderedCategories.map(cat => {
                const meta = getCategoryMeta(cat);
                return (
                  <button
                    key={cat}
                    className={`tryon-mobile-category-chip ${category === cat ? 'active' : ''}`}
                    onClick={() => { handleCategorySwitch(cat); setMobileSheetOpen(true); }}
                  >
                    {meta.icon ? <img src={meta.icon} alt="" /> : <span>{meta.emoji}</span>}
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Phone-only bottom sheet: models + promo, slides up over the bottom bar ── */}
      {viewMode === 'tryon' && (
        <div className={`tryon-mobile-sheet ${mobileSheetOpen ? 'open' : ''}`}>
          {renderModelGridAndPromo()}
        </div>
      )}
    </div>
  );
}
