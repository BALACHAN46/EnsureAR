import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import { CATEGORY_ORDER as CATEGORIES } from '../constants/categoryMeta';
import { isAuthenticated } from '../utils/auth';
import { logout } from '../services/authApi';
import { getAllProducts } from '../services/productsApi';
import {
  getMenu, createParentCategory, updateParentCategory, deleteParentCategory,
  createChildCategory, updateChildCategory, deleteChildCategory,
} from '../services/categoriesApi';
import ConfirmModal from '../components/admin/ConfirmModal';

const TRACKING_MODES = ['Face', 'Hand'];

function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return base || `category-${Date.now()}`;
}

export default function AdminMenuSettingsPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState('');
  const [confirmState, setConfirmState] = useState({ isOpen: false, message: '', action: null, title: 'Confirm Delete' });

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/admin');
      return;
    }
    setLoading(true);
    getMenu()
      .then(setMenu)
      .catch(err => setError(err.message || 'Could not load the menu.'))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    getAllProducts({ includeInactive: true }).then(setCatalog).catch(() => {});
  }, []);

  const refreshMenu = () => {
    return getMenu()
      .then(setMenu)
      .catch(err => setError(err.message || 'Could not load the menu.'));
  };

  const modelCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = catalog.filter(m => m.category === cat).length;
    return acc;
  }, {});

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  // ── Local edit buffer (so typing doesn't fire a request per keystroke) ──
  const updateLocalParent = (parentId, field, value) => {
    setMenu(prev => prev.map(p => p.parentCategoryId === parentId ? { ...p, [field]: value } : p));
  };
  const updateLocalChild = (parentId, childId, field, value) => {
    setMenu(prev => prev.map(p => p.parentCategoryId !== parentId ? p : {
      ...p,
      children: p.children.map(c => c.childCategoryId === childId ? { ...c, [field]: value } : c),
    }));
  };

  // ── Persisted actions ──────────────────────────────────────────────────
  const runAction = async (action) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    }
    await refreshMenu();
  };

  const addParentItem = () => runAction(() =>
    createParentCategory({ name: 'New Category', displayOrder: menu.length }));

  const saveParent = (parent) => runAction(() =>
    updateParentCategory(parent.parentCategoryId, { name: parent.name, displayOrder: parent.displayOrder, isActive: parent.isActive }));

  const removeParentItem = (parent) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Category',
      message: `Remove "${parent.name}" and all its sub-categories?`,
      action: () => runAction(() => deleteParentCategory(parent.parentCategoryId))
    });
  };

  const addChildItem = (parent) => runAction(() => {
    const nextOrder = parent.children && parent.children.length > 0 
      ? Math.max(...parent.children.map(c => c.displayOrder || 0)) + 1 
      : 0;
    return createChildCategory(parent.parentCategoryId, {
      name: 'New Sub-Category',
      slug: slugify(`${parent.name}-${(parent.children?.length || 0) + 1}`),
      trackingMode: 'Face',
      displayOrder: nextOrder,
    });
  });

  const saveChild = (child) => runAction(() =>
    updateChildCategory(child.childCategoryId, {
      name: child.name,
      slug: child.slug,
      trackingMode: child.trackingMode,
      displayOrder: child.displayOrder,
      isActive: child.isActive,
    }));

  const removeChildItem = (child) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Sub-Category',
      message: `Remove "${child.name}"?`,
      action: () => runAction(() => deleteChildCategory(child.childCategoryId))
    });
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Loading menu...</p>
      </div>
    );
  }

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
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
                Every change here saves immediately. Parent categories with a single sub-category (e.g. <strong>Watches</strong>, <strong>Eyewears</strong>) link directly to their Try-On experience in the site menu. Parent categories with multiple sub-categories (e.g. <strong>Jewellery</strong>) display a dropdown sub-menu.
              </p>
              {error && (
                <p style={{ fontSize: '0.8rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {[...menu].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map((parent) => {
                  const childCount = parent.children?.length || 0;

                  if (childCount <= 1) {
                    // ── Perfectly Styled Single Category Card ──
                    return (
                      <div key={parent.parentCategoryId} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.2)' }}>
                        {/* Top Row: Parent Category Name + Direct Link Badge + Delete */}
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '0.85rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                              <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>Parent Category Name</label>
                              <span style={{ fontSize: '0.68rem', color: '#60a5fa', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '1rem', padding: '0.08rem 0.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                ⚡ Direct Menu Link
                              </span>
                            </div>
                            <input
                              className="ar-guide-input"
                              value={parent.name}
                              onChange={e => {
                                updateLocalParent(parent.parentCategoryId, 'name', e.target.value);
                                if (parent.children?.[0]) {
                                  updateLocalChild(parent.parentCategoryId, parent.children[0].childCategoryId, 'name', e.target.value);
                                }
                              }}
                              onBlur={() => {
                                saveParent(parent);
                                if (parent.children?.[0]) {
                                  saveChild({ ...parent.children[0], name: parent.name });
                                }
                              }}
                              style={{ padding: '0.5rem', fontSize: '0.85rem', borderRadius: '4px', width: '100%' }}
                              placeholder="Parent Category Name"
                            />
                          </div>
                          <button onClick={() => removeParentItem(parent)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '0.45rem 0.85rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                            Delete
                          </button>
                        </div>

                        {/* Sub-row: AR Configuration Parameters */}
                        <div style={{ marginLeft: '1rem', paddingLeft: '1rem', borderLeft: '2px solid rgba(59,130,246,0.25)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 140 }}>
                            <label style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>AR SLUG</label>
                            <input
                              className="ar-guide-input"
                              value={parent.children?.[0]?.slug || ''}
                              onChange={e => {
                                if (parent.children?.[0]) {
                                  updateLocalChild(parent.parentCategoryId, parent.children[0].childCategoryId, 'slug', e.target.value);
                                }
                              }}
                              onBlur={() => {
                                if (parent.children?.[0]) {
                                  saveChild(menu.find(p => p.parentCategoryId === parent.parentCategoryId)?.children?.[0]);
                                }
                              }}
                              style={{ padding: '0 0.6rem', height: '34px', fontSize: '0.85rem', borderRadius: '4px', boxSizing: 'border-box' }}
                              placeholder="ar-slug"
                            />
                          </div>

                          <div style={{ flex: 1, minWidth: 120 }}>
                            <label style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>TRACKING MODE</label>
                            <select
                              className="ar-guide-input"
                              value={parent.children?.[0]?.trackingMode || 'Face'}
                              onChange={e => {
                                if (parent.children?.[0]) {
                                  updateLocalChild(parent.parentCategoryId, parent.children[0].childCategoryId, 'trackingMode', e.target.value);
                                  saveChild({ ...parent.children[0], trackingMode: e.target.value });
                                }
                              }}
                              style={{ padding: '0 0.6rem', height: '34px', fontSize: '0.85rem', background: '#1e293b', borderRadius: '4px', boxSizing: 'border-box' }}
                            >
                              {TRACKING_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>

                          {/* <button onClick={() => addChildItem(parent)} style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', marginTop: 'auto', fontWeight: 600 }}>
                            + Add Child
                          </button> */}
                        </div>
                      </div>
                    );
                  }

                  // ── Dropdown Category with Sub-categories ──
                  return (
                    <div key={parent.parentCategoryId} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1.25rem', background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                            <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>Category Name</label>
                            <span style={{ fontSize: '0.7rem', color: '#c084fc', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '1rem', padding: '0.1rem 0.5rem', fontWeight: 600 }}>📂 Dropdown Submenu ({childCount} items)</span>
                          </div>
                          <input
                            className="ar-guide-input"
                            value={parent.name}
                            onChange={e => updateLocalParent(parent.parentCategoryId, 'name', e.target.value)}
                            onBlur={() => saveParent(parent)}
                            style={{ padding: '0.5rem', borderRadius: '6px' }}
                          />
                        </div>
                        <button onClick={() => removeParentItem(parent)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', marginTop: 'auto' }}>Delete</button>
                      </div>

                      <div style={{ marginLeft: '1.5rem', paddingLeft: '1rem', borderLeft: '2px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>Sub-Categories</span>
                          <button onClick={() => addChildItem(parent)} style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                            + Add Sub-Category
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {[...(parent.children || [])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map((child) => (
                            <div key={child.childCategoryId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px', flexWrap: 'wrap' }}>
                              <input
                                className="ar-guide-input"
                                value={child.name}
                                onChange={e => updateLocalChild(parent.parentCategoryId, child.childCategoryId, 'name', e.target.value)}
                                onBlur={() => saveChild(menu.find(p => p.parentCategoryId === parent.parentCategoryId).children.find(c => c.childCategoryId === child.childCategoryId))}
                                style={{ padding: '0 0.6rem', height: '34px', fontSize: '0.85rem', flex: 2, minWidth: 120, borderRadius: '4px', boxSizing: 'border-box' }}
                                placeholder="Menu Label"
                              />
                              <input
                                className="ar-guide-input"
                                value={child.slug}
                                onChange={e => updateLocalChild(parent.parentCategoryId, child.childCategoryId, 'slug', e.target.value)}
                                onBlur={() => saveChild(menu.find(p => p.parentCategoryId === parent.parentCategoryId).children.find(c => c.childCategoryId === child.childCategoryId))}
                                style={{ padding: '0 0.6rem', height: '34px', fontSize: '0.85rem', flex: 1, minWidth: 100, borderRadius: '4px', boxSizing: 'border-box' }}
                                placeholder="ar-category-slug"
                              />
                              <select
                                className="ar-guide-input"
                                value={child.trackingMode}
                                onChange={e => {
                                  updateLocalChild(parent.parentCategoryId, child.childCategoryId, 'trackingMode', e.target.value);
                                  saveChild({ ...child, trackingMode: e.target.value });
                                }}
                                style={{ padding: '0 0.6rem', height: '34px', fontSize: '0.85rem', background: '#1e293b', flex: 1, minWidth: 90, borderRadius: '4px', boxSizing: 'border-box' }}
                              >
                                {TRACKING_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                              <button onClick={() => removeChildItem(child)} style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '0.4rem', cursor: 'pointer' }}>
                                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={() => {
          if (confirmState.action) confirmState.action();
          setConfirmState({ isOpen: false, message: '', action: null, title: '' });
        }}
        onCancel={() => setConfirmState({ isOpen: false, message: '', action: null, title: '' })}
        confirmText="Delete"
        confirmStyle="danger"
      />
    </div>
  );
}
