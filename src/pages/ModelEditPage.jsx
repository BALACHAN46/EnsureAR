import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getModelConfig, saveModelConfig, resetModelConfig, hasCustomConfig } from '../utils/modelConfig';

const SLIDER_CONFIG = [
  {
    key: 'posX',
    label: 'Pos X (Left / Right)',
    min: -5,
    max: 5,
    step: 0.01,
    unit: '',
    format: v => v.toFixed(2),
    color: '#3b82f6',
  },
  {
    key: 'posY',
    label: 'Pos Y (Up / Down)',
    min: -5,
    max: 5,
    step: 0.01,
    unit: '',
    format: v => v.toFixed(2),
    color: '#6366f1',
  },
  {
    key: 'posZ',
    label: 'Pos Z (Forward / Back)',
    min: -10,
    max: 10,
    step: 0.01,
    unit: '',
    format: v => v.toFixed(2),
    color: '#8b5cf6',
  },
  {
    key: 'rotX',
    label: 'Rot X (Pitch / Tilt)',
    min: -3.14159,
    max: 3.14159,
    step: 0.01,
    unit: '°',
    format: v => (v * (180 / Math.PI)).toFixed(0),
    color: '#ec4899',
  },
  {
    key: 'rotY',
    label: 'Rot Y (Yaw / Turn)',
    min: -3.14159,
    max: 3.14159,
    step: 0.01,
    unit: '°',
    format: v => (v * (180 / Math.PI)).toFixed(0),
    color: '#f59e0b',
  },
  {
    key: 'rotZ',
    label: 'Rot Z (Roll / Upside Down)',
    min: -3.14159,
    max: 3.14159,
    step: 0.01,
    unit: '°',
    format: v => (v * (180 / Math.PI)).toFixed(0),
    color: '#10b981',
  },
  {
    key: 'scale',
    label: 'Scale (Size)',
    min: 0.1,
    max: 5,
    step: 0.01,
    unit: 'x',
    format: v => parseFloat(v).toFixed(2),
    color: '#06b6d4',
  },
];

export default function ModelEditPage() {
  const navigate = useNavigate();
  const routeParams = useParams();
  const modelId = routeParams?.id;

  const [model, setModel] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [config, setConfig] = useState({ posX: 0, posY: 0, posZ: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1, enableSparkles: false });
  const [originalDefaults, setOriginalDefaults] = useState(null);
  const [saved, setSaved] = useState(false);
  const [isCustomized, setIsCustomized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (sessionStorage.getItem('sa_auth') !== 'true') {
      navigate('/admin');
      return;
    }
  }, []);

  // Load model info + defaults
  useEffect(() => {
    if (!modelId) return;

    Promise.all([
      fetch('/models/catalog.json').then(r => r.json()),
      fetch('/models/model-defaults.json').then(r => r.json()),
    ]).then(([catalogData, defaultsData]) => {
      const found = catalogData.models?.find(m => m.id === modelId);
      setModel(found || null);

      const defs = defaultsData.modelDefaults || {};
      setDefaults(defs);

      const jsonDefault = defs[modelId] || { posX: 0, posY: 0, posZ: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };
      setOriginalDefaults(jsonDefault);

      // Load current config (localStorage override or JSON default)
      const current = getModelConfig(modelId, defs);
      setConfig(current);
      setIsCustomized(hasCustomConfig(modelId));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [modelId]);

  const handleSliderChange = useCallback((key, value) => {
    setConfig(prev => ({ ...prev, [key]: parseFloat(value) }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    saveModelConfig(modelId, config);
    setIsCustomized(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (originalDefaults) {
      resetModelConfig(modelId);
      setConfig({ posX: originalDefaults.posX ?? 0, ...originalDefaults, scale: originalDefaults.scale ?? 1 });
      setIsCustomized(false);
      setSaved(false);
    }
  };

  const handleBack = () => navigate('/admin/models');

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Loading model configuration...</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="admin-loading">
        <p style={{ color: '#ef4444' }}>Model not found.</p>
        <button className="admin-back-btn" onClick={handleBack}>← Back to Models</button>
      </div>
    );
  }

  const canPreview = ['eyewear', 'watch', 'bracelets', 'rings', 'necklace', 'earrings', 'nosepin'].includes(model.category)
  // ['eyewear', 'necklace', 'rings'].includes(model.category);

  return (
    <div className="edit-page">
      {/* Header */}
      <header className="edit-header">
        <button className="edit-back-btn" onClick={handleBack}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Models
        </button>
        <div className="edit-header-title">
          <h1>Model Configuration</h1>
          <p>Adjust tuning parameters for AR rendering</p>
        </div>
        <div className="edit-header-actions">
          {canPreview && (
            <button
              className="edit-preview-btn"
              onClick={() => navigate(`/ar/${model.category}/${model.id}`)}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              Live Preview
            </button>
          )}
        </div>
      </header>

      <div className="edit-body">
        {/* Model Info Panel */}
        <aside className="edit-sidebar">
          <div className="edit-model-card">
            <div className="edit-model-thumb">
              {model.thumbnailPath ? (
                <img src={model.thumbnailPath} alt={model.name} />
              ) : (
                <div className="edit-model-thumb-placeholder">
                  {model.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="edit-model-info">
              <h3>{model.name}</h3>
              <span className="edit-model-category">{model.category}</span>
              <p className="edit-model-id">ID: {model.id}</p>
              {isCustomized ? (
                <div className="edit-status-badge edit-status-badge--custom">
                  <svg viewBox="0 0 12 12" fill="currentColor">
                    <circle cx="6" cy="6" r="6" />
                  </svg>
                  Custom Config Active
                </div>
              ) : (
                <div className="edit-status-badge edit-status-badge--default">
                  <svg viewBox="0 0 12 12" fill="currentColor">
                    <circle cx="6" cy="6" r="6" />
                  </svg>
                  Using Defaults
                </div>
              )}
            </div>
          </div>

          {/* Default Values Reference */}
          <div className="edit-defaults-panel">
            <h4>Default Values</h4>
            {originalDefaults && SLIDER_CONFIG.map(s => (
              <div key={s.key} className="edit-default-row">
                <span>{s.label.split(' (')[0]}</span>
                <span className="edit-default-val">
                  {s.format(originalDefaults[s.key] ?? 0)}{s.unit}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Tuning Panel */}
        <section className="edit-tuning-panel">
          <div className="tuning-panel-header">
            <h2>Model Tuning</h2>
            <p>Drag sliders to adjust model position and rotation in 3D space</p>
          </div>

          <div className="tuning-sliders">
            {SLIDER_CONFIG.map((s, idx) => {
              // Divider before Rot section (idx 3) and Scale section (idx 6)
              const showDivider = idx === 3 || idx === 6;
              const displayVal = `${s.format(config[s.key] ?? 0)}${s.unit}`;
              const percentage = ((config[s.key] - s.min) / (s.max - s.min)) * 100;

              return (
                <React.Fragment key={s.key}>
                  {showDivider && <div className="tuning-divider" />}
                  <div className="tuning-slider-row">
                    <div className="tuning-slider-label">
                      <span className="tuning-slider-dot" style={{ background: s.color }} />
                      <span className="tuning-slider-name">{s.label}</span>
                      <span className="tuning-slider-value" style={{ color: s.color }}>
                        {displayVal}
                      </span>
                    </div>
                    <div className="tuning-slider-wrapper">
                      <input
                        id={`slider-${s.key}`}
                        type="range"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={config[s.key] ?? 0}
                        onChange={e => handleSliderChange(s.key, e.target.value)}
                        className="tuning-slider"
                        style={{ '--slider-color': s.color, '--slider-pct': `${percentage}%` }}
                      />
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div className="tuning-slider-row" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="tuning-slider-label">
              <span className="tuning-slider-dot" style={{ background: '#fbbf24' }} />
              <span className="tuning-slider-name">✨ Sparkling Effect</span>
            </div>
            <input 
              type="checkbox" 
              checked={!!config.enableSparkles} 
              onChange={e => setConfig(prev => ({ ...prev, enableSparkles: e.target.checked }))} 
              style={{ width: '20px', height: '20px', accentColor: '#fbbf24', cursor: 'pointer' }}
            />
          </div>

          <div className="tuning-actions">
            <button
              className="tuning-reset-btn"
              onClick={handleReset}
              title="Reset to default values from model-defaults.json"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Reset to Defaults
            </button>

            <button
              id={`save-config-${modelId}`}
              className={`tuning-save-btn ${saved ? 'saved' : ''}`}
              onClick={handleSave}
            >
              {saved ? (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Configuration Saved!
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                  </svg>
                  Save Configuration
                </>
              )}
            </button>
          </div>

          {canPreview && (
            <div className="tuning-note">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>
                Saved values will automatically be applied when this{' '}
                {model.category === 'eyewear' ? 'eyewear' : model.category === 'necklace' ? 'necklace' : model.category}{' '}
                model is rendered in the AR view.
                Click <strong>Live Preview</strong> above to test in AR.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
