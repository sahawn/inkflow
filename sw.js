const CACHE_NAME = 'inkflow-v3.1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames
                .filter((name) => name.startsWith('inkflow-') && name !== CACHE_NAME)
                .map((name) => caches.delete(name))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Firebase/Auth/Firestore requests and non-GET requests must not be intercepted.
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    const isAppShell = request.mode === 'navigate' || /\.(html|js|css|json)$/.test(url.pathname);

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);

        if (isAppShell) {
            // Network-first makes deployed fixes load promptly; cache is the offline fallback.
            try {
                const response = await fetch(request);
                if (response && response.ok) await cache.put(request, response.clone());
                return response;
            } catch (error) {
                const cached = await cache.match(request);
                if (cached) return cached;
                if (request.mode === 'navigate') {
                    const fallback = await cache.match('./index.html');
                    if (fallback) return fallback;
                }
                throw error;
            }
        }

        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
    })());
});
