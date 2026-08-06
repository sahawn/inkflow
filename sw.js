const CACHE_NAME = 'inkflow-v3.0'; // ⬆️ BUMP VERSION!
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './sw.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW v3.0: Caching Files');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // ⬅️ Langsung aktif
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('SW: Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim(); // ⬅️ Langsung kontrol page
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // ⬇️ Cache-first, tapi selalu fetch baru juga
            if (response) {
                // Fetch di background untuk update cache
                fetch(event.request).then(fetchResponse => {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, fetchResponse.clone());
                    });
                }).catch(() => {});
                return response;
            }
            return fetch(event.request);
        })
    );
});
