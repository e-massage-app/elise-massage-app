// ===== Service Worker - Elise Massage PWA =====
// Strategie : cache assets statiques UNIQUEMENT, PAS les donnees Supabase
// Si offline -> l'app affiche le message "reseau requis"

const CACHE_NAME = 'elise-massage-v61';
// v1.0.18.3 : les JS et CSS ne figurent plus ici.
// Depuis cette version, index.html les appelle avec une estampille de version
// ("js/app.js?v=1.0.18.3", posee par scripts/estampiller-version.js). Les
// precacher sans estampille revenait a telecharger a chaque installation des
// URL que plus personne ne demande. Ils entrent dans le cache au premier
// chargement reel, a leur URL estampillee.
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './assets/logo.png',
  './assets/icon.png'
];

// Installation : pre-cache des assets statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // v1.0.11.1 - CORRECTIF IMPORTANT :
      // cache.addAll() passe par le cache HTTP du navigateur. Si l'ancien
      // fichier y est encore, le nouveau cache est rempli avec du PERIME :
      // nom de cache neuf, contenu vieux, et l'app reste bloquee sur
      // l'ancienne version malgre le deploiement.
      // { cache: 'reload' } force un aller-retour reseau reel.
      const requetes = STATIC_ASSETS.map(
        (url) => new Request(url, { cache: 'reload' })
      );
      return cache.addAll(requetes).catch((err) => {
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

  // Assets statiques locaux -> network-first (toujours la derniere version).
  //
  // v1.0.18.3 : fetch(event.request) passe par le cache HTTP du navigateur.
  // GitHub Pages sert les fichiers avec un max-age de dix minutes : pendant
  // ce delai, le navigateur repond depuis son propre cache sans meme
  // contacter le reseau, et le service worker range ensuite cette reponse
  // perimee dans SON cache. C'est ainsi qu'un google-ads-roi.js d'un
  // deploiement precedent a continue de s'executer sous un index.html a jour.
  //
  // 'no-cache' n'empeche pas la mise en cache : il impose une requete
  // conditionnelle. Le serveur repond 304 quand rien n'a bouge - c'est
  // quasiment gratuit - et le contenu neuf arrive des qu'il existe.
  const versReseau = event.request.method === 'GET'
    ? new Request(event.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : event.request;

  event.respondWith(
    fetch(versReseau).then((response) => {
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
