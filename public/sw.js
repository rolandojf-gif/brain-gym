/* Service worker de BRAIN.GYM: guarda la app para que abra sin conexión. Los datos no pasan por aquí (viven en
   IndexedDB) y /api/ nunca se guarda en caché.
   - Navegación: red primero; sin red, la última index.html guardada.
   - /assets/* (nombres con hash, inmutables): caché primero.
   - Resto del mismo origen: red primero con copia en caché.
   Las peticiones a otros orígenes (fuentes de Google) no se interceptan. */
const CACHE = 'bg-v2';
const BASE = ['/', '/index.html', '/theme-init.js', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function redPrimero(req, respaldo) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(respaldo ?? req, res.clone());
    return res;
  } catch (err) {
    const guardada = await cache.match(respaldo ?? req);
    if (guardada) return guardada;
    throw err;
  }
}

async function cachePrimero(req) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') e.respondWith(redPrimero(req, '/index.html'));
  else if (url.pathname.startsWith('/assets/')) e.respondWith(cachePrimero(req));
  else e.respondWith(redPrimero(req));
});
