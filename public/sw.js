// Service Worker to bypass ngrok browser warning for static media assets
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Intercept requests to ngrok domain
  if (event.request.method === 'GET' && url.hostname.includes('ngrok-free.dev')) {
    if (!event.request.headers.has('ngrok-skip-browser-warning')) {
      const newHeaders = new Headers(event.request.headers);
      newHeaders.set('ngrok-skip-browser-warning', 'true');
      
      const modifiedRequest = new Request(event.request.url, {
        method: event.request.method,
        headers: newHeaders,
        mode: 'cors', // Require CORS since we are adding custom headers
        credentials: 'omit' // Static assets don't need credentials
      });
      
      event.respondWith(
        fetch(modifiedRequest).catch(err => {
          console.error("SW Fetch error:", err);
          return fetch(event.request);
        })
      );
      return;
    }
  }
});
