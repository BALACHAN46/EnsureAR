import { apiClient } from './apiClient';

export function getARModel(code) {
  return apiClient.get(`/api/v1/ar/models/${code}`, { auth: false });
}

export function updateTuning(code, request) {
  return apiClient.put(`/api/v1/ar/models/${code}/tuning`, request);
}

export function resetTuning(code) {
  return apiClient.post(`/api/v1/ar/models/${code}/tuning/reset`);
}

export function getGlobalGuideSettings() {
  return apiClient.get('/api/v1/ar/guides', { auth: false });
}

export function updateGlobalGuideSettings(request) {
  return apiClient.put('/api/v1/ar/guides/settings', request);
}

export function getGuideByCategory(categorySlug) {
  return apiClient.get(`/api/v1/ar/guides/${categorySlug}`, { auth: false });
}

export function updateGuideByCategory(categorySlug, request) {
  return apiClient.put(`/api/v1/ar/guides/${categorySlug}`, request);
}

export function updateGuideSteps(categorySlug, steps) {
  return apiClient.put(`/api/v1/ar/guides/${categorySlug}/steps`, { steps });
}
