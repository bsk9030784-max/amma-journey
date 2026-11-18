const CACHE = 'amma-journey-v1';
const BIG_FILES = /mediapipe|storage\.googleapis\.com/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('https:')) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Big tracking files never change, so use the saved copy first.
      if (BIG_FILES.test(req.url)) {
        const saved = await cache.match(req);
        if (saved) return saved;
      }
      // Everything else: newest version first, saved copy only when offline.
      try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        const saved = await cache.match(req);
        if (saved) return saved;
        throw err;
      }
    })()
  );
});