/* Bow Blitz Duel — service worker (offline support for the installable PWA). */
const CACHE = "bow-blitz-v2";

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

  // Page loads: try the network, but fall back to the cached app shell offline.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch (err) {
        return (
          (await caches.match(req)) ||
          (await caches.match("./index.html")) ||
          (await caches.match("./")) ||
          Response.error()
        );
      }
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
