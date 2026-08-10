import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Public pages
import LandingPage from './pages/LandingPage';
import AboutUsPage from './pages/AboutUsPage';
import ContactUsPage from './pages/ContactUsPage';
import PrivacyPage from './pages/PrivacyPage';

// Admin pages
import LoginPage from './pages/LoginPage';
import AdminOverview from './pages/AdminOverview';
import AdminDashboard from './pages/AdminDashboard';
import ModelEditPage from './pages/ModelEditPage';
import ARGuideSettingsPage from './pages/ARGuideSettingsPage';
import AdminSiteSettingsPage from './pages/AdminSiteSettingsPage';
import AdminMenuSettingsPage from './pages/AdminMenuSettingsPage';
import AdminEmailSettingsPage from './pages/AdminEmailSettingsPage';
import UploadPage from './pages/UploadPage';
import AdminDeletedModels from './pages/AdminDeletedModels';

// AR page
import ARViewPage from './pages/ARViewPage';

import './index.css';

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public Routes ── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutUsPage />} />
      <Route path="/contact" element={<ContactUsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* ── Admin Routes ── */}
      <Route path="/admin" element={<LoginPage />} />
      <Route path="/admin/dashboard" element={<AdminOverview />} />
      <Route path="/admin/models" element={<AdminDashboard />} />
      <Route path="/admin/models/:category" element={<AdminDashboard />} />
      <Route path="/admin/model/:id/edit" element={<ModelEditPage />} />
      <Route path="/admin/ar-guide" element={<ARGuideSettingsPage />} />
      <Route path="/admin/site-settings" element={<AdminSiteSettingsPage />} />
      <Route path="/admin/menu-settings" element={<AdminMenuSettingsPage />} />
      <Route path="/admin/email-settings" element={<AdminEmailSettingsPage />} />
      <Route path="/admin/upload" element={<UploadPage />} />
      <Route path="/admin/deleted-models" element={<AdminDeletedModels />} />

      {/* ── AR Try-On Route (DO NOT MODIFY) ── */}
      <Route path="/ar/:category/:modelId" element={<ARViewPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
