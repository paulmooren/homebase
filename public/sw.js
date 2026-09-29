// Deliberately minimal — exists to satisfy PWA installability criteria and
// to give a future push-notification phase something to extend (push /
// notificationclick handlers). No caching strategy: every fetch just
// passes through to the network, so this never masks stale content.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
