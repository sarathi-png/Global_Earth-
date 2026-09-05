const CACHE_NAME = 'geo-intel-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/globe.css',
  '/css/sidebar.css',
  '/css/popup.css',
  '/css/timeline.css',
  '/css/search.css',
  '/css/layers.css',
  '/css/animations.css',
  '/css/responsive.css',
  '/css/notifications.css',
  '/css/layout.css',
  '/css/fonts.css',
  '/vendor/cesium/Cesium.js',
  '/vendor/cesium/Widgets/widgets.css',
  '/assets/textures/earth-texture.jpg',
  '/js/config.js',
  '/js/app.js',
  '/js/liveApi.js',
  '/js/debugger.js',
  '/js/fallback.js',
  '/core/globe.js',
  '/core/camera.js',
  '/core/terrain.js',
  '/core/controls.js',
  '/layers/disastersLayer.js',
  '/layers/warsLayer.js',
  '/layers/mysteryLayer.js',
  '/layers/historicalLayer.js',
  '/layers/aircraftLayer.js',
  '/layers/satelliteLayer.js',
  '/layers/weatherLayer.js',
  '/layers/bordersLayer.js',
  '/layers/liveLayer.js',
  '/layers/dayNightLayer.js',
  '/layers/heatmapLayer.js',
  '/layers/rippleArcLayer.js',
  '/layers/streetViewLayer.js',
  '/layers/osirisLayer.js',
  '/js/notifications.js',
  '/js/statsDashboard.js',
  '/incidents/markers.js',
  '/incidents/hoverPopup.js',
  '/incidents/clustering.js',
  '/search/searchEngine.js',
  '/search/searchUI.js',
  '/timeline/timeline.js',
  '/ui/drawer.js',
  '/animations/markerPulse.js',
  '/data/disasters.json',
  '/data/wars.json',
  '/data/mysteries.json',
  '/data/historical-events.json',
  '/data/countries.geo.json',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
