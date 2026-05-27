// Cambiamos el nombre de v1 a v2 para forzar la actualización
const CACHE_NAME = 'radar-cache-v2';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    // Forzamos al nuevo Service Worker a tomar el control inmediatamente
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    // Borramos las cachés antiguas (la v1 que está dando problemas)
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Si la petición va a cualquier API o proxy externo, que NO use caché
    if (event.request.url.includes('opensky-network') || 
        event.request.url.includes('allorigins') || 
        event.request.url.includes('corsproxy')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Para nuestra web, primero red, luego caché (estrategia Network First para desarrollo)
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});