import { apiClient } from './apiClient';

/** Flat list of the real AR categories (necklace, rings, ...). */
export function getCategories() {
  return apiClient.get('/api/v1/categories', { auth: false });
}

/** Full parent -> children menu tree (public navbar dropdown + Admin Menu Settings). */
export function getMenu() {
  return apiClient.get('/api/v1/categories/menu', { auth: false });
}

export function createParentCategory(request) {
  return apiClient.post('/api/v1/categories/menu/parent', request);
}

export function updateParentCategory(id, request) {
  return apiClient.put(`/api/v1/categories/menu/parent/${id}`, request);
}

export function deleteParentCategory(id) {
  return apiClient.delete(`/api/v1/categories/menu/parent/${id}`);
}

export function createChildCategory(parentId, request) {
  return apiClient.post(`/api/v1/categories/menu/parent/${parentId}/children`, request);
}

export function updateChildCategory(id, request) {
  return apiClient.put(`/api/v1/categories/menu/child/${id}`, request);
}

export function deleteChildCategory(id) {
  return apiClient.delete(`/api/v1/categories/menu/child/${id}`);
}
