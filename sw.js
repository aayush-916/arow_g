/* Bow Blitz Duel — service worker (offline support for the installable PWA). */
const CACHE = "bow-blitz-v3";

// The game is fully playable from index.html alone (art is embedded as base64),
// so index.html is the one essential asset; the rest are best-effort.
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-any.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cache each asset independently so one missing/renamed file can't break
    // the whole install (which is what kills offline support).
    await Promise.all(CORE.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") {
    return;
  }

  // Page loads (including launching the installed app): serve the cached app
  // shell INSTANTLY, then refresh the cache in the background. This is what makes
  // the installed PWA open reliably on every tap instead of hanging on the
  // network and needing several tries.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cached =
        (await caches.match("./index.html")) ||
        (await caches.match(req)) ||
        (await caches.match("./"));

      const network = fetch(req)
        .then((fresh) => {
          caches.open(CACHE).then((cache) => cache.put("./index.html", fresh.clone())).catch(() => {});
          return fresh;
        })
        .catch(() => null);

      // Cached first (instant launch); only wait on the network if nothing cached yet.
      return cached || (await network) || Response.error();
    })());
    return;
  }

  // Everything else: serve from cache first, otherwise fetch and cache it.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      return cached;
    }
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
