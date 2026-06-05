// sw.js — MAGNUM Stock Count
const CACHE_SHELL = 'magnum-shell-v1';
const CACHE_DATA = 'magnum-data-v1';

// Recursos que forman la shell (precache)
const SHELL_ASSETS = [
  './',                         // la raíz (index.html)
  './index.html',               // por si se accede directamente
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/html5-qrcode',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap'
];

// Instalación: precarga la shell
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => {
        console.log('[SW] Precaching shell');
        return Promise.allSettled(
          SHELL_ASSETS.map(url => cache.add(url).catch(err => {
            console.warn('[SW] Falló al precachear', url, err);
          }))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activación: limpia cachés antiguas
self.addEventListener('activate', event => {
  console.log('[SW] Activado');
  const currentCaches = [CACHE_SHELL, CACHE_DATA];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (!currentCaches.includes(name)) {
            console.log('[SW] Eliminando caché antigua:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de fetch
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Cache-First para la shell
  if (isShellAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 2. Network-First para la API de Supabase
  if (url.hostname === 'xlhweilqfhrvoholarap.supabase.co') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 3. Para el resto, red con fallback a la shell offline
  event.respondWith(
    fetch(request).catch(() => caches.match('./'))
  );
});

// ---------- Funciones auxiliares ----------

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Cache hit:', request.url);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] Offline, sin caché para:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_DATA);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] Offline, usando caché de datos:', request.url);
      return cached;
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function isShellAsset(url) {
  const shellDomains = [
    self.location.origin,
    'cdn.jsdelivr.net',
    'unpkg.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ];
  return shellDomains.some(domain => url.hostname.includes(domain));
}