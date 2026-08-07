import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { orderCategories } from '../constants/categoryMeta';
import { loadSiteContentConfig } from '../utils/siteContentConfig';

// ─── Categories ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'necklace',  label: '📿 Necklace' },
  { value: 'earrings',  label: '💍 Earrings' },
  { value: 'rings',     label: '💎 Rings' },
  { value: 'bracelets', label: '⛓️ Bracelets' },
  { value: 'watch',     label: '⌚ Watch' },
  { value: 'eyewear',   label: '🕶️ Eyewear' },
];

// ─── Analysis checklist items ──────────────────────────────────────────────
const ANALYSIS_CHECKS = [
  { id: 'up',        label: 'Detect Up Axis',         group: 'Analysis' },
  { id: 'fwd',       label: 'Detect Forward Axis',    group: 'Analysis' },
  { id: 'scale',     label: 'Detect Scale',           group: 'Analysis' },
  { id: 'center',    label: 'Detect Center & Pivot',  group: 'Analysis' },
  { id: 'bounds',    label: 'Detect Bounding Box',    group: 'Analysis' },
  { id: 'mat',       label: 'Detect Materials',       group: 'Analysis' },
  { id: 'normrot',   label: 'Normalize Rotation',     group: 'Auto Correction' },
  { id: 'normscale', label: 'Normalize Scale',        group: 'Auto Correction' },
  { id: 'centerpiv', label: 'Center Pivot',           group: 'Auto Correction' },
  { id: 'thumb',     label: 'Generate Thumbnail',     group: 'Auto Correction' },
];

export default function UploadPage() {
  const navigate = useNavigate();

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStorage.getItem('sa_auth') !== 'true') {
      navigate('/admin');
    }
  }, []);

  // ── Sidebar data ──────────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const categories = orderCategories([...new Set(catalog.map(m => m.category))]);
  const modelCounts = categories.reduce((acc, cat) => {
    acc[cat] = catalog.filter(m => m.category === cat).length;
    return acc;
  }, {});

  useEffect(() => {
    fetch('/models/catalog.json')
      .then(r => r.json())
      .then(d => setCatalog(d?.models || []))
      .catch(() => {});
  }, []);

  // ── Menu Settings (Parent / Child Category) ───────────────────────────────
  const [menuConfig, setMenuConfig] = useState(null);
  useEffect(() => {
    setMenuConfig(loadSiteContentConfig());
  }, []);
  const menuTree = menuConfig?.virtualTryOnMenu || [];

  // ── Form state ────────────────────────────────────────────────────────────
  const [modelFile, setModelFile]       = useState(null);
  const [mtlFile, setMtlFile]           = useState(null);
  const [textureFiles, setTextureFiles] = useState([]);
  const [thumbFile, setThumbFile]       = useState(null);
  const [name, setName]                 = useState('');
  const [category, setCategory]         = useState('necklace');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [childCategoryId, setChildCategoryId]   = useState('');
  const [materialTag, setMaterialTag]   = useState('');
  const [scaleX, setScaleX]             = useState(1);
  const [scaleY, setScaleY]             = useState(1);
  const [scaleZ, setScaleZ]             = useState(1);
  const [offsetX, setOffsetX]           = useState(0);
  const [offsetY, setOffsetY]           = useState(0);
  const [offsetZ, setOffsetZ]           = useState(0);
  const [rotX, setRotX]                 = useState(0);
  const [rotY, setRotY]                 = useState(0);
  const [rotZ, setRotZ]                 = useState(0);
  const [dragOver, setDragOver]         = useState(false);

  // ── Parent / Child Category derived data & handlers ───────────────────────
  const selectedParent = menuTree.find(p => p.id === parentCategoryId) || null;
  const childOptions   = selectedParent?.children || [];
  const selectedChild  = childOptions.find(c => c.id === childCategoryId) || null;

  const handleParentChange = useCallback((id) => {
    setParentCategoryId(id);
    setChildCategoryId('');
    const parent = menuTree.find(p => p.id === id);
    if (parent && (!parent.children || parent.children.length === 0) && parent.targetCategory) {
      setCategory(parent.targetCategory);
    }
  }, [menuTree]);

  const handleChildChange = useCallback((id) => {
    setChildCategoryId(id);
    const child = selectedParent?.children?.find(c => c.id === id);
    if (child && child.targetCategory) {
      setCategory(child.targetCategory);
    }
  }, [selectedParent]);

  // ── Modal / pipeline state ────────────────────────────────────────────────
  const [showModal, setShowModal]           = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [progress, setProgress]             = useState(0);
  const [analyzing, setAnalyzing]           = useState(false);
  const [checks, setChecks]                 = useState({});
  const [confirmReady, setConfirmReady]     = useState(false);
  const [toast, setToast]                   = useState({ msg: '', type: '', show: false });
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState(null);

  // ── Three.js refs ─────────────────────────────────────────────────────────
  const canvasRef           = useRef(null);
  const sceneRef            = useRef(null);
  const cameraRef           = useRef(null);
  const rendererRef         = useRef(null);
  const orbitRef            = useRef(null);
  const modelObjectRef      = useRef(null);
  const animFrameRef        = useRef(null);
  const is3DModeRef         = useRef(false);
  const dummyObjectRef      = useRef(null);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 4000);
  }, []);

  // ── Three.js modules (static npm imports, no CDN) ────────────────────────
  const getThree = useCallback(() => {
    return { THREE, GLTFLoader, OBJLoader, MTLLoader, GLTFExporter, OrbitControls };
  }, []);

  // ── Init preview renderer ─────────────────────────────────────────────────
  const initPreview = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xe0e0e0);
    const envLight = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide })
    );
    envScene.add(envLight);
    const pmremGen = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGen.fromScene(envScene).texture;
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const dir = new THREE.DirectionalLight(0xffffff, 2);
    dir.position.set(2, 3, 4);
    scene.add(dir);
    scene.add(new THREE.GridHelper(5, 50, 0x444444, 0x222222));
    scene.add(new THREE.AxesHelper(2));
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
    camera.position.set(2, 2, 3);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    orbitRef.current = controls;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      const sz = renderer.getSize(new THREE.Vector2());
      if (canvas.clientWidth !== sz.x || canvas.clientHeight !== sz.y) {
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    };
    animate();
  }, []);

  // ── Apply heuristics (auto-correct rotation/scale like MVC) ───────────────
  const applyHeuristics = useCallback((obj, cat) => {
    obj.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(obj);
    let size = new THREE.Vector3();
    box.getSize(size);

    if (cat === 'eyewear') {
      if (size.y > size.x && size.y > size.z) obj.rotation.x -= Math.PI / 2;
      else if (size.z > size.x && size.z > size.y) obj.rotation.y += Math.PI / 2;
      obj.updateMatrixWorld(true);
      box.setFromObject(obj);
      box.getSize(size);
      if (size.y > size.z) obj.rotation.x -= Math.PI / 2;
    } else if (cat === 'necklace') {
      if (size.z > size.y) obj.rotation.x -= Math.PI / 2;
    } else if (['rings', 'bracelets', 'watch'].includes(cat)) {
      if (size.x > size.y && size.x > size.z) obj.rotation.z += Math.PI / 2;
      else if (size.z > size.y && size.z > size.x) obj.rotation.x -= Math.PI / 2;
    }

    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const sf = 1.0 / maxDim;
      obj.scale.set(sf, sf, sf);
    }

    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    obj.position.sub(center);
  }, []);

  // ── Sync advanced form fields from 3D object ──────────────────────────────
  const syncFormFields = useCallback(() => {
    const obj = modelObjectRef.current;
    if (!obj) return;
    setScaleX(+obj.scale.x.toFixed(3));
    setScaleY(+obj.scale.y.toFixed(3));
    setScaleZ(+obj.scale.z.toFixed(3));
    setOffsetX(+obj.position.x.toFixed(3));
    setOffsetY(+obj.position.y.toFixed(3));
    setOffsetZ(+obj.position.z.toFixed(3));
    setRotX(+THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1));
    setRotY(+THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1));
    setRotZ(+THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1));
  }, []);

  // ── Simulate analysis checklist (same timing as MVC) ─────────────────────
  const simulateAnalysis = useCallback(async (cat) => {
    setChecks({});
    setConfirmReady(false);

    const delay = ms => new Promise(res => setTimeout(res, ms));
    for (const { id } of ANALYSIS_CHECKS) {
      await delay(150 + Math.random() * 100);
      setChecks(prev => ({ ...prev, [id]: true }));
    }

    applyHeuristics(modelObjectRef.current, cat);
    sceneRef.current.add(modelObjectRef.current);

    const box = new THREE.Box3().setFromObject(modelObjectRef.current);
    const center = new THREE.Vector3();
    box.getCenter(center);
    orbitRef.current.target.copy(center);
    orbitRef.current.update();

    syncFormFields();
    setConfirmReady(true);
    setAnalyzing(false);
  }, [applyHeuristics, syncFormFields]);

  // ── Load model to 3D preview ──────────────────────────────────────────────
  const loadModelToPreview = useCallback(async (file, mtl, textures) => {
    const scene = sceneRef.current;

    if (modelObjectRef.current) {
      scene.remove(modelObjectRef.current);
      modelObjectRef.current = null;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    is3DModeRef.current = ['glb', 'gltf', 'obj'].includes(ext);
    if (!is3DModeRef.current) return;

    setAnalyzing(true);
    setConfirmReady(false);

    try {
      if (ext === 'glb' || ext === 'gltf') {
        const loader = new GLTFLoader();
        const url = URL.createObjectURL(file);
        const gltf = await loader.loadAsync(url);
        modelObjectRef.current = gltf.scene;
        URL.revokeObjectURL(url);
      } else if (ext === 'obj') {
        const objUrl = URL.createObjectURL(file);
        let materials = null;
        if (mtl && mtl.size > 0) {
          const mtlLoader = new MTLLoader();
          const manager = new THREE.LoadingManager();
          manager.setURLModifier((url) => {
            const filename = url.split('/').pop().split('\\').pop();
            const matched = Array.from(textures).find(f => f.name === filename);
            if (matched) return URL.createObjectURL(matched);
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4//8/AAX+Av7czFnnAAAAAElFTkSuQmCC';
          });
          mtlLoader.manager = manager;
          const mtlUrl = URL.createObjectURL(mtl);
          materials = await mtlLoader.loadAsync(mtlUrl);
          materials.preload();
          URL.revokeObjectURL(mtlUrl);
        }
        const objLoader = new OBJLoader();
        if (materials) objLoader.setMaterials(materials);
        modelObjectRef.current = await objLoader.loadAsync(objUrl);
        URL.revokeObjectURL(objUrl);

        // Apply manually provided textures
        const texMap = {};
        for (const tf of textures) {
          const url = URL.createObjectURL(tf);
          const tex = await new THREE.TextureLoader().loadAsync(url);
          const nm = tf.name.toLowerCase();
          if (nm.includes('normal')) { tex.colorSpace = THREE.NoColorSpace; texMap.normalMap = tex; }
          else if (nm.includes('rough') || nm.includes('gloss')) { tex.colorSpace = THREE.NoColorSpace; texMap.roughnessMap = tex; }
          else if (nm.includes('metal')) { tex.colorSpace = THREE.NoColorSpace; texMap.metalnessMap = tex; }
          else { tex.colorSpace = THREE.SRGBColorSpace; texMap.map = tex; }
        }

        modelObjectRef.current.traverse(child => {
          if (child.isMesh && child.material) {
            const upgrade = old => new THREE.MeshStandardMaterial({
              name: old.name || 'Material',
              color: materials ? (old.color || new THREE.Color(1, 1, 1)) : new THREE.Color(1, 1, 1),
              side: THREE.DoubleSide,
              transparent: old.transparent || false,
              opacity: old.opacity !== undefined ? old.opacity : 1,
              roughness: 0.4,
              metalness: 0.1,
              map: texMap.map || old.map || null,
              normalMap: texMap.normalMap || old.normalMap || null,
              roughnessMap: texMap.roughnessMap || old.roughnessMap || null,
              metalnessMap: texMap.metalnessMap || old.metalnessMap || null,
            });
            child.material = Array.isArray(child.material)
              ? child.material.map(upgrade)
              : upgrade(child.material);
          }
        });
      }

      await simulateAnalysis(category);
    } catch (err) {
      console.error(err);
      showToast('Failed to load model: ' + err.message, 'error');
      setAnalyzing(false);
    }
  }, [category, simulateAnalysis, showToast]);

  // ── Export current model as GLB + auto thumbnail ──────────────────────────
  const exportCurrentModel = useCallback(async (cat) => {
    return new Promise(async (resolve, reject) => {
      try {
        const newRoot = new THREE.Group();
        const meshes = [];
        modelObjectRef.current.traverse(child => { if (child.isMesh) meshes.push(child); });
        modelObjectRef.current.updateMatrixWorld(true);

        meshes.forEach(child => {
          const geom = child.geometry.clone();
          geom.applyMatrix4(child.matrixWorld);
          if (geom.attributes.normal) geom.normalizeNormals();
          newRoot.add(new THREE.Mesh(geom, child.material));
        });

        const exportScene = new THREE.Scene();
        exportScene.add(newRoot);

        // Thumbnail render
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(0xe0e0e0);
        const envLight = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }));
        envScene.add(envLight);
        const pmremGen = new THREE.PMREMGenerator(renderer);
        exportScene.environment = pmremGen.fromScene(envScene).texture;
        exportScene.add(new THREE.AmbientLight(0xffffff, 1.5));
        const dl = new THREE.DirectionalLight(0xffffff, 2);
        dl.position.set(2, 3, 4);
        exportScene.add(dl);

        const thumbCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
        const box = new THREE.Box3().setFromObject(newRoot);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        let cZ = Math.abs(maxDim / 2 / Math.tan(thumbCamera.fov * (Math.PI / 180) / 2)) * 1.5 || 3;
        if (['rings', 'bracelets', 'watch'].includes(cat)) {
          thumbCamera.position.set(0, cZ * 0.5, cZ);
        } else {
          thumbCamera.position.set(0, 0, cZ);
        }
        thumbCamera.lookAt(0, 0, 0);
        renderer.render(exportScene, thumbCamera);
        const thumbnailBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));

        const exporter = new GLTFExporter();
        exporter.parse(
          exportScene,
          glb => resolve({ glbBlob: new Blob([glb], { type: 'application/octet-stream' }), thumbnailBlob }),
          err => reject(new Error('GLTFExporter failed: ' + err)),
          { binary: true }
        );
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  // ── Generate Thumbnail Preview ──────────────────────────────────────────────
  const generateThumbPreview = useCallback(async () => {
    if (!modelObjectRef.current) return;
    try {
      const newRoot = new THREE.Group();
      const meshes = [];
      modelObjectRef.current.traverse(child => { if (child.isMesh) meshes.push(child); });
      modelObjectRef.current.updateMatrixWorld(true);

      meshes.forEach(child => {
        const geom = child.geometry.clone();
        geom.applyMatrix4(child.matrixWorld);
        if (geom.attributes.normal) geom.normalizeNormals();
        newRoot.add(new THREE.Mesh(geom, child.material));
      });

      const exportScene = new THREE.Scene();
      exportScene.add(newRoot);

      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0xe0e0e0);
      const envLight = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }));
      envScene.add(envLight);
      const pmremGen = new THREE.PMREMGenerator(renderer);
      exportScene.environment = pmremGen.fromScene(envScene).texture;
      exportScene.add(new THREE.AmbientLight(0xffffff, 1.5));
      const dl = new THREE.DirectionalLight(0xffffff, 2);
      dl.position.set(2, 3, 4);
      exportScene.add(dl);

      const thumbCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
      const box = new THREE.Box3().setFromObject(newRoot);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      let cZ = Math.abs(maxDim / 2 / Math.tan(thumbCamera.fov * (Math.PI / 180) / 2)) * 1.5 || 3;
      if (['rings', 'bracelets', 'watch'].includes(category)) {
        thumbCamera.position.set(0, cZ * 0.5, cZ);
      } else {
        thumbCamera.position.set(0, 0, cZ);
      }
      thumbCamera.lookAt(0, 0, 0);
      renderer.render(exportScene, thumbCamera);
      
      setThumbPreviewUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error(e);
      showToast('Failed to generate preview', 'error');
    }
  }, [category, showToast]);

  // ── Perform actual upload (same logic as MVC) ─────────────────────────────
  const performUpload = useCallback(async () => {
    setUploading(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 5, 85));
    }, 150);

    try {
      const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });

      const payload = {
        name,
        category,
        parentCategoryId: parentCategoryId || null,
        parentCategory: selectedParent?.label || '',
        childCategoryId: childCategoryId || null,
        childCategory: selectedChild?.label || '',
        material: materialTag ? materialTag.toLowerCase() : '',
        scale: [scaleX, scaleY, scaleZ],
        offset: [offsetX, offsetY, offsetZ],
        rotationOffset: [rotX, rotY, rotZ]
      };

      if (is3DModeRef.current && modelObjectRef.current) {
        // 3D pipeline: export baked GLB + auto thumbnail
        const { glbBlob, thumbnailBlob } = await exportCurrentModel(category);
        payload.modelFile = await toBase64(glbBlob);
        payload.modelFileName = 'model.glb';
        
        if (thumbFile && thumbFile.size > 0) {
          payload.thumbnailFile = await toBase64(thumbFile);
          payload.thumbnailFileName = thumbFile.name;
        } else {
          payload.thumbnailFile = await toBase64(thumbnailBlob);
          payload.thumbnailFileName = 'thumbnail.png';
        }
        
        // Baked — reset transforms to identity
        payload.scale = [1, 1, 1];
        payload.offset = [0, 0, 0];
        payload.rotationOffset = [0, 0, 0];
      } else {
        // PNG / direct upload
        payload.modelFile = await toBase64(modelFile);
        payload.modelFileName = modelFile.name;
        
        if (thumbFile) {
          payload.thumbnailFile = await toBase64(thumbFile);
          payload.thumbnailFileName = thumbFile.name;
        }
      }

      const resp = await fetch('/api/mock-upload', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();

      clearInterval(interval);
      setProgress(100);

      if (data.success) {
        showToast('✓ ' + data.message, 'success');
        setTimeout(() => {
          setShowModal(false);
          navigate('/admin/models');
        }, 1200);
      } else {
        showToast('✗ ' + data.message, 'error');
      }
    } catch (err) {
      clearInterval(interval);
      showToast('✗ Pipeline failed: ' + err.message, 'error');
    } finally {
      setTimeout(() => { setUploading(false); setProgress(0); }, 1500);
    }
  }, [name, category, parentCategoryId, childCategoryId, selectedParent, selectedChild, modelFile, mtlFile, textureFiles, thumbFile, scaleX, scaleY, scaleZ, offsetX, offsetY, offsetZ, rotX, rotY, rotZ, exportCurrentModel, showToast, navigate]);

  // ── "Continue to Alignment" button ────────────────────────────────────────
  const handleContinue = useCallback(async () => {
    if (!name.trim()) { showToast('Please enter a model name.', 'error'); return; }
    if (!parentCategoryId) { showToast('Please select a Parent Category.', 'error'); return; }
    if (childOptions.length > 0 && !childCategoryId) { showToast('Please select a Child Category.', 'error'); return; }
    if (!modelFile)   { showToast('Please select a 3D model file first.', 'error'); return; }

    const ext = modelFile.name.split('.').pop().toLowerCase();
    is3DModeRef.current = ['glb', 'gltf', 'obj'].includes(ext);

    if (is3DModeRef.current) {
      setShowModal(true);
      // Delay so modal canvas mounts before init
      setTimeout(async () => {
        await initPreview();
        await loadModelToPreview(modelFile, mtlFile, textureFiles);
      }, 100);
    } else {
      // PNG — direct upload without 3D preview
      await performUpload();
    }
  }, [name, parentCategoryId, childCategoryId, childOptions, modelFile, mtlFile, textureFiles, initPreview, loadModelToPreview, performUpload, showToast]);

  // ── Modal confirm ──────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!name.trim()) { showToast('Model name is required.', 'error'); return; }
    if (!parentCategoryId) { showToast('Please select a Parent Category.', 'error'); return; }
    if (childOptions.length > 0 && !childCategoryId) { showToast('Please select a Child Category.', 'error'); return; }
    await performUpload();
  }, [name, parentCategoryId, childCategoryId, childOptions, performUpload, showToast]);

  // ── Modal cancel ──────────────────────────────────────────────────────────
  const handleCancelModal = useCallback(() => {
    setShowModal(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (modelObjectRef.current && sceneRef.current) {
      sceneRef.current.remove(modelObjectRef.current);
      modelObjectRef.current = null;
    }
    if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
    sceneRef.current = null; cameraRef.current = null; orbitRef.current = null;
  }, []);

  // ── Preview toolbar buttons ────────────────────────────────────────────────
  const handleAutoCenter = () => {
    const obj = modelObjectRef.current;
    if (!obj) return;
    const { THREE } = threeRef.current;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    obj.position.sub(center);
    syncFormFields();
  };

  const handleScaleTo1 = () => {
    const obj = modelObjectRef.current;
    if (!obj) return;
    const { THREE } = threeRef.current;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) { obj.scale.multiplyScalar(1.0 / maxDim); syncFormFields(); }
  };

  const handleMirrorX = () => {
    const obj = modelObjectRef.current;
    if (!obj) return;
    const { THREE } = threeRef.current;
    obj.scale.x *= -1;
    obj.traverse(child => {
      if (child.isMesh && child.material) {
        const fix = m => { m.side = THREE.DoubleSide; };
        Array.isArray(child.material) ? child.material.forEach(fix) : fix(child.material);
      }
    });
    syncFormFields();
  };

  const handleFlipZ = () => {
    const obj = modelObjectRef.current;
    if (!obj) return;
    const { THREE } = threeRef.current;
    obj.scale.z *= -1;
    obj.traverse(child => {
      if (child.isMesh && child.material) {
        const fix = m => { m.side = THREE.DoubleSide; };
        Array.isArray(child.material) ? child.material.forEach(fix) : fix(child.material);
      }
    });
    syncFormFields();
  };

  // ── Drag & drop handlers ──────────────────────────────────────────────────
  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (['glb', 'gltf', 'obj', 'png'].includes(ext)) {
        setModelFile(file);
      } else {
        showToast('Only .glb, .gltf, .obj, .png files are accepted.', 'error');
      }
    }
  };

  const handleLogout = () => { sessionStorage.removeItem('sa_auth'); navigate('/admin'); };

  // ── GROUPS for analysis checklist rendering ────────────────────────────────
  const analysisGroup = ANALYSIS_CHECKS.filter(c => c.group === 'Analysis');
  const correctionGroup = ANALYSIS_CHECKS.filter(c => c.group === 'Auto Correction');

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="admin-layout">
      <Sidebar
        activeNav="upload"
        categories={categories}
        activeCategory={null}
        modelCounts={modelCounts}
        onCategorySelect={cat => { setSidebarOpen(false); navigate(`/admin/models/${cat}`); }}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="admin-main">
        {/* Top Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-mobile-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            <h2 className="admin-page-title">Upload New Jewelry Model</h2>
          </div>
        </header>

        {/* Upload Card */}
        <div className="upload-page-body">
          <div className="upload-card-react">
            {/* ── Drag-Drop Zone ── */}
            <div
              id="glbDropZone"
              className={`drop-zone-react ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('glbInputReact').click()}
            >
              <input
                type="file"
                id="glbInputReact"
                accept=".glb,.gltf,.obj,.png"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) setModelFile(e.target.files[0]); }}
              />
              <div className="drop-icon-react">📦</div>
              <p><strong>Drop your 3D/2D model here</strong> or click to browse</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>
                Accepted: .glb, .gltf, .obj, .png (max 100 MB)
              </p>
              {modelFile && (
                <div className="drop-filename-react">✓ {modelFile.name}</div>
              )}
            </div>

            {/* ── Form Fields ── */}
            <div className="upload-form-grid">
              <div className="upload-form-group">
                <label htmlFor="upload-name">Model Name *</label>
                <input
                  id="upload-name"
                  type="text"
                  placeholder="e.g. Diamond Necklace 1"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="upload-form-group">
                <label htmlFor="upload-parent-category">Parent Category *</label>
                <select id="upload-parent-category" value={parentCategoryId} onChange={e => handleParentChange(e.target.value)}>
                  <option value="">Select Parent Category…</option>
                  {menuTree.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>

              <div className="upload-form-group">
                <label htmlFor="upload-child-category">Child Category {childOptions.length > 0 ? '*' : ''}</label>
                <select
                  id="upload-child-category"
                  value={childCategoryId}
                  onChange={e => handleChildChange(e.target.value)}
                  disabled={!selectedParent || childOptions.length === 0}
                >
                  <option value="">{childOptions.length ? 'Select Child Category…' : '(No sub-categories)'}</option>
                  {childOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div className="upload-form-group">
                <label htmlFor="upload-category">Category * <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(auto-set from Child Category)</span></label>
                <select id="upload-category" value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className="upload-form-group">
                <label htmlFor="upload-material">Material Tag (Optional)</label>
                <select id="upload-material" value={materialTag} onChange={e => setMaterialTag(e.target.value)}>
                  <option value="">(None)</option>
                  <option value="Gold">Gold</option>
                  <option value="Diamond">Diamond</option>
                  <option value="Others">Others</option>
                </select>
              </div>


              <div className="upload-form-group upload-form-full">
                <label>Material File (.mtl) <span style={{ color: 'rgba(255,255,255,0.35)' }}>(optional, for .obj models)</span></label>
                <input type="file" accept=".mtl" onChange={e => setMtlFile(e.target.files[0] || null)} />
                <div className="upload-hint">Upload the .mtl file for your .obj model.</div>
              </div>

              <div className="upload-form-group upload-form-full">
                <label>Texture Map(s) <span style={{ color: 'rgba(255,255,255,0.35)' }}>(optional, for .obj models)</span></label>
                <input type="file" accept=".png,.jpg,.jpeg,.webp" multiple onChange={e => setTextureFiles(Array.from(e.target.files))} />
                <div className="upload-hint">Upload one or more texture images. Ensure filenames match what the .mtl expects.</div>
              </div>

              <div className="upload-form-group upload-form-full">
                <label>Thumbnail Image <span style={{ color: 'rgba(255,255,255,0.35)' }}>(optional)</span></label>
                <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={e => setThumbFile(e.target.files[0] || null)} />
                <div className="upload-hint">If not provided, a thumbnail will be auto-generated.</div>
              </div>
            </div>

            {/* ── Advanced AR Settings ── */}
            <details className="upload-advanced">
              <summary>⚙ Advanced AR Settings (Rotation, Scale &amp; Offset)</summary>
              <div className="upload-advanced-body">
                <div className="upload-grid-three">
                  <div className="upload-form-group">
                    <label>Scale X</label>
                    <input type="number" value={scaleX} step="any" min="0.0001" onChange={e => setScaleX(+e.target.value)} />
                  </div>
                  <div className="upload-form-group">
                    <label>Scale Y</label>
                    <input type="number" value={scaleY} step="any" min="0.0001" onChange={e => setScaleY(+e.target.value)} />
                  </div>
                  <div className="upload-form-group">
                    <label>Scale Z</label>
                    <input type="number" value={scaleZ} step="any" min="0.0001" onChange={e => setScaleZ(+e.target.value)} />
                  </div>
                </div>
                <div className="upload-grid-three">
                  <div className="upload-form-group">
                    <label>Rotation X (deg)</label>
                    <input type="number" value={rotX} step="any" onChange={e => setRotX(+e.target.value)} />
                  </div>
                  <div className="upload-form-group">
                    <label>Rotation Y (deg)</label>
                    <input type="number" value={rotY} step="any" onChange={e => setRotY(+e.target.value)} />
                  </div>
                  <div className="upload-form-group">
                    <label>Rotation Z (deg)</label>
                    <input type="number" value={rotZ} step="any" onChange={e => setRotZ(+e.target.value)} />
                  </div>
                </div>
                <div className="upload-grid-three">
                  <div className="upload-form-group">
                    <label>Offset X</label>
                    <input type="number" value={offsetX} step="any" onChange={e => setOffsetX(+e.target.value)} />
                  </div>
                  <div className="upload-form-group">
                    <label>Offset Y</label>
                    <input type="number" value={offsetY} step="any" onChange={e => setOffsetY(+e.target.value)} />
                  </div>
                  <div className="upload-form-group">
                    <label>Offset Z</label>
                    <input type="number" value={offsetZ} step="any" onChange={e => setOffsetZ(+e.target.value)} />
                  </div>
                </div>
              </div>
            </details>

            {/* ── Progress Bar (for PNG uploads) ── */}
            {uploading && (
              <div className="upload-progress-bar-wrap">
                <div className="upload-progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            )}

            <button
              id="upload-continue-btn"
              className="upload-btn-primary"
              onClick={handleContinue}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Continue to Alignment →'}
            </button>
          </div>
        </div>
      </main>

      {/* ── 3D Preview Modal (exact replica of MVC modal) ── */}
      {showModal && (
        <div className="upload-modal-overlay active">
          <div className="upload-modal-content">
            {/* LEFT PANEL */}
            <div className="upload-modal-left">
              <div className="upload-modal-section-header">
                <h3>Model Settings</h3>
                <span>Set name and category before saving.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="upload-form-group">
                  <label>Model Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Diamond Necklace 1" required />
                </div>
                <div className="upload-form-group">
                  <label>Parent Category *</label>
                  <select value={parentCategoryId} onChange={e => handleParentChange(e.target.value)}>
                    <option value="">Select Parent Category…</option>
                    {menuTree.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div className="upload-form-group">
                  <label>Child Category {childOptions.length > 0 ? '*' : ''}</label>
                  <select
                    value={childCategoryId}
                    onChange={e => handleChildChange(e.target.value)}
                    disabled={!selectedParent || childOptions.length === 0}
                  >
                    <option value="">{childOptions.length ? 'Select Child Category…' : '(No sub-categories)'}</option>
                    {childOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="upload-form-group">
                  <label>Category * <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(auto)</span></label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="upload-form-group">
                  <label>Material Tag (Optional)</label>
                  <select value={materialTag} onChange={e => setMaterialTag(e.target.value)}>
                    <option value="">(None)</option>
                    <option value="Gold">Gold</option>
                    <option value="Diamond">Diamond</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="upload-modal-section-header" style={{ marginTop: '16px' }}>
                <h3>Automated Pipeline</h3>
                <span>Preprocessing 3D Model</span>
              </div>

              <div className="upload-checklist">
                <div className="upload-checklist-group-label">Analysis</div>
                {analysisGroup.map(({ id, label }) => (
                  <div key={id} className={`upload-chk-item ${checks[id] ? 'done' : ''}`}>
                    <span className="chk-icon">{checks[id] ? '✔️' : '⏳'}</span>
                    {label}
                  </div>
                ))}
                <div className="upload-checklist-group-label" style={{ marginTop: '10px' }}>Auto Correction</div>
                {correctionGroup.map(({ id, label }) => (
                  <div key={id} className={`upload-chk-item ${checks[id] ? 'done' : ''}`}>
                    <span className="chk-icon">{checks[id] ? '✔️' : '⏳'}</span>
                    {label}
                  </div>
                ))}
              </div>

              <div className="upload-modal-section-header" style={{ marginTop: '16px' }}>
                <h3>Rotation Adjustments</h3>
                <span>Fine-tune model rotation in degrees.</span>
              </div>

              {[
                { label: 'Rot X', val: rotX, set: setRotX, axis: 'x' },
                { label: 'Rot Y', val: rotY, set: setRotY, axis: 'y' },
                { label: 'Rot Z', val: rotZ, set: setRotZ, axis: 'z' },
              ].map(({ label, val, set, axis }) => {
                const applyRotation = (newVal) => {
                  set(newVal);
                  const obj = modelObjectRef.current;
                  if (!obj) return;
                  const newX = axis === 'x' ? newVal : rotX;
                  const newY = axis === 'y' ? newVal : rotY;
                  const newZ = axis === 'z' ? newVal : rotZ;
                  obj.rotation.set(
                    THREE.MathUtils.degToRad(newX),
                    THREE.MathUtils.degToRad(newY),
                    THREE.MathUtils.degToRad(newZ),
                  );
                };
                return (
                  <div key={label} className="upload-rot-row">
                    <label style={{ width: '45px', margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{label}</label>
                    <input
                      type="range"
                      min="-180" max="180" step="1"
                      value={val}
                      onChange={e => applyRotation(+e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      value={val}
                      step="any"
                      onChange={e => applyRotation(+e.target.value)}
                      style={{ width: '65px', padding: '6px', fontSize: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }}
                    />
                  </div>
                );
              })}

            </div>

            {/* RIGHT PANEL */}
            <div className="upload-modal-right">
              <div className="upload-modal-section-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <h3>Align &amp; Confirm Model</h3>
                <span>Confirm scale, rotation, and alignment.</span>
              </div>

              <div className="upload-preview-container" style={{ position: 'relative' }}>
                <canvas ref={canvasRef} className="upload-preview-canvas" />

                {thumbPreviewUrl && (
                  <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 10, background: 'rgba(0,0,0,0.8)', border: '1px solid #fff', borderRadius: '4px', padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#fff', marginBottom: '4px' }}>Thumbnail Preview</span>
                    <img src={thumbPreviewUrl} alt="Thumbnail Preview" style={{ width: '80px', height: '80px', background: '#e0e0e0' }} />
                    <button onClick={() => setThumbPreviewUrl(null)} style={{ position: 'absolute', top: -8, right: -8, background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px' }}>✕</button>
                  </div>
                )}

                {/* Left Toolbar */}
                <div className="upload-toolbar-left">
                  {[
                    { label: 'Toggle Wireframe', action: () => {
                      if (!modelObjectRef.current) return;
                      modelObjectRef.current.traverse(c => {
                        if (c.isMesh && c.material) {
                          const toggle = m => { m.wireframe = !m.wireframe; };
                          Array.isArray(c.material) ? c.material.forEach(toggle) : toggle(c.material);
                        }
                      });
                    }},
                    { label: 'Toggle Reference', action: () => {
                      if (!sceneRef.current) return;
                      const scene = sceneRef.current;
                      if (dummyObjectRef.current) {
                        scene.remove(dummyObjectRef.current);
                        dummyObjectRef.current.geometry?.dispose();
                        dummyObjectRef.current.material?.dispose();
                        dummyObjectRef.current = null;
                        return;
                      }
                      
                      let geom;
                      if (['rings', 'bracelets', 'watch'].includes(category)) {
                        const radius = category === 'rings' ? 0.35 : 0.8;
                        geom = new THREE.CylinderGeometry(radius, radius, 4, 32);
                        geom.rotateX(Math.PI / 2); 
                      } else if (category === 'necklace') {
                        geom = new THREE.CylinderGeometry(0.8, 1.4, 3, 32);
                        geom.translate(0, -1.5, 0); 
                      } else if (category === 'eyewear') {
                        geom = new THREE.SphereGeometry(1.2, 32, 32);
                      } else {
                        geom = new THREE.SphereGeometry(1.0, 32, 32);
                      }
                      const mat = new THREE.MeshBasicMaterial({ color: 0x00aaff, wireframe: true, transparent: true, opacity: 0.4 });
                      const mesh = new THREE.Mesh(geom, mat);
                      scene.add(mesh);
                      dummyObjectRef.current = mesh;
                    }},
                    { label: 'Preview Thumbnail', action: generateThumbPreview },
                  ].map(({ label, action }) => (
                    <button key={label} className="upload-toolbar-btn" onClick={action}>{label}</button>
                  ))}
                </div>

                {/* Right Toolbar removed */}

                <div className="upload-preview-hint">
                  Interactive Preview (Drag to rotate, Scroll to zoom)<br />
                  <span style={{ color: '#77aaff' }}>Blue = FRONT (Z+)</span>{' '}|{' '}
                  <span style={{ color: '#77ff77' }}>Green = UP (Y+)</span>{' '}|{' '}
                  <span style={{ color: '#ff7777' }}>Red = RIGHT (X+)</span>
                </div>
              </div>

              {uploading && (
                <div className="upload-progress-bar-wrap">
                  <div className="upload-progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
              )}

              <div className="upload-modal-actions">
                <button
                  className="upload-btn-cancel"
                  onClick={handleCancelModal}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  id="upload-confirm-btn"
                  className="upload-btn-confirm"
                  onClick={handleConfirm}
                  disabled={!confirmReady || uploading || analyzing}
                >
                  {analyzing ? 'Analyzing…' : uploading ? 'Baking & Uploading…' : 'Confirm Alignment & Upload →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <div id="upload-toast" className={`upload-toast ${toast.show ? 'show' : ''} ${toast.type}`}>
        {toast.msg}
      </div>
    </div>
  );
}
