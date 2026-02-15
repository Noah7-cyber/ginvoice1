const CACHE_NAME = 'ginvoice-v39-clean-text';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ginvoice.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Dancing+Script:wght@400;700&family=Montserrat:wght@400;600;700;900&display=swap'
];

// Routes that MUST go to the network (for your Syncing/Backend)
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

// Installation: Cache the core Shell (Fault Tolerant)
self.addEventListener('install', (event) => {
  // FORCE IMMEDIATE UPDATE
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Loop individually to prevent one 404 from failing the entire install
      await Promise.all(ASSETS_TO_CACHE.map(async (url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(response.statusText);
            await cache.put(url, response);
        } catch (error) {
            console.warn(`Failed to cache ${url}:`, error);
            // Intentionally swallow error to allow installation to proceed
        }
      }));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // Take control immediately
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);

  if (requestUrl.protocol === 'chrome-extension:') return;

  // 1. Navigation: App Shell First (Offline Stability)
  // We bypass network check for navigation to ensure the UI loads instantly,
  // preventing the "white screen" or JSON error if the network is flaky.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        return cached || fetch(event.request).catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // 2. Static Assets: Cache First, Then Network
  const isAsset = requestUrl.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2)$/);
  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((response) => {
          // Cache internal or valid CORS assets
          if (!response || response.status !== 200) return response;
          const isInternal = requestUrl.origin === location.origin;
          if (isInternal || response.type === 'cors') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. API/Backend: Network Only (with Offline Fallback)
  if (shouldBypass(requestUrl, event.request) || requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.error('[SW] API Fetch Failed:', err);
        return jsonOfflineResponse();
      })
    );
    return;
  }
});
