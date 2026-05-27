const CACHE_NAME = 'radar-cache-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// Instalación: Guarda los archivos estáticos en caché
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Interceptar peticiones (Fetch)
self.addEventListener('fetch', event => {
    // Si la petición es hacia la API de OpenSky, NO usamos caché, queremos datos frescos
    if (event.request.url.includes('opensky-network.org')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Para el resto de archivos (HTML, CSS, JS), buscamos en caché primero
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si está en caché lo devuelve, si no, lo descarga de internet
                return response || fetch(event.request);
            })
    );
});