import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import { CATEGORY_ORDER as CATEGORIES, getCategoryMeta } from '../constants/categoryMeta';
import { loadSiteContentConfig, saveSiteContentConfig, DEFAULT_CONFIG } from '../utils/siteContentConfig';

export default function AdminMenuSettingsPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [savedConfigStr, setSavedConfigStr] = useState('');
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    if (sessionStorage.getItem('sa_auth') !== 'true') {
      navigate('/admin');
      return;
    }
    const initial = loadSiteContentConfig();
    if (!initial.virtualTryOnMenu) {
      initial.virtualTryOnMenu = DEFAULT_CONFIG.virtualTryOnMenu;
    }
    setConfig(initial);
    setSavedConfigStr(JSON.stringify(initial));
  }, [navigate]);

  useEffect(() => {
    fetch('/models/catalog.json')
      .then(r => r.json())
      .then(d => { if (d?.models) setCatalog(d.models); })
      .catch(() => {});
  }, []);

  const modelCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = catalog.filter(m => m.category === cat).length;
    return acc;
  }, {});

  const handleLogout = () => {
    sessionStorage.removeItem('sa_auth');
    navigate('/admin');
  };

  const handleSave = () => {
    if (saveSiteContentConfig(config)) {
      setSavedConfigStr(JSON.stringify(config));
    }
  };

  const handleReset = () => {
    if (!window.confirm('Reset menu settings to defaults?')) return;
    const newConfig = { ...config, virtualTryOnMenu: DEFAULT_CONFIG.virtualTryOnMenu };
    setConfig(newConfig);
    if (saveSiteContentConfig(newConfig)) {
      setSavedConfigStr(JSON.stringify(newConfig));
    }
  };

  if (!config) return null;

  const savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;
  const isDirty = savedConfig && JSON.stringify(config.virtualTryOnMenu) !== JSON.stringify(savedConfig.virtualTryOnMenu);

  const setMenu = (newMenu) => setConfig(prev => ({ ...prev, virtualTryOnMenu: newMenu }));

  const addParentItem = () => {
    const newItem = { id: 'menu-' + Date.now(), label: 'New Category', children: [] };
    setMenu([...config.virtualTryOnMenu, newItem]);
  };

  const updateParentItem = (index, label) => {
    const newMenu = [...config.virtualTryOnMenu];
    newMenu[index].label = label;
    setMenu(newMenu);
  };

  const updateParentTarget = (index, targetCategory) => {
    const newMenu = [...config.virtualTryOnMenu];
    newMenu[index].targetCategory = targetCategory;
    setMenu(newMenu);
  };

  const removeParentItem = (index) => {
    if (!window.confirm('Are you sure you want to remove this category and all its sub-categories?')) return;
    const newMenu = [...config.virtualTryOnMenu];
    newMenu.splice(index, 1);
    setMenu(newMenu);
  };

  const addChildItem = (parentIndex) => {
    const newMenu = [...config.virtualTryOnMenu];
    if (!newMenu[parentIndex].children) newMenu[parentIndex].children = [];
    newMenu[parentIndex].children.push({ id: 'sub-' + Date.now(), label: 'New Sub-Category', targetCategory: 'necklace' });
    setMenu(newMenu);
  };

  const updateChildItem = (parentIndex, childIndex, field, value) => {
    const newMenu = [...config.virtualTryOnMenu];
    newMenu[parentIndex].children[childIndex][field] = value;
    setMenu(newMenu);
  };

  const removeChildItem = (parentIndex, childIndex) => {
    const newMenu = [...config.virtualTryOnMenu];
    newMenu[parentIndex].children.splice(childIndex, 1);
    setMenu(newMenu);
  };

  return (
    <div className="admin-layout">
      <Sidebar
        activeNav="menu-settings"
        categories={CATEGORIES}
        activeCategory={null}
        modelCounts={modelCounts}
        onCategorySelect={(cat) => navigate('/admin/models/' + cat)}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-mobile-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            </button>
            <h2 className="admin-page-title">Menu Settings</h2>
            <span className="admin-model-count-badge" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6', borderColor: 'rgba(236,72,153,0.3)' }}>Navigation</span>
          </div>
          <div className="admin-topbar-right">
            {isDirty && (
              <button
                onClick={handleReset}
                style={{ padding: '0.4rem 1rem', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Reset Defaults
              </button>
            )}
            <button
              onClick={handleSave}
              style={{ padding: '0.4rem 1.2rem', borderRadius: 8, background: !isDirty ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: !isDirty ? '1px solid rgba(16,185,129,0.5)' : 'none', color: !isDirty ? '#34d399' : 'white', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {!isDirty ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '3rem' }}>
          <div className="ar-guide-settings-container">
            <div className="ar-guide-settings-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div className="ar-guide-settings-card-title" style={{ marginBottom: 0 }}>
                  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                  Virtual Try-On Menu Configuration
                </div>
                <button onClick={addParentItem} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                  + Add Parent Category
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>Configure the dropdown menu for the "Virtual Try-On" link. You can add parent categories and child sub-categories. If a parent category has no children, you must select a Target AR Category for it to link to.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {config.virtualTryOnMenu.map((parent, pIndex) => (
                  <div key={parent.id} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Parent Category Name</label>
                        <input className="ar-guide-input" value={parent.label} onChange={e => updateParentItem(pIndex, e.target.value)} style={{ padding: '0.5rem' }} />
                      </div>
                      {(!parent.children || parent.children.length === 0) && (
                        <div style={{ flex: 1 }}>
                          <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Target AR Category</label>
                          <select className="ar-guide-input" value={parent.targetCategory || ''} onChange={e => updateParentTarget(pIndex, e.target.value)} style={{ padding: '0.5rem', background: '#1e293b' }}>
                            <option value="">Select a Category...</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryMeta(c).label}</option>)}
                          </select>
                        </div>
                      )}
                      <div style={{ marginTop: '1.2rem' }}>
                        <button onClick={() => removeParentItem(pIndex)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                      </div>
                    </div>

                    <div style={{ marginLeft: '2rem', paddingLeft: '1rem', borderLeft: '2px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>Child Categories</span>
                        <button onClick={() => addChildItem(pIndex)} style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                          + Add Child
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {(!parent.children || parent.children.length === 0) ? (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>No child categories. This parent item will directly link to its target AR category.</div>
                        ) : (
                          parent.children.map((child, cIndex) => (
                            <div key={child.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px' }}>
                              <input 
                                className="ar-guide-input" 
                                value={child.label} 
                                onChange={e => updateChildItem(pIndex, cIndex, 'label', e.target.value)} 
                                style={{ padding: '0.4rem', fontSize: '0.85rem', flex: 1 }} 
                                placeholder="Menu Label"
                              />
                              <select 
                                className="ar-guide-input" 
                                value={child.targetCategory || ''} 
                                onChange={e => updateChildItem(pIndex, cIndex, 'targetCategory', e.target.value)} 
                                style={{ padding: '0.4rem', fontSize: '0.85rem', background: '#1e293b', flex: 1 }}
                              >
                                {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryMeta(c).label}</option>)}
                              </select>
                              <button onClick={() => removeChildItem(pIndex, cIndex)} style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '0.4rem', cursor: 'pointer' }}>
                                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
