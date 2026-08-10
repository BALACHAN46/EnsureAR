/**
 * config.js
 * ----------------
 * Where the backend API actually lives.
 *
 * API_BASE_URL: prefixes every /api/v1/* call. Left empty by default so
 * calls are same-origin relative paths — in dev, vite.config.js proxies
 * those to the API (avoids CORS entirely); in production, deploy behind a
 * reverse proxy that does the same, or set VITE_API_BASE_URL to the API's
 * public URL.
 *
 * MEDIA_BASE_URL: GLB models and thumbnails are served directly from the
 * API's wwwroot (e.g. "/models/necklace/abc123.glb"), which is NOT proxied
 * (this frontend has its own, unrelated /models/*.png demo assets under
 * public/). Media URLs always need the API's real origin prepended.
 */

// Change this URL to your ngrok URL or backend URL to apply it everywhere
const COMMON_API_URL = import.meta.env.VITE_API_BASE_URL || 'https://affront-cherisher-purse.ngrok-free.dev';

export const API_BASE_URL = COMMON_API_URL;
export const MEDIA_BASE_URL = COMMON_API_URL;

/** Resolves a model/thumbnail path returned by the API into a fully-qualified URL. */
export function resolveMediaUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${MEDIA_BASE_URL}${path}`;
}
