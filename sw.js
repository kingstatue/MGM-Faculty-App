const CACHE_VERSION = 'mgm-timetable-v2';
const SHELL_CACHE = CACHE_VERSION + '-shell';

const PRECACHE_ASSETS = [
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
     'index.html'
];

function isTimetableJsonUrl(url) {
    try {
        const path = new URL(url, self.location.href).pathname;
        return /\/timetable\.json$/i.test(path) || path.endsWith('timetable.json');
    } catch (e) {
        return String(url).includes('timetable.json');
    }
}

function isHtmlRequest(request) {
    if (request.mode === 'navigate') return true;
    const accept = request.headers.get('accept') || '';
    return accept.includes('text/html');
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .catch(() => {})
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

    if (isTimetableJsonUrl(request.url)) {
        event.respondWith(fetch(request, { cache: 'no-store' }));
        return;
    }

    if (isHtmlRequest(request)) {
        event.respondWith(
            fetch(request).catch(() => caches.match('index.html'))
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
