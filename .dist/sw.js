// Eonora Tech OS - Service Worker
const CACHE_NAME = 'eonora-tech-os-v11';
const OFFLINE_URL = '/offline.html';

const PRECACHE_RESOURCES = [
  '/offline.html',
  '/manifest.json',
  '/logo-eonora.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

function isHashedAsset(pathname) {
  return pathname.startsWith('/assets/') || pathname.endsWith('.js') || pathname.endsWith('.css');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_RESOURCES))
      .then(() => self.skipWaiting())
      .catch((error) => console.error('[SW] install failed:', error))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => caches.open(CACHE_NAME))
      .then((cache) => cache.addAll(PRECACHE_RESOURCES))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Hashed build output: network only — never serve stale JS/CSS from cache
  if (isHashedAsset(url.pathname) || request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetchAndCache(request))
  );
});

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Eonora Tech OS', {
      body: data.body || 'Nouvelle notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

console.log('[SW] Service Worker loaded', CACHE_NAME);
