const CACHE_VERSION = 'seeyou-cache-v171';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const API_CACHE = `${CACHE_VERSION}-api`;
// Teselas del mapa (Esri): caché propia y persistente (no se borra al cambiar CACHE_VERSION)
// para que las zonas ya vistas carguen al instante y sin gastar datos.
const TILE_CACHE = 'seeyou-tiles-v1';
const TILE_MAX_ENTRIES = 6000;
let tilePutsSinceTrim = 0;

function isMapTile(urlObj) {
  return /(^|\.)arcgisonline\.com$/i.test(urlObj.hostname) && /\/tile\//i.test(urlObj.pathname);
}

async function trimTileCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= TILE_MAX_ENTRIES) return;
  const excess = keys.length - TILE_MAX_ENTRIES + 200;
  for (let i = 0; i < excess; i += 1) await cache.delete(keys[i]);
}

async function tileCacheFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  // Solo respuestas legibles (CORS): las opacas ocupan mucho espacio de cuota.
  if (response && response.ok && (response.type === 'cors' || response.type === 'basic')) {
    cache.put(request, response.clone()).then(() => {
      tilePutsSinceTrim += 1;
      if (tilePutsSinceTrim >= 60) {
        tilePutsSinceTrim = 0;
        trimTileCache(cache).catch(() => {});
      }
    }).catch(() => {});
  }
  return response;
}

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/home.html',
  '/chat.html',
  '/register.html',
  '/login_script.js',
  '/css/style.css',
  '/config.js',
  '/manifest.json'
];

const CACHE_STRATEGIES = {
  // Cachea primero, luego intenta red (para imágenes)
  CACHE_FIRST: 'cache-first',
  // Intenta red primero, luego caché (para datos dinámicos)
  NETWORK_FIRST: 'network-first',
  // Solo caché (para assets estáticos)
  CACHE_ONLY: 'cache-only'
};

// Detectar tipo de recurso
function getStrategyForRequest(url) {
  const urlObj = new URL(url, self.location.origin);
  const pathname = urlObj.pathname;
  
  // Imágenes: cache-first
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pathname)) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // API: network-first
  if (pathname.includes('/api/')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // CSS, JS, fonts: cache-first
  if (/\.(css|js|woff|woff2|ttf|eot)$/i.test(pathname)) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // HTML: network-first
  if (/\.html$|^\/$/.test(pathname)) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  return CACHE_STRATEGIES.NETWORK_FIRST;
}

function isPublicR2Image(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      /(^|\.)r2\.dev$/i.test(parsed.hostname) &&
      /\.(jpg|jpeg|png|gif|webp|svg|ico)(\?.*)?$/i.test(parsed.pathname);
  } catch (error) {
    return false;
  }
}

function getCacheName(strategy, url) {
  if (strategy === CACHE_STRATEGIES.CACHE_FIRST && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
    return IMAGE_CACHE;
  }
  if (strategy === CACHE_STRATEGIES.NETWORK_FIRST && url.includes('/api/')) {
    return API_CACHE;
  }
  return DYNAMIC_CACHE;
}

// Install: pre-cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => {
        return new Request(url, { cache: 'no-cache' });
      })).catch(() => {
        console.log('Error pre-cacheando assets estáticos');
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: limpiar cachés antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('seeyou-cache-') && ![
            STATIC_CACHE,
            DYNAMIC_CACHE,
            IMAGE_CACHE,
            API_CACHE
          ].includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: aplicar estrategia de caché
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // No cachear peticiones POST, PUT, DELETE
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  const requestUrl = new URL(url);
  // Video y audio (peticiones con Range, respuestas 206): el service worker no se mete, el navegador los gestiona solo.
  if (request.headers.has('range') || request.destination === 'video' || request.destination === 'audio' || /\.(mp4|m4v|webm|mp3|m4a)(\?|$)/i.test(requestUrl.pathname)) return;
  if (isMapTile(requestUrl)) {
    event.respondWith(tileCacheFirst(request).catch(() => fetch(request)));
    return;
  }

  // Lista blanca MUY corta y explicita de endpoints de /api/ que son publicos, de solo
  // lectura, deterministas (el mismo texto+idioma siempre da la misma respuesta) y que NO
  // dependen de quien ha iniciado sesion ni de amistades/bloqueos/visibilidad de nada. El
  // propio servidor ya los marca "Cache-Control: public" porque no llevan nada privado.
  // Se comprueba ANTES del filtro de origen porque en la app nativa el origen de la pagina
  // es "https://localhost" y la API real esta en otro origen (seeyouonline.net): si no, esta
  // cache nunca se usaria en el movil, que es donde mas se nota la lentitud.
  // Todo lo demas de /api/ (feed, Tics, comentarios, notificaciones, monedas, amigos...)
  // sigue yendo SIEMPRE a red sin cachear, exactamente igual que antes: eso nunca cambia.
  if (requestUrl.pathname === '/api/translate-theme') {
    event.respondWith(cacheFirst(request, API_CACHE).catch(() => fetch(request)));
    return;
  }

  // Let the browser apply the page CSP to other external resources.
  if (requestUrl.origin !== self.location.origin) return;

  const strategy = getStrategyForRequest(url);
  // El resto de respuestas de /api/ pueden contener datos privados o que cambian al momento
  // (feed, visibilidad de Tics, bloqueos...), asi que se siguen pidiendo siempre a la red,
  // nunca desde cache.
  if (url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }
  const cacheName = getCacheName(strategy, url);
  
  if (strategy === CACHE_STRATEGIES.CACHE_FIRST) {
    event.respondWith(cacheFirst(request, cacheName));
  } else if (strategy === CACHE_STRATEGIES.NETWORK_FIRST) {
    event.respondWith(networkFirst(request, cacheName));
  } else {
    event.respondWith(cacheOnly(request, cacheName));
  }
});

// Estrategia: Cache First
function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) => {
    return cache.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request).then((response) => {
        const cacheable = response && (response.status === 200 || response.type === 'opaque') && response.type !== 'error';
        if (!cacheable) {
          return response;
        }
        const responseToCache = response.clone();
        cache.put(request, responseToCache).catch(() => {});
        return response;
      }).catch(() => {
        // Si falla la red, retornar algo del caché si existe
        return cache.match(request).then((cachedResponse) => cachedResponse || Response.error());
      });
    });
  });
}

// Estrategia: Network First
function networkFirst(request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (!response || response.status !== 200) {
        return response;
      }
      const responseToCache = response.clone();
      caches.open(cacheName).then((cache) => {
        cache.put(request, responseToCache).catch(() => {});
      });
      return response;
    })
    .catch(() => {
      // Si falla la red, usar caché
      return caches.open(cacheName).then((cache) => {
        return cache.match(request).then((cachedResponse) => cachedResponse || Response.error());
      });
    });
}

// Estrategia: Cache Only
function cacheOnly(request, cacheName) {
  return caches.open(cacheName).then((cache) => {
    return cache.match(request);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/chat.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => 'focus' in client);
      if (existingClient) {
        return existingClient.navigate(targetUrl).then((client) => client.focus());
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
