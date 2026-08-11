import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import { loadARGuideConfig, saveARGuideConfig, resetARGuideConfig } from '../utils/arGuideConfig';
import { CATEGORY_META, CATEGORY_ORDER, getCategoryMeta, orderCategories } from '../constants/categoryMeta';
import ARGuideModal, { CATEGORY_GUIDES, FALLBACK_GUIDE } from '../components/ar/ARGuideModal';
import ConfirmModal from '../components/admin/ConfirmModal';
import { isAuthenticated } from '../utils/auth';
import { logout } from '../services/authApi';
import { getAllProducts } from '../services/productsApi';

const EMPTY_GUIDE_CONFIG = { entryModalEnabled: true, helpIconEnabled: true, categoryOverrides: {} };

// Default step titles/descs imported from guide data (mirrors ARGuideModal's CATEGORY_GUIDES)
const DEFAULT_STEP_LABELS = {
  watch: ['Palm Facing Camera', 'Tilt at ~45° Angle', 'Keep Wrist in Frame', 'Good Lighting'],
  bracelets: ['Palm Facing Camera', 'Tilt at ~45° Angle', 'Keep Wrist in Frame', 'Good Lighting'],
  rings: ['Show Back of Hand', 'Fingers Spread', 'Hold Hand Steady', 'Palm or Back'],
  necklace: ['Face the Camera', 'Clear Neckline', 'Keep Still', 'Good Lighting'],
  eyewear: ['Face Camera Straight', 'Adequate Distance', 'Keep Face Visible', 'Good Lighting'],
  earrings: ['Face Camera', 'Hair Pulled Back', 'Try Both Sides', 'Good Lighting'],
  nosepin: ['Face Straight', 'Close-Up View', 'Keep Head Still', 'Good Lighting'],
};

const CATEGORIES = CATEGORY_ORDER.filter(c => CATEGORY_META[c]);

export default function ARGuideSettingsPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) navigate('/admin');
  }, []);

  useEffect(() => {
    getAllProducts({ includeInactive: true })
      .then(models => {
        setCatalog(models);
        setCategories(orderCategories([...new Set(models.map(m => m.category))]));
      })
      .catch(() => { });
  }, []);

  const [config, setConfig] = useState(EMPTY_GUIDE_CONFIG);
  const [savedConfigStr, setSavedConfigStr] = useState(() => JSON.stringify(EMPTY_GUIDE_CONFIG));
  useEffect(() => {
    loadARGuideConfig().then(cfg => {
      setConfig(cfg);
      setSavedConfigStr(JSON.stringify(cfg));
    });
  }, []);
  const isDirty = JSON.stringify(config) !== savedConfigStr;
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState('entry');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmState, setConfirmState] = useState({ isOpen: false, message: '', action: null, title: 'Confirm' });

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const modelCounts = categories.reduce((acc, cat) => {
    acc[cat] = catalog.filter(m => m.category === cat).length;
    return acc;
  }, {});

  // ── Global toggles ──
  const setGlobal = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  // ── Per-category override helpers ──
  const getOverride = (cat) => config.categoryOverrides?.[cat] || {};

  const hasActualOverrides = (cat) => {
    const o = config.categoryOverrides?.[cat];
    if (!o) return false;
    const def = CATEGORY_GUIDES[cat] || FALLBACK_GUIDE;

    // Check main fields
    if (o.title && o.title !== def.title) return true;
    if (o.subtitle && o.subtitle !== def.subtitle) return true;
    if (o.proTip && o.proTip !== def.proTip) return true;

    // Check steps
    if (o.steps) {
      const defSteps = def.steps || [];
      for (let i = 0; i < 4; i++) {
        const step = o.steps[i];
        if (!step) continue;
        const dStep = defSteps[i] || {};
        if (step.title && step.title !== dStep.title) return true;
        if (step.desc && step.desc !== dStep.desc) return true;
      }
    }
    return false;
  };

  const setOverrideField = (cat, field, value) => {
    setConfig(prev => ({
      ...prev,
      categoryOverrides: {
        ...prev.categoryOverrides,
        [cat]: { ...getOverride(cat), [field]: value },
      },
    }));
  };

  const setStepField = (cat, stepIdx, field, value) => {
    const ov = getOverride(cat);
    const steps = ov.steps ? [...ov.steps] : [];
    // Ensure array is long enough
    while (steps.length <= stepIdx) steps.push({});
    steps[stepIdx] = { ...steps[stepIdx], [field]: value };
    setOverrideField(cat, 'steps', steps);
  };

  const handleSave = async () => {
    const ok = await saveARGuideConfig(config);
    if (ok) {
      setSavedConfigStr(JSON.stringify(config));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const handleReset = () => {
    setConfirmState({
      isOpen: true,
      title: 'Reset AR Guides',
      message: 'Reset all AR Guide settings to defaults?',
      action: async () => {
        await resetARGuideConfig();
        const newConfig = await loadARGuideConfig();
        setConfig(newConfig);
        setSavedConfigStr(JSON.stringify(newConfig));
      }
    });
  };

  const catMeta = getCategoryMeta(activeCategory);
  const ov = getOverride(activeCategory);
  const defaultGuide = CATEGORY_GUIDES[activeCategory] || FALLBACK_GUIDE;
  const defaultSteps = defaultGuide.steps || [];

  // Build preview config: merge global config with overrides for current category
  const previewConfig = {
    ...config,
    // ARGuideModal reads overrides internally via the prop — we just pass category
  };

  return (
    <div className="admin-layout">
      <Sidebar
        activeNav="ar-guide"
        categories={categories}
        activeCategory={null}
        modelCounts={modelCounts}
        onCategorySelect={(cat) => navigate(`/admin/models/${cat}`)}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="admin-main">
        {/* Top Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-mobile-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            </button>
            <h2 className="admin-page-title">AR Guide Settings</h2>
            <span className="admin-model-count-badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.3)' }}>Configuration</span>
          </div>
          <div className="admin-topbar-right">
            {isDirty && hasActualOverrides(activeCategory) && (
              <button
                onClick={() => {
                  setConfig(prev => {
                    const overrides = { ...prev.categoryOverrides };
                    delete overrides[activeCategory];
                    return { ...prev, categoryOverrides: overrides };
                  });
                }}
                style={{ padding: '0.4rem 1rem', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                ↩ Clear {catMeta.label} overrides
              </button>
            )}
            <button
              onClick={handleSave}
              style={{ padding: '0.4rem 1.2rem', borderRadius: 8, background: saved ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: saved ? '1px solid rgba(16,185,129,0.5)' : 'none', color: saved ? '#34d399' : 'white', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {saved ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="ar-guide-settings-container">

            {/* ── Global Toggles ── */}
            <div className="ar-guide-settings-card">
              <div className="ar-guide-settings-card-title">
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Global Controls
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>These settings apply to all categories for all users.</p>

              <div className="ar-guide-toggle-row">
                <div className="ar-guide-toggle-info">
                  <div className="ar-guide-toggle-label">Entry-Point Alert Modal</div>
                  <div className="ar-guide-toggle-desc">Show instruction modal every time a user enters a category. If disabled, users go directly into AR.</div>
                </div>
                <label className="ar-guide-switch">
                  <input type="checkbox" checked={config.entryModalEnabled} onChange={e => setGlobal('entryModalEnabled', e.target.checked)} />
                  <span className="ar-guide-switch-track"><span className="ar-guide-switch-thumb" /></span>
                </label>
              </div>

              <div className="ar-guide-toggle-row" style={{ marginTop: '1rem' }}>
                <div className="ar-guide-toggle-info">
                  <div className="ar-guide-toggle-label">Help Icon on Live AR Screen</div>
                  <div className="ar-guide-toggle-desc">Show the floating (?) button on the AR try-on screen. Users can tap it to re-read instructions.</div>
                </div>
                <label className="ar-guide-switch">
                  <input type="checkbox" checked={config.helpIconEnabled} onChange={e => setGlobal('helpIconEnabled', e.target.checked)} />
                  <span className="ar-guide-switch-track"><span className="ar-guide-switch-thumb" /></span>
                </label>
              </div>
            </div>

            {/* ── Per-Category Content Editor ── */}
            <div className="ar-guide-settings-card" style={{ marginTop: '1.25rem' }}>
              <div className="ar-guide-settings-card-title">
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Category Content Editor
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>Customise the guide text shown to users for each category. Leave a field blank to use the default text.</p>

              {/* Category Tabs */}
              <div className="ar-guide-cat-tabs">
                {CATEGORIES.filter(c => categories.includes(c) || CATEGORY_META[c]).map(cat => {
                  const m = getCategoryMeta(cat);
                  // Check if this category has unsaved changes compared to the saved config
                  const savedConf = JSON.parse(savedConfigStr);
                  const currentOv = config.categoryOverrides?.[cat];
                  const savedOv = savedConf.categoryOverrides?.[cat];
                  const hasUnsavedChanges = JSON.stringify(currentOv || {}) !== JSON.stringify(savedOv || {});
                  
                  return (
                    <button
                      key={cat}
                      className={`ar-guide-cat-tab ${activeCategory === cat ? 'active' : ''}`}
                      style={{ '--tab-color': m.color }}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {m.icon ? <img src={m.icon} alt={m.label} style={{ width: 16, height: 16, objectFit: 'contain' }} /> : m.emoji}
                      <span>{m.label}</span>
                      {hasUnsavedChanges && <span className="ar-guide-tab-dot" style={{ background: m.color }} />}
                    </button>
                  );
                })}
              </div>

              {/* Editor for active category */}
              <div className="ar-guide-editor">
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {catMeta.icon
                      ? <img src={catMeta.icon} alt={catMeta.label} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      : <span style={{ fontSize: '1.4rem' }}>{catMeta.emoji}</span>
                    }
                    <span style={{ fontWeight: 700, color: catMeta.color, fontSize: '1rem' }}>{catMeta.label}</span>
                  </div>
                  <button
                    onClick={() => { setPreviewMode('entry'); setPreviewOpen(true); }}
                    style={{ marginLeft: 'auto', padding: '0.35rem 0.9rem', borderRadius: 8, background: `${catMeta.color}20`, border: `1px solid ${catMeta.color}40`, color: catMeta.color, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    👁 Preview Entry Modal
                  </button>
                  <button
                    onClick={() => { setPreviewMode('help'); setPreviewOpen(true); }}
                    style={{ padding: '0.35rem 0.9rem', borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    👁 Preview Help Modal
                  </button>
                </div>

                <div className="ar-guide-field-group">
                  <label className="ar-guide-field-label">Modal Title</label>
                  <input
                    className="ar-guide-input"
                    placeholder={`${catMeta.label} Try-On Guide`}
                    value={ov.title !== undefined ? ov.title : defaultGuide.title}
                    onChange={e => setOverrideField(activeCategory, 'title', e.target.value)}
                  />
                </div>

                <div className="ar-guide-field-group">
                  <label className="ar-guide-field-label">Subtitle</label>
                  <input
                    className="ar-guide-input"
                    placeholder="How to position yourself for best AR accuracy"
                    value={ov.subtitle !== undefined ? ov.subtitle : defaultGuide.subtitle}
                    onChange={e => setOverrideField(activeCategory, 'subtitle', e.target.value)}
                  />
                </div>

                <div className="ar-guide-field-group">
                  <label className="ar-guide-field-label">Pro Tip</label>
                  <textarea
                    className="ar-guide-input ar-guide-textarea"
                    placeholder="Enter a helpful tip for users..."
                    rows={2}
                    value={ov.proTip !== undefined ? ov.proTip : defaultGuide.proTip}
                    onChange={e => setOverrideField(activeCategory, 'proTip', e.target.value)}
                  />
                </div>

                <div style={{ marginTop: '1.25rem', marginBottom: '0.6rem' }}>
                  <div className="ar-guide-field-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: catMeta.color }}>Step Instructions</div>
                  <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Edit the title and description shown for each step. Leave blank to use defaults.</p>
                </div>

                {[0, 1, 2, 3].map(i => {
                  const stepOv = (ov.steps || [])[i] || {};
                  return (
                    <div key={i} className="ar-guide-step-editor">
                      <div className="ar-guide-step-num" style={{ background: catMeta.color }}>{String(i + 1).padStart(2, '0')}</div>
                      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input
                          className="ar-guide-input"
                          placeholder={defaultSteps[i]?.title || `Step ${i + 1} title`}
                          value={stepOv.title !== undefined ? stepOv.title : (defaultSteps[i]?.title || '')}
                          onChange={e => setStepField(activeCategory, i, 'title', e.target.value)}
                        />
                        <textarea
                          className="ar-guide-input ar-guide-textarea"
                          placeholder={defaultSteps[i]?.desc || "Description..."}
                          rows={2}
                          value={stepOv.desc !== undefined ? stepOv.desc : (defaultSteps[i]?.desc || '')}
                          onChange={e => setStepField(activeCategory, i, 'desc', e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Removed clear override button from here */}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      {previewOpen && (
        <ARGuideModal
          isOpen={true}
          category={activeCategory}
          mode={previewMode}
          onAccept={() => setPreviewOpen(false)}
          onClose={() => setPreviewOpen(false)}
          overrides={ov}
        />
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={async () => {
          if (confirmState.action) await confirmState.action();
          setConfirmState({ isOpen: false, message: '', action: null, title: '' });
        }}
        onCancel={() => setConfirmState({ isOpen: false, message: '', action: null, title: '' })}
        confirmText="Reset"
        confirmStyle="danger"
      />
    </div>
  );
}
