// Service Worker: macht die App offline-fähig (PWA).
// Strategie: Stale-while-revalidate für eigene Dateien – sofortige Antwort aus
// dem Cache, im Hintergrund wird aktualisiert. CDN-Anfragen (Tesseract, pdf.js,
// Supabase) laufen normal übers Netz.

const CACHE = "aimg-shell-v1";
const KERN = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(KERN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // CDN & APIs: nur Netz
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const imCache = await cache.match(e.request);
      const netz = fetch(e.request).then(antwort => {
        if (antwort && antwort.status === 200) cache.put(e.request, antwort.clone());
        return antwort;
      }).catch(() => imCache); // offline: was da ist
      return imCache || netz;
    })
  );
});
