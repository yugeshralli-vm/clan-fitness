// Minimal service worker: exists only to satisfy PWA "installable" criteria
// (Chrome/Android requires a registered service worker with a fetch handler).
// Deliberately does not cache or intercept anything — no offline support yet.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No-op: let the browser handle every request normally.
});
