/**
 * Service Worker — Suivi chantiers scolaires MEN CI (Workbox 7, via CDN ;
 * workbox-sw se met lui-même en cache après le premier chargement).
 *
 * Stratégies :
 *  - assets Next.js (_next/static)  → CacheFirst (immuables)
 *  - navigations (pages HTML)       → NetworkFirst (timeout 3 s, utile en 3G),
 *                                     repli cache puis /hors-ligne
 *  - photos Supabase Storage        → StaleWhileRevalidate (30 jours)
 *  - API Supabase (/rest, /auth)    → réseau uniquement (les données offline
 *                                     vivent dans IndexedDB, pas en cache HTTP)
 */
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js"
);

workbox.setConfig({ debug: false });

const { registerRoute, setCatchHandler } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;

self.skipWaiting();
workbox.core.clientsClaim();

const CACHE_PAGES = "chantierci-pages";
const PAGE_HORS_LIGNE = "/hors-ligne";

// Pré-cache de la page de repli hors ligne.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_PAGES).then((cache) => cache.add(PAGE_HORS_LIGNE))
  );
});

// En développement (localhost), ne JAMAIS servir les bundles depuis le cache :
// les chunks de `next dev` ne sont pas hachés et CacheFirst figerait le code.
const EN_DEV = self.location.hostname === "localhost";

// Assets immuables de Next.js (hachés par le build de production).
if (!EN_DEV) {
  registerRoute(
    ({ url }) => url.pathname.startsWith("/_next/static/"),
    new CacheFirst({
      cacheName: "chantierci-statique",
      plugins: [new ExpirationPlugin({ maxEntries: 200 })],
    })
  );
}

// Photos servies par Supabase Storage (URLs signées).
registerRoute(
  ({ url }) =>
    url.hostname.endsWith(".supabase.co") &&
    url.pathname.startsWith("/storage/v1/object"),
  new StaleWhileRevalidate({
    cacheName: "chantierci-photos",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 30 * 24 * 3600,
      }),
    ],
  })
);

// Navigations : réseau d'abord (3 s), sinon dernière version en cache.
registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" && url.origin === self.location.origin,
  new NetworkFirst({
    cacheName: CACHE_PAGES,
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 60 })],
  })
);

// Repli : page hors ligne pour les navigations introuvables en cache.
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const cache = await caches.open(CACHE_PAGES);
    const repli = await cache.match(PAGE_HORS_LIGNE);
    if (repli) return repli;
  }
  return Response.error();
});

// Background Sync (bonus Chrome Android) : au retour du réseau, demande aux
// pages ouvertes de vider la file d'attente IndexedDB.
self.addEventListener("sync", (event) => {
  if (event.tag === "chantierci-sync") {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window" })
        .then((clients) =>
          clients.forEach((client) =>
            client.postMessage({ type: "chantierci-sync" })
          )
        )
    );
  }
});
