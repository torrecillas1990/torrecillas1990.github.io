// sw.js
const CACHE_NAME = 'boda-gemma-manuel-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Devuelve la caché si existe, si no, va a la red
      return cachedResponse || fetch(event.request);
    })
  );
});