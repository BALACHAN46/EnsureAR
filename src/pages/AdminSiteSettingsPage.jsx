import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import { CATEGORY_ORDER as CATEGORIES } from '../constants/categoryMeta';
import { loadSiteContentConfig, saveSiteContentConfig, DEFAULT_CONFIG } from '../utils/siteContentConfig';

export default function AdminSiteSettingsPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [savedConfigStr, setSavedConfigStr] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('sa_auth') !== 'true') {
      navigate('/admin/login');
      return;
    }
    const initial = loadSiteContentConfig();
    setConfig(initial);
    setSavedConfigStr(JSON.stringify(initial));
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('sa_auth');
    navigate('/admin/login');
  };

  const handleSave = () => {
    if (saveSiteContentConfig(config)) {
      setSavedConfigStr(JSON.stringify(config));
    }
  };

  const handleResetSection = (section) => {
    const newConfig = { ...config };
    if (section === 'about') {
      newConfig.aboutEnsureAR = DEFAULT_CONFIG.aboutEnsureAR;
      newConfig.vision = DEFAULT_CONFIG.vision;
      newConfig.mission = DEFAULT_CONFIG.mission;
      newConfig.whyChooseUs = DEFAULT_CONFIG.whyChooseUs;
    } else if (section === 'testimonial') {
      newConfig.testimonial = DEFAULT_CONFIG.testimonial;
    } else if (section === 'contact') {
      newConfig.contact = DEFAULT_CONFIG.contact;
    } else if (section === 'socialMedia') {
      newConfig.socialMedia = DEFAULT_CONFIG.socialMedia;
    }
    setConfig(newConfig);
    if (saveSiteContentConfig(newConfig)) {
      setSavedConfigStr(JSON.stringify(newConfig));
    }
  };

  if (!config) return null;

  const savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;
  const isAboutDirty = savedConfig && (
    JSON.stringify(config.aboutEnsureAR) !== JSON.stringify(savedConfig.aboutEnsureAR) ||
    config.vision !== savedConfig.vision ||
    config.mission !== savedConfig.mission ||
    config.whyChooseUs !== savedConfig.whyChooseUs
  );
  const isTestimonialDirty = savedConfig && JSON.stringify(config.testimonial) !== JSON.stringify(savedConfig.testimonial);
  const isContactDirty = savedConfig && JSON.stringify(config.contact) !== JSON.stringify(savedConfig.contact);
  const isSocialMediaDirty = savedConfig && JSON.stringify(config.socialMedia) !== JSON.stringify(savedConfig.socialMedia);

  const setAbout = (key, val) => setConfig(prev => ({ ...prev, aboutEnsureAR: { ...prev.aboutEnsureAR, [key]: val } }));
  const setTestimonial = (key, val) => setConfig(prev => ({ ...prev, testimonial: { ...prev.testimonial, [key]: val } }));
  const setContact = (key, val) => setConfig(prev => ({ ...prev, contact: { ...prev.contact, [key]: val } }));
  const setSocialMedia = (key, val) => setConfig(prev => ({ ...prev, socialMedia: { ...prev.socialMedia, [key]: val } }));

  const ActionButtons = ({ isDirty, onReset }) => (
    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {isDirty && (
        <button
          onClick={onReset}
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
  );

  return (
    <div className="admin-layout">
      <Sidebar
        activeNav="site-settings"
        categories={CATEGORIES}
        activeCategory={null}
        modelCounts={{}}
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
            <h2 className="admin-page-title">Site Settings</h2>
            <span className="admin-model-count-badge" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6', borderColor: 'rgba(236,72,153,0.3)' }}>Content Manager</span>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '3rem' }}>
          <div className="ar-guide-settings-container">

            {/* About Section */}
            <div className="ar-guide-settings-card">
              <div className="ar-guide-settings-card-title">
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                About EnsureAR Content
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>Update the text shown in the About section on the Landing and About Us pages.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Landing Page Subtitle</label>
                <input className="ar-guide-input" value={config.aboutEnsureAR.landingSubtitle} onChange={e => setAbout('landingSubtitle', e.target.value)} />

                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Paragraph 1</label>
                <textarea className="ar-guide-input ar-guide-textarea" rows={4} value={config.aboutEnsureAR.text1} onChange={e => setAbout('text1', e.target.value)} />

                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Paragraph 2</label>
                <textarea className="ar-guide-input ar-guide-textarea" rows={3} value={config.aboutEnsureAR.text2} onChange={e => setAbout('text2', e.target.value)} />

                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Vision</label>
                <textarea className="ar-guide-input ar-guide-textarea" rows={3} value={config.vision} onChange={e => setConfig(prev => ({ ...prev, vision: e.target.value }))} />

                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Mission</label>
                <textarea className="ar-guide-input ar-guide-textarea" rows={3} value={config.mission} onChange={e => setConfig(prev => ({ ...prev, mission: e.target.value }))} />

                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Why Choose Us (use &lt;br/&gt;&lt;br/&gt; for line breaks)</label>
                <textarea className="ar-guide-input ar-guide-textarea" rows={5} value={config.whyChooseUs} onChange={e => setConfig(prev => ({ ...prev, whyChooseUs: e.target.value }))} />
              </div>
              <ActionButtons isDirty={isAboutDirty} onReset={() => handleResetSection('about')} />
            </div>

            {/* Testimonials */}
            <div className="ar-guide-settings-card">
              <div className="ar-guide-settings-card-title">
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" /></svg>
                Testimonial Content
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>Update the featured testimonial shown on the site.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Name</label>
                <input className="ar-guide-input" value={config.testimonial.name} onChange={e => setTestimonial('name', e.target.value)} />

                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Location / Designation</label>
                <input className="ar-guide-input" value={config.testimonial.location} onChange={e => setTestimonial('location', e.target.value)} />

                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Quote Text</label>
                <textarea className="ar-guide-input ar-guide-textarea" rows={3} value={config.testimonial.text} onChange={e => setTestimonial('text', e.target.value)} />
              </div>
              <ActionButtons isDirty={isTestimonialDirty} onReset={() => handleResetSection('testimonial')} />
            </div>

            {/* Contact Information */}
            <div className="ar-guide-settings-card">
              <div className="ar-guide-settings-card-title">
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                Contact Details
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>Update the contact address, phone, and email shown across the site.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Address</label>
                <textarea className="ar-guide-input ar-guide-textarea" rows={2} value={config.contact.address} onChange={e => setContact('address', e.target.value)} />

                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Phone Number</label>
                <input className="ar-guide-input" value={config.contact.phone} onChange={e => setContact('phone', e.target.value)} />

                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Email Address</label>
                <input className="ar-guide-input" value={config.contact.email} onChange={e => setContact('email', e.target.value)} />
              </div>
              <ActionButtons isDirty={isContactDirty} onReset={() => handleResetSection('contact')} />
            </div>

            {/* Social Media Links */}
            <div className="ar-guide-settings-card">
              <div className="ar-guide-settings-card-title">
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}><path d="M13.447 18.232a8 8 0 10-6.894-13.88M11 6a2 2 0 11-4 0 2 2 0 014 0zM12.928 9A7.957 7.957 0 0113 10c0 1.94-.69 3.723-1.83 5.093l-4.14-4.14A3.978 3.978 0 016 10c0-2.21 1.79-4 4-4h.24l3.141 3.14z" /></svg>
                Social Media Links
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>Update the social media links shown across the site.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Facebook</label>
                <input className="ar-guide-input" value={config.socialMedia?.facebook || ''} onChange={e => setSocialMedia('facebook', e.target.value)} />
                
                <label style={{ color: '#fff', fontSize: '0.85rem' }}>Instagram</label>
                <input className="ar-guide-input" value={config.socialMedia?.instagram || ''} onChange={e => setSocialMedia('instagram', e.target.value)} />
                
                <label style={{ color: '#fff', fontSize: '0.85rem' }}>LinkedIn</label>
                <input className="ar-guide-input" value={config.socialMedia?.linkedin || ''} onChange={e => setSocialMedia('linkedin', e.target.value)} />
              </div>
              <ActionButtons isDirty={isSocialMediaDirty} onReset={() => handleResetSection('socialMedia')} />
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

