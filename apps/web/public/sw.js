const CACHE_NAME = "open-health-v8";

const PRECACHE_URLS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline.html",
];

function safeCachePut(cache, request, response) {
  return cache.put(request, response).catch(() => {
    // Cache writes can fail for interrupted/dev-server responses. The network
    // response is still returned to the page, so this should stay non-fatal.
  });
}

// Install: pre-cache essential static assets (don't skipWaiting — let client decide)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// Activate: clean up old caches, then claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Listen for messages from client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Show notification via SW (works even when tab is backgrounded / PWA minimized)
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, body, icon, tag, url } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: icon || "/icon.svg",
        tag: tag || undefined,
        data: { url: url || "/" },
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        silent: false,
      })
    );
  }
});

// Handle Web Push notifications (server-side push)
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "FitNMove";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    tag: data.tag || "posture-reminder",
    data: { url: data.url || "/hub/posture" },
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    silent: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click — focus or open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.navigate(url).then(() => client.focus());
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

/** Network-first with cache fallback: try network, cache response, fall back to cache on failure. */
function networkFirstWithCache(request) {
  return fetch(request)
    .then((response) => {
      if (!response.ok) return response;
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => safeCachePut(cache, request, clone));
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached || Response.error()));
}

/**
 * Stale-while-revalidate: serve from cache immediately, update cache in background.
 * Next.js _next/static chunks are content-hashed (e.g. chunk-abc123.js),
 * so stale cache entries naturally expire when new chunks have different URLs.
 * This gives instant loads on repeat visits without ChunkLoadError risk.
 */
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            safeCachePut(cache, request, response.clone());
          }
          return response;
        })
        .catch(() => cached || Response.error());

      // Return cached immediately if available, otherwise wait for network
      return cached || fetchPromise;
    })
  );
}

// Fetch: network-first for navigation, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API & auth routes: network only (no caching)
  if (url.pathname.startsWith("/api/")) return;

  // Navigation (HTML pages): stale-while-revalidate for instant reload,
  // with offline fallback when both cache and network are unavailable.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) {
                safeCachePut(cache, request, response.clone());
              }
              return response;
            })
            .catch(() =>
              cached || caches.match("/offline.html").then((r) => r || Response.error())
            );

          // Return cached HTML instantly if available, otherwise wait for network
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Icons and images: cache-first (these are stable across deployments)
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (!response.ok) return response;
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => safeCachePut(cache, request, clone));
            return response;
          })
      )
    );
    return;
  }

  // JS/CSS chunks (_next/static): stale-while-revalidate
  // Content-hashed filenames mean stale entries are harmless — new deployments
  // produce new URLs, so old cached chunks simply stop being requested.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else (_next/data, etc.): network-first with cache fallback
  event.respondWith(networkFirstWithCache(request));
});
