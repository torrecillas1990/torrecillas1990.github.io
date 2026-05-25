const CACHE_NAME = 'prophoto-v1';
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json'
    // He quitado la CDN aquí para evitar fallos de instalación. 
    // Puedes precachearla si la descargas localmente.
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

// Limpieza de cachés antiguas
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(response => {
            // Si el recurso no está en caché, va a la red
            return response || fetch(e.request);
        })
    );
});