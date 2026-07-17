const CACHE_VERSION = 'mgm-timetable-v19';
const SHELL_CACHE = CACHE_VERSION + '-shell';

const PRECACHE_ASSETS = [
    './',
    'index.html',
    'manifest.json',
    'timetable.json',
    'subject.json'
];

function isNetworkFirstUrl(url) {
    try {
        const path = new URL(url, self.location.href).pathname;
        return /\.(html|json)$/i.test(path) || path.endsWith('/') || !path.includes('.');
    } catch (e) {
        return true;
    }
}

function isHtmlRequest(request) {
    if (request.mode === 'navigate') return true;
    const accept = request.headers.get('accept') || '';
    return accept.includes('text/html');
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => {
            const promises = PRECACHE_ASSETS.map((asset) => {
                return fetch(asset)
                    .then((response) => {
                        if (response && response.ok) {
                            return cache.put(asset, response);
                        }
                    })
                    .catch((err) => {
                        console.warn(`Failed to precache ${asset}:`, err);
                    });
            });
            return Promise.all(promises);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const { request } = event;

    if (isHtmlRequest(request) || isNetworkFirstUrl(request.url)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((matching) => {
                        if (matching) return matching;
                        // Fallback logic for HTML pages
                        if (isHtmlRequest(request)) {
                            const fallbacks = ['/', '/index.html', '/mobile-timetable.html'];
                            return caches.open(SHELL_CACHE).then((cache) => {
                                return cache.keys().then((keys) => {
                                    for (const fallback of fallbacks) {
                                        const matchedKey = keys.find(k => {
                                            const kUrl = new URL(k.url);
                                            return kUrl.pathname === fallback || kUrl.pathname.endsWith(fallback);
                                        });
                                        if (matchedKey) return cache.match(matchedKey);
                                    }
                                });
                            });
                        }
                    });
                })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
