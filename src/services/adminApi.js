import { apiClient } from './apiClient';

export function getSiteSettings() {
  return apiClient.get('/api/v1/admin/site-settings', { auth: false });
}

export function updateSiteSettings(request) {
  return apiClient.put('/api/v1/admin/site-settings', request);
}

export function getTestimonials({ includeInactive = false } = {}) {
  const params = new URLSearchParams({ includeInactive: String(includeInactive) });
  return apiClient.get(`/api/v1/admin/testimonials?${params}`, { auth: includeInactive });
}

export function createTestimonial(request) {
  return apiClient.post('/api/v1/admin/testimonials', request);
}

export function updateTestimonial(id, request) {
  return apiClient.put(`/api/v1/admin/testimonials/${id}`, request);
}

export function deleteTestimonial(id) {
  return apiClient.delete(`/api/v1/admin/testimonials/${id}`);
}
