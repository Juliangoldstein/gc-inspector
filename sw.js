// GC Inspector — Service Worker
// Versión de caché: incrementar al actualizar la app
const CACHE = 'gc-inspector-v1';

const PRECACHE = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
];

// Instalar: guardar archivos estáticos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activar: limpiar cachés viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first para estáticos, network-first para el Apps Script
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Las llamadas al Apps Script siempre van a la red
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Dropbox también va a la red
  if (url.hostname.includes('dropbox') || url.hostname.includes('dl.dropboxusercontent')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Todo lo demás: caché primero, red como fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cachear respuestas exitosas de recursos estáticos
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback para navegación
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
