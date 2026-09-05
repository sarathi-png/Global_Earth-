// Cesium load detection + boot gate.
// Exposes window.__cesiumReady (resolves with 'local'|CDN source, rejects on timeout)
// so app boot can wait for late CDN fallbacks instead of racing them.
(function () {
  var TIMEOUT_MS = 12000;

  var resolveFn, rejectFn;
  window.__cesiumReady = new Promise(function (resolve, reject) {
    resolveFn = resolve; rejectFn = reject;
  });

  var settled = false;
  function settle() {
    if (settled) return;
    if (typeof window.Cesium !== 'undefined') {
      settled = true;
      resolveFn(window.CESIUM_SOURCE || 'unknown');
      var banner = document.getElementById('cesium-fallback-banner');
      if (banner) banner.remove();
    }
  }

  if (typeof window.Cesium !== 'undefined') settle();
  var poller = setInterval(settle, 100);

  setTimeout(function () {
    clearInterval(poller);
    if (settled || typeof window.Cesium !== 'undefined') { settle(); return; }
    settled = true;
    rejectFn(new Error('Cesium did not load within timeout'));
    var globeContainer = document.getElementById('globeContainer');
    if (document.getElementById('cesium-fallback-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'cesium-fallback-banner';
    banner.className = 'glass-panel globe-fatal';
    banner.innerHTML =
      '<i class="fas fa-exclamation-triangle globe-fatal-icon"></i>' +
      '<h3>3D Library Unavailable</h3>' +
      '<p class="globe-fatal-detail">CesiumJS did not load within ' + Math.round(TIMEOUT_MS / 1000) +
      's (local bundle + CDN fallbacks blocked). Search, timeline and saved views still work once the library loads.</p>' +
      '<div class="globe-fatal-actions">' +
      '<button class="fatal-retry-btn" onclick="location.reload()">' +
      '<i class="fas fa-rotate-right"></i> Retry</button></div>';
    if (globeContainer && globeContainer.parentNode) {
      globeContainer.parentNode.insertBefore(banner, globeContainer.nextSibling);
    } else {
      document.body.appendChild(banner);
    }
    console.warn('[Fallback] Cesium did not load within timeout. Showing retry UI.');
  }, TIMEOUT_MS);
})();
