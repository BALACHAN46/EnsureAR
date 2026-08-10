import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import { orderCategories } from '../constants/categoryMeta';
import { isAuthenticated, getToken } from '../utils/auth';
import { logout } from '../services/authApi';
import { getAllProducts } from '../services/productsApi';
import { apiClient } from '../services/apiClient';

export default function AdminEmailSettingsPage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [modelCounts, setModelCounts] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('admin'); // 'admin' or 'user'
  const [showPassword, setShowPassword] = useState(false);

  const [settings, setSettings] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpMail: '',
    smtpPassword: '',
    smtpEnableSsl: true,
    smtpDisplayName: '',
    receiverEmail: '',
    adminEmailTemplate: '',
    userEmailTemplate: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/admin');
      return;
    }

    const token = getToken();

    const loadSidebarData = async () => {
      try {
        const catalog = await getAllProducts({ includeInactive: true });
        
        // Count models by category
        const counts = {};
        catalog.forEach(item => {
          counts[item.category] = (counts[item.category] || 0) + 1;
        });
        setModelCounts(counts);

        // Sort categories logically
        const presentCats = Object.keys(counts);
        const sortedCats = orderCategories(presentCats);
        setCategories(sortedCats);
      } catch (err) {
        console.error('Error loading sidebar data:', err);
      }
    };

    const loadEmailSettings = async () => {
      try {
        const data = await apiClient.get('/api/v1/admin/email-settings');
        if (data) {
          setSettings({
            smtpHost: data.smtpHost || '',
            smtpPort: data.smtpPort || 587,
            smtpMail: data.smtpMail || '',
            smtpPassword: data.smtpPassword || '',
            smtpEnableSsl: data.smtpEnableSsl ?? true,
            smtpDisplayName: data.smtpDisplayName || '',
            receiverEmail: data.receiverEmail || '',
            adminEmailTemplate: data.adminEmailTemplate || '',
            userEmailTemplate: data.userEmailTemplate || ''
          });
        }
      } catch (err) {
        console.error('Failed to load email settings', err);
      } finally {
        setLoading(false);
      }
    };

    loadSidebarData();
    loadEmailSettings();
  }, [navigate]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setSettings({ ...settings, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    
    try {
      await apiClient.put('/api/v1/admin/email-settings', {
          ...settings,
          smtpPort: parseInt(settings.smtpPort, 10)
      });
      setMessage('Email Settings saved successfully.');
    } catch (err) {
      console.error(err);
      setMessage('Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading Email Settings...</div>;
  }

  return (
    <div className="admin-layout">
      <Sidebar
        activeNav="email-settings"
        categories={categories}
        modelCounts={modelCounts}
        onCategorySelect={(cat) => navigate(`/admin/models/${cat}`)}
        onLogout={logout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-mobile-toggle" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            </button>
            <h2 className="admin-page-title">Email Settings</h2>
            <span className="admin-model-count-badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}>Configuration</span>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '3rem', padding: '1rem' }}>
          <div className="ar-guide-settings-container" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
            
            {message && (
              <div className="settings-alert" style={{ background: message.includes('success') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: message.includes('success') ? '#34d399' : '#f87171', border: `1px solid ${message.includes('success') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, padding: '0.85rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                {message.includes('success') ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" style={{ flexShrink: 0 }}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" style={{ flexShrink: 0 }}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                )}
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                <div className="ar-guide-settings-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="ar-guide-settings-card-title" style={{ fontSize: '1.1rem', color: '#60a5fa' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20, flexShrink: 0 }}><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
                    SMTP Configuration
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>Configure the outgoing mail server used to dispatch emails.</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>Host Server</label>
                        <input type="text" name="smtpHost" value={settings.smtpHost} onChange={handleChange} className="ar-guide-input" placeholder="smtp.gmail.com" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>Port</label>
                        <input type="number" name="smtpPort" value={settings.smtpPort} onChange={handleChange} className="ar-guide-input" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }} />
                      </div>
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>Email Address</label>
                      <input type="email" name="smtpMail" value={settings.smtpMail} onChange={handleChange} className="ar-guide-input" placeholder="noreply@example.com" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }} />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>App Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="smtpPassword"
                          value={settings.smtpPassword}
                          onChange={handleChange}
                          className="ar-guide-input"
                          placeholder="••••••••••••••••"
                          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', paddingRight: '2.5rem', width: '100%' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: showPassword ? '#60a5fa' : '#94a3b8',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>Sender Display Name</label>
                      <input type="text" name="smtpDisplayName" value={settings.smtpDisplayName} onChange={handleChange} className="ar-guide-input" placeholder="EnsureAR" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }} />
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', color: '#f1f5f9', fontSize: '0.85rem', userSelect: 'none' }}>
                        <div style={{ width: '40px', height: '22px', background: settings.smtpEnableSsl ? '#10b981' : 'rgba(255,255,255,0.1)', borderRadius: '11px', position: 'relative', transition: '0.3s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: '2px', left: settings.smtpEnableSsl ? '20px' : '2px', width: '18px', height: '18px', background: 'white', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                          <input type="checkbox" name="smtpEnableSsl" checked={settings.smtpEnableSsl} onChange={handleChange} style={{ opacity: 0, width: 0, height: 0 }} />
                        </div>
                        <span style={{ fontWeight: 500 }}>Enable SSL/TLS Encryption</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="ar-guide-settings-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="ar-guide-settings-card-title" style={{ fontSize: '1.1rem', color: '#f472b6' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20, flexShrink: 0 }}><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                    Enquiry Receiver
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>Designate where notifications for new Try-On enquiries are sent.</p>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>Admin Email (To)</label>
                    <input type="email" name="receiverEmail" value={settings.receiverEmail} onChange={handleChange} className="ar-guide-input" placeholder="info@ensurear.com" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }} />
                  </div>
                  
                  <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(244,114,182,0.05)', border: '1px dashed rgba(244,114,182,0.3)', borderRadius: '0.5rem' }}>
                    <h4 style={{ color: '#f472b6', margin: '0 0 0.5rem 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                      How it works
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                      When a user submits the Contact Us form, an email is dispatched to this receiver email address using the <strong>Admin Template</strong>. 
                      Simultaneously, an acknowledgement email is sent to the user's provided email address using the <strong>User Template</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="ar-guide-settings-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                  <button 
                    type="button"
                    onClick={() => setActiveTab('admin')}
                    style={{ flex: '1 1 200px', padding: '0.85rem 1rem', background: activeTab === 'admin' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'admin' ? '#a78bfa' : '#94a3b8', fontWeight: 600, fontSize: '0.85rem', borderBottom: activeTab === 'admin' ? '2px solid #a78bfa' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                    Admin Notification Template
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveTab('user')}
                    style={{ flex: '1 1 200px', padding: '0.85rem 1rem', background: activeTab === 'user' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'user' ? '#34d399' : '#94a3b8', fontWeight: 600, fontSize: '0.85rem', borderBottom: activeTab === 'user' ? '2px solid #34d399' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                    User Acknowledgement Template
                  </button>
                </div>
                
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>{'{'}{'{'}Name{'}'}{'}'}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>{'{'}{'{'}Email{'}'}{'}'}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>{'{'}{'{'}Subject{'}'}{'}'}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>{'{'}{'{'}Message{'}'}{'}'}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>{'{'}{'{'}Year{'}'}{'}'}</span>
                  </div>

                  {activeTab === 'admin' ? (
                    <textarea 
                      name="adminEmailTemplate" 
                      value={settings.adminEmailTemplate} 
                      onChange={handleChange} 
                      className="ar-guide-input ar-guide-textarea" 
                      style={{ width: '100%', minHeight: '320px', fontFamily: '"Fira Code", monospace', fontSize: '0.8rem', background: '#0f172a', color: '#38bdf8', padding: '0.85rem', lineHeight: '1.5', borderRadius: '8px' }} 
                    />
                  ) : (
                    <textarea 
                      name="userEmailTemplate" 
                      value={settings.userEmailTemplate} 
                      onChange={handleChange} 
                      className="ar-guide-input ar-guide-textarea" 
                      style={{ width: '100%', minHeight: '320px', fontFamily: '"Fira Code", monospace', fontSize: '0.8rem', background: '#0f172a', color: '#34d399', padding: '0.85rem', lineHeight: '1.5', borderRadius: '8px' }} 
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ 
                    padding: '0.65rem 1.5rem', 
                    borderRadius: '0.5rem', 
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
                    border: 'none', 
                    color: 'white', 
                    fontSize: '0.9rem', 
                    fontWeight: 700, 
                    cursor: saving ? 'not-allowed' : 'pointer', 
                    transition: 'all 0.2s', 
                    opacity: saving ? 0.7 : 1,
                    boxShadow: '0 4px 6px rgba(139,92,246,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    width: '100%'
                  }}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin" viewBox="0 0 24 24" fill="none" width="18" height="18" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" style={{ flexShrink: 0 }}><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      <span>Save Configuration</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
