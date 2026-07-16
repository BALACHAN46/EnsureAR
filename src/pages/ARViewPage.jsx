import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from '../router';
import FaceTracker from '../FaceTracker';
import HandTracker from '../HandTracker';
import Scene3D from '../Scene3D';
import { getModelConfig, saveModelConfig, resetModelConfig, configToPosition, configToRotation, configToScale } from '../utils/modelConfig';

export default function ARViewPage({ params }) {
  const { navigate } = useRouter();
  const landmarksRef = useRef(null);
  const poseLandmarksRef = useRef(null);
  const videoFrameRef = useRef(null);

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

  const applyModelConfig = (id, defs) => {
    const cfg = getModelConfig(id, defs);
    setModelPos(configToPosition(cfg));
    setModelRot(configToRotation(cfg));
    setModelScale(configToScale(cfg));
  };

  const handleModelSelect = (model) => {
    setActiveModel(model);
    applyModelConfig(model.id, defaults);
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

  return (
    <div className="app-container">

      {/* Top Left Controls */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          className="ar-ctrl-btn"
          onClick={() => {
            if (isAdmin) navigate('/admin/dashboard');
            else navigate('/');
          }}
        >
          ← {isAdmin ? 'Dashboard' : 'Home'}
        </button>
        {/* Face mesh toggle: only relevant for eyewear */}
        {category === 'eyewear' && (
          <button
            className={`ar-ctrl-btn ${showFaceMesh ? 'ar-ctrl-btn--active' : ''}`}
            onClick={() => setShowFaceMesh(p => !p)}
          >
            {showFaceMesh ? 'Hide Mesh' : 'Show Mesh'}
          </button>
        )}
        {isAdmin && (
          <button
            className={`ar-ctrl-btn ${showTuning ? 'ar-ctrl-btn--active' : ''}`}
            onClick={() => setShowTuning(p => !p)}
          >
            ⚙️ Tuning
          </button>
        )}
      </div>

      {/* Hint overlays for jewelry */}
      {category === 'rings' && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          zIndex: 900, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(245,158,11,0.4)', borderRadius: '12px',
          padding: '8px 18px', color: '#fbbf24', fontSize: '13px', fontWeight: 500,
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          💍 Hold your hand up to try the ring — use Tuning to adjust position &amp; size
        </div>
      )}
      {/* {category === 'necklace' && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          zIndex: 900, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(236,72,153,0.4)', borderRadius: '12px',
          padding: '8px 18px', color: '#f9a8d4', fontSize: '13px', fontWeight: 500,
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
        </div>
      )} */}

      {/* Live Tuning Panel (Admin only) */}
      {isAdmin && showTuning && (
        <div className="ar-tuning-panel">
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

      {/* AR Content */}
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

      {/* Bottom Model Carousel */}
      <div className="carousel-container">
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
  );
}
