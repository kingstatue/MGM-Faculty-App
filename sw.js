const APP_VERSION = '2026-07-12-pwa-auto-update-v2';
const APP_CACHE = `mgm-student-portal-app-${APP_VERSION}`;
const RUNTIME_CACHE = `mgm-student-portal-runtime-${APP_VERSION}`;
const CACHE_PREFIX = 'mgm-student-portal-';

const CORE_ASSETS = [
  '.',
  'index.html',
  'student-manifest.json',
  'timetable.json',
  'subject.json',
  
];

const toScopeUrl = asset => new URL(asset, self.registration.scope).href;

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await Promise.allSettled(CORE_ASSETS.map(async asset => {
      const url = toScopeUrl(asset);
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response.clone());
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && ![APP_CACHE, RUNTIME_CACHE].includes(name))
      .map(name => caches.delete(name))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'APP_UPDATED', version: APP_VERSION }));
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && (fresh.ok || fresh.type === 'opaque')) await cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const appShell = await caches.match(toScopeUrl('index.html'), { ignoreSearch: true });
    if (appShell) return appShell;
    return new Response('App is offline and no cached copy is available.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then(response => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
