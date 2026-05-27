const CACHE_NAME = 'radar-cache-v3'; // Subimos versión para forzar limpieza
const urlsToCache = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // REGLA ESTRICTA: Si la URL no pertenece a nuestro dominio, el Service Worker 
    // se aparta y deja que el navegador haga la petición directamente a internet.
    if (!event.request.url.startsWith(self.location.origin)) {
        return; 
    }

    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});