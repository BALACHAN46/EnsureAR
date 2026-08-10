import { apiClient } from './apiClient';
import { resolveMediaUrl } from './config';

// The rest of the app (ModelCard, Scene3D, ProductConfigurator, ARViewPage...)
// was all written against the old catalog.json shape. Rather than touch every
// consumer, this adapter maps the API's DTO onto that exact shape, so only
// the *source* of the data changes.
function toLegacyModel(dto) {
  const baseModelUrl = resolveMediaUrl(dto.modelFileUrl);
  const isImageFile = /\.(png|jpe?g|svg|webp)$/i.test(baseModelUrl.split('?')[0]);
  const modelUrl = isImageFile ? (baseModelUrl + (baseModelUrl.includes('?') ? '&' : '?') + 'v=ar') : baseModelUrl;
  return {
    id: dto.modelCode,
    name: dto.modelName,
    category: dto.categorySlug,
    material: dto.material || '',
    modelPath: modelUrl,
    glbPath: modelUrl,
    thumbnailPath: dto.thumbnailFileUrl ? (resolveMediaUrl(dto.thumbnailFileUrl) + '?v=ar') : modelUrl,
    uploadedAt: dto.uploadedAt,
    deleted: !dto.isActive,
    isTuned: !!dto.isTuned,
    childCategoryId: dto.childCategoryId,
    categoryName: dto.categoryName,
  };
}

const FETCH_ALL_PAGE_SIZE = 500;

/** Fetches the whole catalog (small boutique catalog, not paginated in the UI yet) — mirrors the old fetch('/models/catalog.json'). */
export async function getAllProducts({ includeInactive = false } = {}) {
  const params = new URLSearchParams({ pageSize: String(FETCH_ALL_PAGE_SIZE), includeInactive: String(includeInactive) });
  const result = await apiClient.get(`/api/v1/products?${params}`, { auth: includeInactive });
  return result.items.map(toLegacyModel);
}

export async function getFilteredProducts({ category = null, material = null, includeInactive = false } = {}) {
  const params = new URLSearchParams({ pageSize: String(FETCH_ALL_PAGE_SIZE), includeInactive: String(includeInactive) });
  if (category) params.append('category', category);
  if (material && material !== 'all') params.append('material', material);
  const result = await apiClient.get(`/api/v1/products?${params}`, { auth: includeInactive });
  return result.items.map(toLegacyModel);
}

export async function getProductByCode(code) {
  const dto = await apiClient.get(`/api/v1/products/${code}`, { auth: false });
  return toLegacyModel(dto);
}

export async function createProduct(formData) {
  const dto = await apiClient.postForm('/api/v1/products', formData);
  return toLegacyModel(dto);
}

export function updateProduct(code, request) {
  return apiClient.put(`/api/v1/products/${code}`, request);
}

export function updateProductStatus(code, isActive) {
  return apiClient.patch(`/api/v1/products/${code}/status`, { isActive });
}

export function updateProductMaterial(code, material) {
  return apiClient.patch(`/api/v1/products/${code}/material`, { material });
}
