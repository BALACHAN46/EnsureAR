import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FaceTracker from '../FaceTracker';
import HandTracker from '../HandTracker';
import Scene3D from '../Scene3D';
import ProductConfigurator from '../components/ar/ProductConfigurator';
import { getModelConfig, saveModelConfig, resetModelConfig, configToPosition, configToRotation, configToScale, configToScaleY, configToNecklaceBlur, configToLeftPosition, configToLeftRotation } from '../utils/modelConfig';
import { getCategoryMeta, orderCategories } from '../constants/categoryMeta';
import ARGuideModal from '../components/ar/ARGuideModal';
import { loadARGuideConfig } from '../utils/arGuideConfig';
import { getAllProducts, getFilteredProducts } from '../services/productsApi';
import { isAuthenticated } from '../utils/auth';

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

function useAutoScroll(stripRef, trackRef, dependencies = [], speed = 40) {
  const dragRef = useRef({ isDown: false, startX: 0, startOffset: 0, moved: false });

  useEffect(() => {
    const strip = stripRef.current;
    const track = trackRef.current;
    if (!strip || !track) return;

    // The idle glide runs as a real CSS animation (compositor thread) instead
    // of a JS requestAnimationFrame loop. This page also runs FaceTracker/
    // HandTracker landmark detection and a Three.js render loop every frame
    // on the *same* main JS thread — a rAF-driven translateX update competes
    // with that work for frame budget and visibly stutters whenever the
    // tracking pipeline spikes. A CSS animation keeps gliding smoothly
    // regardless of what the main thread is doing.
    let halfWidth = track.scrollWidth / 2;

    // Reads the track's current on-screen X translation, whether it's
    // presently coming from the running CSS animation or a manual drag
    // transform — lets pause/resume/drag hand off without a visible jump.
    const currentOffset = () => {
      const m = new DOMMatrixReadOnly(getComputedStyle(track).transform);
      return -m.m41;
    };

    const applySize = () => {
      halfWidth = track.scrollWidth / 2;
      const duration = halfWidth > 0 ? halfWidth / speed : 0;
      track.style.setProperty('--tryon-marquee-distance', `${halfWidth}px`);
      track.style.setProperty('--tryon-marquee-duration', `${duration}s`);
    };
    applySize();
    track.classList.add('tryon-category-track--auto');

    const ro = new ResizeObserver(applySize);
    ro.observe(track);

    const pause = () => { track.style.animationPlayState = 'paused'; };
    const resume = () => {
      if (dragRef.current.isDown || halfWidth <= 0) return;
      const offset = ((currentOffset() % halfWidth) + halfWidth) % halfWidth;
      // A negative animation-delay scrubs the keyframe timeline to `offset`
      // so playback picks up exactly where the pause/drag left off.
      track.style.animationDelay = `-${(offset / speed).toFixed(3)}s`;
      track.style.transform = '';
      track.style.animationName = '';
      track.style.animationPlayState = 'running';
    };

    const onMouseEnter = () => pause();
    const onMouseLeave = () => resume();

    const onDown = (clientX) => {
      const offset = currentOffset();
      pause();
      track.style.animationName = 'none';
      track.style.transform = `translateX(${-offset}px)`;
      dragRef.current = { isDown: true, startX: clientX, startOffset: offset, moved: false };
    };
    const onMove = (clientX) => {
      const drag = dragRef.current;
      if (!drag.isDown) return;
      const dx = clientX - drag.startX;
      if (Math.abs(dx) > 4) drag.moved = true;
      let next = drag.startOffset - dx;
      if (halfWidth > 0) next = ((next % halfWidth) + halfWidth) % halfWidth;
      track.style.transform = `translateX(${-next}px)`;
    };
    const onUp = () => {
      if (!dragRef.current.isDown) return;
      dragRef.current.isDown = false;
      resume();
    };

    const onMouseDown = (e) => onDown(e.clientX);
    const onMouseMove = (e) => onMove(e.clientX);
    const onTouchStart = (e) => onDown(e.touches[0].clientX);
    const onTouchMove = (e) => onMove(e.touches[0].clientX);
    const onTouchEnd = () => onUp();

    strip.addEventListener('mouseenter', onMouseEnter);
    strip.addEventListener('mouseleave', onMouseLeave);
    strip.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    strip.addEventListener('touchstart', onTouchStart, { passive: true });
    strip.addEventListener('touchmove', onTouchMove, { passive: true });
    strip.addEventListener('touchend', onTouchEnd);

    return () => {
      ro.disconnect();
      track.classList.remove('tryon-category-track--auto');
      track.style.animationDelay = '';
      track.style.transform = '';
      strip.removeEventListener('mouseenter', onMouseEnter);
      strip.removeEventListener('mouseleave', onMouseLeave);
      strip.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      strip.removeEventListener('touchstart', onTouchStart);
      strip.removeEventListener('touchmove', onTouchMove);
      strip.removeEventListener('touchend', onTouchEnd);
    };
  }, dependencies);

  return dragRef;
}

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
  const [modelScaleY, setModelScaleY] = useState(1);
  const [modelNecklaceBlur, setModelNecklaceBlur] = useState(18);
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
  const [showRingTuning, setShowRingTuning] = useState(true);
  useEffect(() => {
    if (showTuning) setShowRingTuning(true);
  }, [showTuning]);
  const [saved, setSaved] = useState(false);
  const [dragResetTick, setDragResetTick] = useState(0);
  const [viewMode, setViewMode] = useState('tryon'); // 'tryon' | 'configurator'

  // 3D Configurator only makes sense for real 3D models — 2D/flat uploads
  // (catalog entries whose modelPath is a .png, not .glb/.gltf) have no mesh
  // to recolor or view from other camera angles.
  const _modelPathStr = (activeModel?.modelPath || activeModel?.glbPath || '').split('?')[0];
  const isActiveModel3D = /\.(glb|gltf)$/i.test(_modelPathStr);
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

  // Whether the whole right-side category/model sidebar is collapsed (desktop only) — lets the camera view go full width
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Which page of the model grid is showing (paginated)
  const [modelPage, setModelPage] = useState(0);

  // Material filter for the current category (e.g. "Gold", "Diamond")
  const [materialFilter, setMaterialFilter] = useState('all');

  // Phone/tablet bottom sheet shows 1 row of 3 (rest via pagination);
  // desktop sidebar shows 3 rows of 3 (9 per page)
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1024px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = (e) => setIsMobileLayout(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const MODELS_PER_PAGE = isMobileLayout ? 3 : 16;

  // Tablet width (641px–1024px) shows 5 model cards per row in the bottom
  // sheet; phones stay at 4.
  const [isTabletLayout, setIsTabletLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 641px) and (max-width: 1024px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 641px) and (max-width: 1024px)');
    const handler = (e) => setIsTabletLayout(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Reset to the first page whenever the active category changes
  useEffect(() => {
    setModelPage(0);
    setMaterialFilter('all'); // Reset material filter on category change
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

  // Phone-only bottom sheet (models + promo) — opened by tapping a category
  // chip in the mobile bottom bar, or the bar's chevron
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const categoryStripRef = useRef(null);
  const categoryTrackRef = useRef(null);
  const categoryDragRef = useAutoScroll(categoryStripRef, categoryTrackRef, [categoryStripOpen, isMobileLayout, viewMode, sidebarCollapsed], 25);

  // Mobile categories auto-scroll refs
  const mobileCategoryStripRef = useRef(null);
  const mobileCategoryTrackRef = useRef(null);
  const modelsTrackRef = useRef(null);
  const mobileCategoryDragRef = useAutoScroll(mobileCategoryStripRef, mobileCategoryTrackRef, [mobileSheetOpen, isMobileLayout, viewMode], 25);

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

  // Load catalog (active models only — this is the public try-on page)
  useEffect(() => {
    getAllProducts({ includeInactive: false }).then(models => {
      setCatalog(models);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!catalog.length || !category) return;

    let active = true;

    // Remove empty models from dropdown lists, keeping only valid ones
    const materialFilterParams = materialFilter === 'all' ? null : materialFilter;

    getFilteredProducts({ category, material: materialFilterParams, includeInactive: false }).then(async models => {
      if (!active) return;
      
      const catModels = models.filter(m => m.category === category);
      setActiveCategoryModels(catModels);

      const found = models.find(m => m.id === modelId) || catModels[0];
      if (found) {
        await applyModelConfig(found.id);
        if (active) setActiveModel(found);
      }
    }).catch(console.error);

    return () => { active = false; };
  }, [category, modelId, materialFilter, catalog.length]);

  // If the selected model isn't a 3D one (or none is selected yet), the
  // Configurator tab is hidden — bounce back to Try On if it was left open
  // from a previous 3D model.
  useEffect(() => {
    if (viewMode === 'configurator' && !isActiveModel3D) setViewMode('tryon');
  }, [viewMode, isActiveModel3D]);

  // Show AR guide modal every time category changes (respects SuperAdmin config)
  useEffect(() => {
    let cancelled = false;
    loadARGuideConfig().then(cfg => { // Re-read in case admin changed it
      if (cancelled) return;
      setArGuideConfig(cfg);
      if (category && cfg.entryModalEnabled) {
        setGuideOpen(true);
        setGuideAccepted(false);
      } else {
        setGuideOpen(false);
        setGuideAccepted(!cfg.entryModalEnabled); // auto-accept if modal disabled
      }
    });
    return () => { cancelled = true; };
  }, [category]);

  // Draggable help button handlers
  const onHelpDragStart = (clientX, clientY) => {
    const el = helpDragRef.current;
    if (!el) return;
    helpDragState.current = { dragging: true, startX: clientX, startY: clientY, origX: el.offsetLeft, origY: el.offsetTop };
    el.style.transition = 'none';
  };
  const onHelpDragMove = (clientX, clientY) => {
    if (!helpDragState.current.dragging) return;
    const { startX, startY, origX, origY } = helpDragState.current;
    const nx = origX + (clientX - startX);
    const ny = origY + (clientY - startY);
    const parent = helpDragRef.current?.parentElement;
    if (!parent) return;
    const size = 42;
    const finalX = Math.min(Math.max(nx, 4), parent.clientWidth - size - 4);
    const finalY = Math.min(Math.max(ny, 4), parent.clientHeight - size - 4);

    if (helpDragRef.current) {
      helpDragRef.current.style.position = 'absolute';
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

  const applyModelConfig = async (id) => {
    const cfg = await getModelConfig(id);
    setModelPos(configToPosition(cfg));
    setModelRot(configToRotation(cfg));
    setLeftModelPos(configToLeftPosition(cfg));
    setLeftModelRot(configToLeftRotation(cfg));
    setModelScale(configToScale(cfg));
    setModelScaleY(configToScaleY(cfg));
    setModelNecklaceBlur(configToNecklaceBlur(cfg));
    setModelSparkles(!!cfg.enableSparkles);
    if (cfg.ring) setRingTuning(prev => ({ ...prev, ...cfg.ring }));
  };

  const handleModelSelect = async (model) => {
    await applyModelConfig(model.id);
    setActiveModel(model);
    setResetTick(t => t + 1);
    setCustomMaterials({});
    setModelMeshes([]);
    setActiveColorId('original');
    setCameraView(null);
  };

  const handleCategorySwitch = async (cat) => {
    if (cat === category) return;
    setMaterialFilter('all');
    try {
      // Fetch specifically for this category so the first item EXACTLY matches
      // the first item that will appear in the UI grid, rather than relying on
      // the unfiltered catalog which might have a different tie-breaker sort.
      const models = await getFilteredProducts({ category: cat, includeInactive: false });
      const firstOfCat = models.filter(m => m.category === cat)[0];
      if (firstOfCat) {
        navigate(`/ar/${cat}/${firstOfCat.id}`, { replace: true });
      }
    } catch (err) {
      console.error('Error fetching category models for switch:', err);
    }
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
      scaleY: modelScaleY,
      necklaceBlur: modelNecklaceBlur,
      enableSparkles: modelSparkles,
      category: activeModel.category,
      ring: category === 'rings' ? ringTuning : undefined,
    });

    setSaved(res.success ? 'Saved!' : false);
    if (res.success) setTimeout(() => setSaved(false), 2000);
  };

  const handleResetTuning = async () => {
    if (!activeModel) return;
    await resetModelConfig(activeModel.id);
    setModelPos([0, 0, 0]);
    setModelRot([0, 0, 0]);
    setLeftModelPos([0, 0, 0]);
    setLeftModelRot([0, 0, 0]);
    setModelScale(1);
    setModelScaleY(1);
    setModelNecklaceBlur(18);
    setSaved('Reset!');
    setTimeout(() => setSaved(false), 2000);
  };

  const isAdmin = isAuthenticated();
  const isHandTracking = category === 'watch' || category === 'bracelets' || category === 'rings';

  const availableCategories = [...new Set(catalog.map(m => m.category))];
  const orderedCategories = orderCategories(availableCategories);

  // Detect material types present in the current category's models
  const GoldIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" style={{marginRight: '6px', filter: 'drop-shadow(0 0 2px rgba(251,191,36,0.5))'}}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
  
  const DiamondIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#60a5fa" style={{marginRight: '6px', filter: 'drop-shadow(0 0 2px rgba(96,165,250,0.5))'}}>
      <path d="M12 2L2 9l10 13L22 9l-10-7zM2.8 9.5l4-5h10.4l4 5L12 20.3 2.8 9.5z" stroke="#60a5fa" strokeWidth="1" />
      <path d="M12 2l4 7h-8zM7.5 9h9L12 21z" fill="#60a5fa" opacity="0.8"/>
    </svg>
  );

  const OthersIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8" style={{marginRight: '6px'}}>
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="19" cy="12" r="2.5" />
    </svg>
  );

  const MATERIAL_TAGS = [
    { key: 'gold', label: <span style={{display:'flex', alignItems:'center'}}><GoldIcon /> Gold</span>, keywords: ['gold'] },
    { key: 'diamond', label: <span style={{display:'flex', alignItems:'center'}}><DiamondIcon /> Diamond</span>, keywords: ['diamond'] },
    { key: 'others', label: <span style={{display:'flex', alignItems:'center'}}><OthersIcon /> Others</span>, keywords: ['others'] },
  ];

  const isModelMatchMaterial = (model, tag) => {
    if (!model || !tag) return false;
    const mat = model.material?.toLowerCase().trim() || '';
    const name = model.name?.toLowerCase().trim() || '';
    if (mat) {
      return mat === tag.key.toLowerCase() || tag.keywords.some(kw => mat.includes(kw));
    }
    return tag.keywords.some(kw => name.includes(kw));
  };

  const availableMaterialFilters = useMemo(() => {
    if (category === 'watch') {
      return [];
    }

    // Per-category: which chips to always show (even if no models match)
    const categoryAlwaysShow = {
      eyewear: new Set(),  // no always-show chips for eyewear
    };
    const alwaysShow = categoryAlwaysShow[category] ?? new Set(['gold', 'diamond']);
    const tags = MATERIAL_TAGS.filter(tag =>
      alwaysShow.has(tag.key) ||
      activeCategoryModels.some(m => isModelMatchMaterial(m, tag))
    );
    return tags;
  }, [activeCategoryModels, category]);

  const [filteredModels, setFilteredModels] = useState([]);

  useEffect(() => {
    let active = true;
    if (modelsTrackRef.current) {
      modelsTrackRef.current.scrollLeft = 0;
    }
    if (materialFilter === 'all') {
      setFilteredModels(activeCategoryModels);
    } else {
      getFilteredProducts({ category, material: materialFilter })
        .then(models => {
          if (active) setFilteredModels(models);
        })
        .catch(console.error);
    }
    return () => { active = false; };
  }, [category, materialFilter, activeCategoryModels]);

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
  const renderModelGridAndPromo = () => {
    const modelsToRender = isMobileLayout ? filteredModels : filteredModels.slice(modelPage * MODELS_PER_PAGE, modelPage * MODELS_PER_PAGE + MODELS_PER_PAGE);

    const renderCard = (model) => (
      <div
        key={model.id}
        className={`ar-carousel-item ${activeModel?.id === model.id ? 'active' : ''}`}
        onClick={() => handleModelSelect(model)}
        title={model.name}
      >
        {model.thumbnailPath ? (
          <img src={model.thumbnailPath} alt={model.name} crossOrigin="anonymous" />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#94a3b8' }}>
            {model.name.charAt(0)}
          </div>
        )}
        {activeModel?.id === model.id && (
          <span className="ar-carousel-item-check">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414L8.5 12.086l6.79-6.796a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </span>
        )}
      </div>
    );

    // Mobile/tablet: chunk into fixed pages (4 on phone, 5 on tablet) so a
    // scroll gesture always snaps to a full page (no partial next card
    // peeking in from the edge).
    const mobilePages = [];
    if (isMobileLayout) {
      const perPage = isTabletLayout ? 5 : 4;
      for (let i = 0; i < modelsToRender.length; i += perPage) {
        mobilePages.push(modelsToRender.slice(i, i + perPage));
      }
    }

    return (
      <>
        <div className="carousel-track grid" ref={modelsTrackRef}>
          {isMobileLayout
            ? mobilePages.map((page, pageIdx) => (
                <div className="tryon-mobile-model-page" key={pageIdx}>
                  {page.map(renderCard)}
                </div>
              ))
            : modelsToRender.map(renderCard)}
        </div>

        {!isMobileLayout && filteredModels.length > MODELS_PER_PAGE && (
          <div className="tryon-pagination">
            <button
              type="button"
              onClick={() => setModelPage(p => Math.max(0, p - 1))}
              disabled={modelPage === 0}
              aria-label="Previous models"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span>{modelPage + 1} / {Math.ceil(filteredModels.length / MODELS_PER_PAGE)}</span>
            <button
              type="button"
              onClick={() => setModelPage(p => Math.min(Math.ceil(filteredModels.length / MODELS_PER_PAGE) - 1, p + 1))}
              disabled={modelPage >= Math.ceil(filteredModels.length / MODELS_PER_PAGE) - 1}
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
  };

  return (
    <div className="tryon-split-layout">
      <div className="tryon-camera-pane">

        {/* ── Fixed header: back button, Try On / 3D Configurator switcher, mode-specific controls ── */}
        <div className="ar-header" ref={headerRef}>
          {/* Phone-only mockup header matching Image 1 exactly */}
          {isMobileLayout && (
            <div className="tryon-mobile-mockup-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  className="ar-ctrl-btn ar-back-btn"
                  onClick={() => {
                    if (window.history.state && window.history.state.idx > 0) {
                      navigate(-1);
                    } else {
                      navigate(isAdmin ? '/admin/models' : '/');
                    }
                  }}
                  style={{ padding: '6px', background: 'transparent', border: 'none', color: '#fff' }}
                >
                  <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <img src="/ENSUREAR.png" alt="EnsureAR" className="mockup-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
              </div>
              <div className="mockup-right-icons">
                <div className="ar-mode-switch ar-mode-switch--mobile">
                  <button
                    className={`ar-mode-btn ${viewMode === 'tryon' ? 'active' : ''}`}
                    onClick={() => setViewMode('tryon')}
                    aria-label="Try On"
                    title="Try On"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {isActiveModel3D && (
                    <button
                      className={`ar-mode-btn ${viewMode === 'configurator' ? 'active' : ''}`}
                      onClick={() => setViewMode('configurator')}
                      aria-label="3D Configurator"
                      title="3D Configurator"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L22 12L12 22L2 12L12 2Z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="ar-topbar hide-on-mobile">
            <div className="ar-topbar-left" style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'flex-start' }}>
              <button
                className="ar-ctrl-btn ar-back-btn"
                onClick={() => {
                  if (window.history.state && window.history.state.idx > 0) {
                    navigate(-1);
                  } else {
                    navigate(isAdmin ? '/admin/models' : '/');
                  }
                }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                <span>Back</span>
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
              {isActiveModel3D && (
                <button
                  className={`ar-mode-btn ${viewMode === 'configurator' ? 'active' : ''}`}
                  onClick={() => setViewMode('configurator')}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L22 12L12 22L2 12L12 2Z" />
                  </svg>
                  <span>3D Configurator</span>
                </button>
              )}
            </div>

            <div className="ar-topbar-right" style={{ flex: '1 0 auto', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>

              {viewMode === 'tryon' && isAdmin && activeModel && (
                <button
                  className="ar-ctrl-btn"
                  onClick={() => navigate(`/admin/models/${activeModel.id}`)}
                  title="Edit this Model"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              )}


            </div>
          </div>
        </div>



        {/* ── Vertical control stack: zoom/reset/admin toggles below, expand chevron at bottom ── */}
        {viewMode === 'tryon' && (
          <div className="ar-vertical-controls">
            <button
              className="ar-ctrl-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', borderRadius: '50%' }}
              onClick={() => setSidebarCollapsed(c => !c)}
              title={sidebarCollapsed ? 'Show category panel' : 'Hide category panel'}
            >
              <svg style={{ width: 16, height: 16, transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>

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

          </div>
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

            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.6rem', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '6px' }}>
              <button
                style={{ flex: 1, padding: '3px 6px', borderRadius: '5px', background: tuningHand === 'right' ? '#3b82f6' : 'transparent', color: tuningHand === 'right' ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}
                onClick={() => setTuningHand('right')}
              >
                {category === 'earrings' ? 'Left Ear' : 'Left Hand'}
              </button>
              <button
                style={{ flex: 1, padding: '3px 6px', borderRadius: '5px', background: tuningHand === 'left' ? '#3b82f6' : 'transparent', color: tuningHand === 'left' ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}
                onClick={() => setTuningHand('left')}
              >
                {category === 'earrings' ? 'Right Ear' : 'Right Hand'}
              </button>
            </div>

            {category === 'rings' && !showRingTuning && (
              <button 
                onClick={() => setShowRingTuning(true)}
                style={{ width: '100%', padding: '6px', marginBottom: '0.6rem', borderRadius: '5px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
              >
                ⚙️ Open Ring Fit Tuning
              </button>
            )}

            {(() => {
              const posMin = category === 'nosepin' ? -0.5 : -20;
              const posMax = category === 'nosepin' ? 0.5 : 20;
              const curPos = tuningHand === 'right' ? modelPos : leftModelPos;
              const setCurPos = tuningHand === 'right' ? setModelPos : setLeftModelPos;
              const curRot = tuningHand === 'right' ? modelRot : leftModelRot;
              const setCurRot = tuningHand === 'right' ? setModelRot : setLeftModelRot;
              const toDeg = v => (v * (180 / Math.PI)).toFixed(0) + '°';

              const rows = [
                { group: 'pos', key: 'posX', label: 'Pos X (Left/Right)', value: curPos[0], min: posMin, max: posMax, format: v => v.toFixed(2), onChange: v => setCurPos([v, curPos[1], curPos[2]]) },
                { group: 'pos', key: 'posY', label: 'Pos Y (Up/Down)', value: curPos[1], min: posMin, max: posMax, format: v => v.toFixed(2), onChange: v => setCurPos([curPos[0], v, curPos[2]]) },
                { group: 'pos', key: 'posZ', label: 'Pos Z (Forward/Back)', value: curPos[2], min: posMin, max: posMax, format: v => v.toFixed(2), onChange: v => setCurPos([curPos[0], curPos[1], v]) },
                { group: 'rot', key: 'rotX', label: 'Rot X (Pitch/Tilt)', value: curRot[0], min: -3.14159, max: 3.14159, format: toDeg, onChange: v => setCurRot([v, curRot[1], curRot[2]]) },
                { group: 'rot', key: 'rotY', label: 'Rot Y (Yaw/Turn)', value: curRot[1], min: -3.14159, max: 3.14159, format: toDeg, onChange: v => setCurRot([curRot[0], v, curRot[2]]) },
                { group: 'rot', key: 'rotZ', label: 'Rot Z (Roll/Upside Down)', value: curRot[2], min: -3.14159, max: 3.14159, format: toDeg, onChange: v => setCurRot([curRot[0], curRot[1], v]) },
                { group: 'scale', key: 'scale', label: 'Scale (Size)', value: modelScale, min: -20, max: 20, format: v => v.toFixed(2) + 'x', onChange: v => setModelScale(v) },
                { group: 'scale', key: 'scaleY', label: 'Height Scale (Y)', value: modelScaleY, min: 0.01, max: 10, format: v => v.toFixed(2) + 'x', onChange: v => setModelScaleY(v) },
                ...(category === 'necklace' ? [{ group: 'scale', key: 'blur', label: 'Top Blur', value: modelNecklaceBlur, min: 0, max: 100, format: v => parseInt(v) + '%', onChange: v => setModelNecklaceBlur(v) }] : []),
              ];

              return rows.map((r, idx) => {
                const showDivider = r.group !== rows[idx - 1]?.group && idx > 0;
                const pct = ((r.value - r.min) / (r.max - r.min)) * 100;
                return (
                  <React.Fragment key={r.key}>
                    {showDivider && <div className="ar-tuning-divider" />}
                    <label className="ar-tuning-label">
                      <span>{r.label}: <strong>{r.format(r.value)}</strong></span>
                      <input
                        type="range"
                        min={r.min}
                        max={r.max}
                        step="0.01"
                        value={r.value}
                        className="ar-tuning-slider"
                        style={{ '--slider-pct': `${pct}%` }}
                        onChange={e => r.onChange(parseFloat(e.target.value))}
                      />
                    </label>
                  </React.Fragment>
                );
              });
            })()}

            <label className="ar-tuning-label" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
              <span>✨ Sparkling Effect</span>
              <input type="checkbox" checked={modelSparkles} onChange={e => setModelSparkles(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: '#fbbf24', cursor: 'pointer' }} />
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
        {viewMode === 'tryon' && isAdmin && showTuning && showRingTuning && category === 'rings' && (
          <div className="ar-tuning-panel" style={{ top: railTop, right: '340px' }}>
            <div className="ar-tuning-header">
              <h4>Ring Fit Tuning</h4>
              <button className="ar-tuning-close" onClick={() => setShowRingTuning(false)}>✕</button>
            </div>

            <label className="ar-tuning-label">
              <span>Right Hand (Palm Offset): <strong>{ringTuning.rightHandFrontOffset.toFixed(2)}</strong></span>
              <input type="range" min="-0.15" max="0.15" step="0.01" value={ringTuning.rightHandFrontOffset}
                className="ar-tuning-slider"
                style={{ '--slider-pct': `${((ringTuning.rightHandFrontOffset + 0.15) / 0.3) * 100}%` }}
                onChange={e => setRingTuning({ ...ringTuning, rightHandFrontOffset: parseFloat(e.target.value) })} />
            </label>
            <label className="ar-tuning-label">
              <span>Right Hand (Back Offset): <strong>{ringTuning.rightHandBackOffset.toFixed(2)}</strong></span>
              <input type="range" min="-0.15" max="0.15" step="0.01" value={ringTuning.rightHandBackOffset}
                className="ar-tuning-slider"
                style={{ '--slider-pct': `${((ringTuning.rightHandBackOffset + 0.15) / 0.3) * 100}%` }}
                onChange={e => setRingTuning({ ...ringTuning, rightHandBackOffset: parseFloat(e.target.value) })} />
            </label>
            <label className="ar-tuning-label">
              <span>Left Hand (Palm Offset): <strong>{ringTuning.leftHandFrontOffset.toFixed(2)}</strong></span>
              <input type="range" min="-0.15" max="0.15" step="0.01" value={ringTuning.leftHandFrontOffset}
                className="ar-tuning-slider"
                style={{ '--slider-pct': `${((ringTuning.leftHandFrontOffset + 0.15) / 0.3) * 100}%` }}
                onChange={e => setRingTuning({ ...ringTuning, leftHandFrontOffset: parseFloat(e.target.value) })} />
            </label>
            <label className="ar-tuning-label">
              <span>Left Hand (Back Offset): <strong>{ringTuning.leftHandBackOffset.toFixed(2)}</strong></span>
              <input type="range" min="-0.15" max="0.15" step="0.01" value={ringTuning.leftHandBackOffset}
                className="ar-tuning-slider"
                style={{ '--slider-pct': `${((ringTuning.leftHandBackOffset + 0.15) / 0.3) * 100}%` }}
                onChange={e => setRingTuning({ ...ringTuning, leftHandBackOffset: parseFloat(e.target.value) })} />
            </label>

            <div className="ar-tuning-divider" />

            <label className="ar-tuning-label">
              <span>Size (Palm side): <strong>{ringTuning.frontScale.toFixed(2)}</strong></span>
              <input type="range" min="0.1" max="0.4" step="0.01" value={ringTuning.frontScale}
                className="ar-tuning-slider"
                style={{ '--slider-pct': `${((ringTuning.frontScale - 0.1) / 0.3) * 100}%` }}
                onChange={e => setRingTuning({ ...ringTuning, frontScale: parseFloat(e.target.value) })} />
            </label>
            <label className="ar-tuning-label">
              <span>Size (Back side): <strong>{ringTuning.backScale.toFixed(2)}</strong></span>
              <input type="range" min="0.1" max="0.4" step="0.01" value={ringTuning.backScale}
                className="ar-tuning-slider"
                style={{ '--slider-pct': `${((ringTuning.backScale - 0.1) / 0.3) * 100}%` }}
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
              modelScaleY={modelScaleY}
              modelNecklaceBlur={modelNecklaceBlur}
              modelSparkles={modelSparkles}
              activeModel={activeModel}
              isHandTracking={isHandTracking}
              category={category}
              customMaterials={customMaterials}
              ringTuning={ringTuning}
              dragResetTick={dragResetTick}
            />
          </div>

          {/* AR Help (?) floating button – draggable, appears after guide accepted, respects config */}
          {viewMode === 'tryon' && guideAccepted && arGuideConfig.helpIconEnabled && (
            <button
              ref={helpDragRef}
              className="watch-help-btn"
              style={{
                ...(helpBtnPos.x !== null
                  ? { position: 'absolute', left: helpBtnPos.x, top: helpBtnPos.y, bottom: 'unset', right: 'unset' }
                  : { position: 'absolute', bottom: '24px', right: '24px', left: 'unset', top: 'unset' })
              }}
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
        </div>
      </div>{/* /tryon-camera-pane */}

      {/* ── Sidebar: category strip + models in category (hidden when collapsed via the vertical control rail) ── */}
      {!sidebarCollapsed && (
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
                    <div className="icon-box">
                      <div className="corner-brackets"><div className="cb-inner"></div></div>
                      {meta.icon ? <img src={meta.icon} alt="" style={{ width: '46px', height: '46px', objectFit: 'contain' }} draggable={false} /> : meta.emoji}
                    </div>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Material Filter Chips (only shown when models with known materials exist in current category) */}
        {availableMaterialFilters.length > 0 && (
          <div className="material-filter-row">
            <button
              className={`material-filter-chip ${materialFilter === 'all' ? 'active' : ''}`}
              onClick={() => { setMaterialFilter('all'); setModelPage(0); }}
            >
              All
            </button>
            {availableMaterialFilters.map(tag => (
              <button
                key={tag.key}
                className={`material-filter-chip ${materialFilter === tag.key ? 'active' : ''}`}
                onClick={() => { setMaterialFilter(tag.key); setModelPage(0); }}
              >
                {tag.label}
              </button>
            ))}
          </div>
        )}

        {renderModelGridAndPromo()}
      </div>
      )}

      {/* ── Phone-only floating camera controls ── */}
      {viewMode === 'tryon' && isMobileLayout && (
        <div className="tryon-mobile-controls-floating">
          <div className="tmc-left">
            {isAdmin && (
              <button
                className={`ar-ctrl-btn ${showTuning ? 'ar-ctrl-btn--active' : ''}`}
                style={{
                  color: showTuning ? '#f59e0b' : 'currentColor',
                  borderColor: showTuning ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255, 255, 255, 0.14)',
                  marginRight: '0.75rem'
                }}
                onClick={() => setShowTuning(!showTuning)}
                title="Admin: Model Position Tuning"
              >
                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </button>
            )}
            <button className="ar-ctrl-btn" onClick={() => setZoomLevel(z => Math.max(1.0, z - 0.2))} title="Zoom Out">
              <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
          </div>

          <div className="tmc-center">
            <button className="ar-ctrl-btn tryon-mobile-capture" onClick={handleCapture} title="Take Photo">
              <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" /></svg>
            </button>
          </div>

          <div className="tmc-right">
            <button className="ar-ctrl-btn" onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.2))} title="Zoom In">
              <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>

            {(category === 'necklace' || category === 'earrings') && (
              <button className="ar-ctrl-btn" onClick={() => setDragResetTick(t => t + 1)} title="Undo drag position">
                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Phone-only bottom accordion panel ── */}
      {viewMode === 'tryon' && isMobileLayout && (
        <div className={`tryon-mobile-accordion ${mobileSheetOpen ? 'expanded' : ''}`}>

          <div className="tryon-mobile-header-and-categories">
            <div className="tryon-mobile-header" onClick={() => setMobileSheetOpen(!mobileSheetOpen)}>
              <span>Categories</span>
              <svg style={{ width: 20, height: 20, transform: mobileSheetOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            <div className="tryon-mobile-categories-wrapper" ref={mobileCategoryStripRef}>
              <div className="tryon-mobile-categories" ref={mobileCategoryTrackRef}>
                {[...orderedCategories, ...orderedCategories].map((cat, i) => {
                  const meta = getCategoryMeta(cat);
                  return (
                    <button
                      key={`${cat}-${i}`}
                      className={`tryon-mobile-category-chip ${category === cat ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (mobileCategoryDragRef.current.moved) return;
                        handleCategorySwitch(cat);
                      }}
                    >
                      <div className="icon-box">
                        <div className="corner-brackets"><div className="cb-inner"></div></div>
                        {meta.icon ? <img src={meta.icon} alt="" draggable={false} /> : <span>{meta.emoji}</span>}
                      </div>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {availableMaterialFilters.length > 0 && (
            <div className="material-filter-row" style={{ padding: '0.5rem 1rem', overflowX: 'auto', flexWrap: 'nowrap', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                className={`material-filter-chip ${materialFilter === 'all' ? 'active' : ''}`}
                onClick={() => { setMaterialFilter('all'); setModelPage(0); }}
                style={{ flexShrink: 0 }}
              >
                All
              </button>
              {availableMaterialFilters.map(tag => (
                <button
                  key={tag.key}
                  className={`material-filter-chip ${materialFilter === tag.key ? 'active' : ''}`}
                  onClick={() => { setMaterialFilter(tag.key); setModelPage(0); }}
                  style={{ flexShrink: 0 }}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          )}

          <div className="tryon-mobile-models-wrapper">
            {renderModelGridAndPromo()}
          </div>

        </div>
      )}
    </div>
  );
}
