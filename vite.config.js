// Force Vite to clear optimize dep cache
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev-only mock plugins that used to fake a backend by writing straight
// to public/models/*.json have been removed now that a real ASP.NET Core
// API exists (see EnsureAR_API/). /api and /hubs are proxied to it below so
// the browser talks to it same-origin (avoids CORS in dev). Media files
// (GLB/thumbnails) returned by the API are absolute URLs pointing at the
// API's own origin (see src/services/config.js) — NOT proxied here, so this
// dev server's own public/models/*.png demo assets keep working unchanged.
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5278';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: API_PROXY_TARGET, changeOrigin: true },
      '/hubs': { target: API_PROXY_TARGET, changeOrigin: true, ws: true },
    },
  },
})

