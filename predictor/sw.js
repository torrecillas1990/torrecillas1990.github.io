const CACHE_NAME = 'predictor-v1';
const ASSETS = [
  './index.html',
  './app.js',
  './predictor.js',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Instalar Service Worker y guardar recursos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activar y limpiar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Cache First / Network Fallback para máxima velocidad offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Fallback en caso de desconexión absoluta si se pide otra ruta
        return new Response("Contenido no disponible sin conexión.");
      });
    })
  );
});