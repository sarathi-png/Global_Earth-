// MapLibre load detection + boot gate.
// Exposes window.__maplibreReady (resolves with 'local'|CDN source, rejects on timeout)
// so app boot can wait for late CDN fallbacks instead of racing them.
(function () {
  var TIMEOUT_MS = 12000;

  var resolveFn, rejectFn;
  window.__maplibreReady = new Promise(function (resolve, reject) {
    resolveFn = resolve; rejectFn = reject;
  });

  var settled = false;
  function settle() {
    if (settled) return;
    if (typeof window.maplibregl !== 'undefined') {
      settled = true;
      resolveFn(window.MAPLIBRE_SOURCE || 'unknown');
      var banner = document.getElementById('maplibre-fallback-banner');
      if (banner) banner.remove();
    }
  }

  if (typeof window.maplibregl !== 'undefined') settle();
  var poller = setInterval(settle, 100);

  setTimeout(function () {
    clearInterval(poller);
    if (settled || typeof window.maplibregl !== 'undefined') { settle(); return; }
    settled = true;
    rejectFn(new Error('MapLibre did not load within timeout'));
    var globeContainer = document.getElementById('globeContainer');
    if (document.getElementById('maplibre-fallback-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'maplibre-fallback-banner';
    banner.className = 'glass-panel globe-fatal';
    banner.innerHTML =
      '<i class="fas fa-exclamation-triangle globe-fatal-icon"></i>' +
      '<h3>3D Library Unavailable</h3>' +
      '<p class="globe-fatal-detail">MapLibre GL did not load within ' + Math.round(TIMEOUT_MS / 1000) +
      's (local bundle + CDN fallbacks blocked). Check your connection or ad/script blocker, then retry.</p>' +
      '<div class="globe-fatal-actions">' +
      '<button class="fatal-retry-btn" onclick="location.reload()">' +
      '<i class="fas fa-rotate-right"></i> Retry</button></div>';
    if (globeContainer && globeContainer.parentNode) {
      globeContainer.parentNode.insertBefore(banner, globeContainer.nextSibling);
    } else {
      document.body.appendChild(banner);
    }
    console.warn('[Fallback] MapLibre did not load within timeout. Showing retry UI.');
  }, TIMEOUT_MS);
})();
