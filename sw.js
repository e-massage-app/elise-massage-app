// ===== Service Worker - Elise Massage PWA =====
// Strategie : cache assets statiques UNIQUEMENT, PAS les donnees Supabase
// Si offline -> l'app affiche le message "reseau requis"

const CACHE_NAME = 'elise-massage-v36';
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './css/base.css',
  './css/components.css',
  './css/views.css',
  './css/mobile.css',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth.js',
  './js/app.js',
  './js/core/data-manager.js',
  './js/core/calculations.js',
  './js/services/client-services.js',
  './js/services/business-services.js',
  './js/services/utils-services.js',
  './js/ui/view-manager.js',
  './js/ui/modal-manager.js',
  './js/ui/form-manager.js',
  './js/analytics/google-ads-roi.js',
  './assets/logo.png',
  './assets/icon.png'
];

// Installation : pre-cache des assets statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW: Certains assets non caches:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch : cache-first pour les assets, network-only pour Supabase
self.addEventListener('fetch', (event) => {
  // Ignorer les requetes chrome-extension et non-http
  if (!event.request.url.startsWith('http')) return;
  const url = new URL(event.request.url);

  // Requetes Supabase -> TOUJOURS reseau (pas de cache donnees)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Si offline, laisser echouer - l'app gere l'overlay
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // CDN externes (ApexCharts, date-fns, Supabase JS) -> cache-first
  if (url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // APIs externes (OpenRouteService, Nominatim, Google) -> network-only
  if (url.hostname.includes('openrouteservice.org') ||
      url.hostname.includes('nominatim.openstreetmap.org') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('api-adresse.data.gouv.fr')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Assets statiques locaux -> network-first (toujours la derniere version)
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // Offline : fallback sur le cache
      return caches.match(event.request);
    })
  );
});
