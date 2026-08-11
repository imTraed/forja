/**
 * Service worker: la app entera queda en caché para que abra sin datos en el
 * gimnasio. Las animaciones vienen de GitHub y se guardan según se ven.
 */
/**
 * Al tocar cualquier archivo de la app hay que subir este número. Si no, el
 * móvil sigue abriendo la versión que ya tenía guardada y los cambios no se
 * ven nunca.
 */
const SHELL = 'forja-shell-v9';
const MEDIA = 'forja-media-v1';
const MEDIA_HOST = 'raw.githubusercontent.com';

const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'assets/icon.svg',
  'js/app.js',
  'js/store.js',
  'js/lib/ui.js',
  'js/data/catalog.js',
  'js/data/i18n.js',
  'js/data/splits.js',
  'js/data/foods.json',
  'js/data/exercises.min.json',
  'js/engine/progression.js',
  'js/engine/coach.js',
  'js/engine/nutrition.js',
  'js/engine/timer.js',
  'js/engine/generator.js',
  'js/engine/chequeo.js',
  'js/views/onboarding.js',
  'js/views/hoy.js',
  'js/views/rutinas.js',
  'js/views/entreno.js',
  'js/views/wizard.js',
  'js/views/yo.js',
  'js/views/chequeo.js',
  'js/views/comida.js',
  'js/views/ajustes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      // addAll falla entero si un archivo falla; se piden de uno en uno.
      .then((c) => Promise.all(ARCHIVOS.map((f) => c.add(f).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Imágenes y GIFs del dataset: primero caché, y si no está, red.
  if (url.hostname === MEDIA_HOST) {
    e.respondWith(
      caches.open(MEDIA).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return new Response('', { status: 504 });
        }
      }),
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Navegaciones: siempre el shell, que la app es de una sola página.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(SHELL).then((c) => c.put('index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  // Resto de recursos propios: caché primero, y se refresca por detrás.
  e.respondWith(
    caches.match(request).then((hit) => {
      const red = fetch(request).then((res) => {
        if (res.ok) caches.open(SHELL).then((c) => c.put(request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || red;
    }),
  );
});
