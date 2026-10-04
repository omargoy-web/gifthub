/* Service worker: app shell + censo en caché para operación sin red en campo.
   Las llamadas a Google y /api/* nunca se cachean. */
const VERSION = "apie-v1";
const SHELL = [
  "./", "index.html", "legal.html", "manifest.webmanifest", "css/apie.css", "icons/icon.svg",
  "js/config.js", "js/store.js", "js/ui.js", "js/data.js", "js/google.js", "js/ai.js", "js/app.js",
  "js/screens/dashboard.js", "js/screens/tasks.js", "js/screens/calendar.js", "js/screens/assets.js",
  "js/screens/knowledge.js", "js/screens/learning.js", "data/seed.js",
];
self.addEventListener("install", (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.includes("/api/")) return;
  // Red primero para HTML/JS/CSS (actualizaciones), caché como respaldo offline.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
