const CACHE_NAME = 'ginvoice-v6'; // Incremented version for new build system
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

// Installation: Cache the core Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting(); // No hard refresh needed
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim(); // Take control immediately
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);

  // ADD THIS BLOCK: Ignore API calls so they are never cached
  if (requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  if (requestUrl.protocol === 'chrome-extension:') {
    return;
  }

  // 1. Critical Backend/Sync Routes: Network Only
  if (shouldBypass(requestUrl, event.request)) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.error('[SW] Bypass Fetch Failed (likely CORS or Offline):', err, event.request.url);
        return jsonOfflineResponse();
      })
    );
    return;
  }

  // 2. Navigation: Network First, Fallback to index.html (for Offline)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 3. Static Assets: Cache First, then Network
  // We specifically ensure that JS/CSS assets from our origin are cached for offline usage
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((response) => {
        // Only cache valid internal assets
        // We ensure we cache bundled assets (.js, .css)
        const isAsset = requestUrl.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2)$/);
        const isInternal = requestUrl.origin === location.origin;

        if (!response || response.status !== 200 || response.type !== 'basic') {
             // If it's an external asset (like fonts), we might still want to cache if 'cors'
             if (response && response.status === 200 && response.type === 'cors' && isAsset) {
                 // cache font
             } else {
                 return response;
             }
        }

        // Cache internal assets aggressively for offline support
        if (isInternal || (response.type === 'cors' && isAsset)) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
            });
        }
        return response;
      });
    })
  );
});
