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
    // REGLA DE ORO: Si la petición va a OpenSky o a cualquier lugar fuera de nuestra web, 
    // IGNORAR LA CACHÉ y usar SIEMPRE la red normal.
    if (event.request.url.startsWith('http') && !event.request.url.includes(self.location.hostname)) {
        event.respondWith(fetch(event.request));
        return; // Salimos de la función aquí mismo
    }

    // Para nuestros archivos (HTML, CSS, JS), intentamos red y luego caché
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});