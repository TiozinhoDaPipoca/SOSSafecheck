// SafeCheck SOS — Service Worker
// Permite funcionamento offline e instalação como app

const CACHE_NAME = 'safecheck-sos-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/data.js',
  '/js/app.js',
  '/js/sos.js',
  '/js/contacts.js',
  '/js/history.js',
  '/js/volume.js',
  '/js/auth.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;900&display=swap',
];

// Instala e faz cache dos assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS.map(url => {
        // Ignora erros em assets externos
        return cache.add(url).catch(() => {});
      }));
    })
  );
  self.skipWaiting();
});

// Remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia: network first, fallback para cache
self.addEventListener('fetch', (event) => {
  // Não intercepta chamadas de API
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Atualiza cache com versão mais recente
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // Sem internet — usa cache
        return caches.match(event.request);
      })
  );
});
