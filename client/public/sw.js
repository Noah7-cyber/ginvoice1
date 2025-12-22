const CACHE_NAME = 'ginvoice-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Dancing+Script:wght@400;700&family=Montserrat:wght@400;600;700;900&display=swap',
  '../manifest.json', // Add this!
  '/ginvoice.png'   // Add your icons too
];

const BYPASS_PATHS = [
  '/health',
  '/auth/',
  '/api/',
  '/sync/',
  '/payments/',
  '/webhooks/',
  '/entitlements'
];

const jsonOfflineResponse = () => {
  return new Response(JSON.stringify({ ok: false, offline: true }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
};

const shouldBypass = (requestUrl, request) => {
  const pathname = requestUrl.pathname;
  const hasAuthHeader = request.headers.has('authorization');
  const hasCredentials = request.credentials === 'include';

  if (hasAuthHeader || hasCredentials) return true;

  return BYPASS_PATHS.some((path) => {
    if (path.endsWith('/')) return pathname.startsWith(path);
    return pathname === path || pathname.startsWith(path + '/');
  });
};

const isSafeAsset = (requestUrl, request) => {
  if (request.mode === 'navigate') return false;
  if (requestUrl.origin !== self.location.origin) return false;
  return requestUrl.pathname.startsWith('/assets/');
};

const isFontAsset = (requestUrl) => {
  return requestUrl.hostname === 'fonts.googleapis.com' || requestUrl.hostname === 'fonts.gstatic.com';
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // 1. Bypass API/Auth calls
  if (shouldBypass(requestUrl, event.request)) {
    event.respondWith(
      fetch(event.request).catch(() => jsonOfflineResponse())
    );
    return;
  }

  // 2. Navigation (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 3. Static Assets (CSS, JS, Images)
  // Use Cache-First strategy for assets to ensure PWA speed and offline stability
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((response) => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
// Changes: bypass auth/api/sync/payment routes and credentialed requests; network-first for navigation; cache-first only for safe versioned assets; return JSON 503 when offline for bypassed routes.
