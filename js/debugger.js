// Minimal diagnostics to help verify that the page loads and key UI elements exist.
// Enabled by default; can be limited via URL param ?debug=false if needed.
(function(){
  // Simple flag to control verbosity without changing code paths.
  var debug = true;
  if (!debug) return;

  function log(msg, obj){
    if (obj !== undefined) console.log('[Diagnostics] ' + msg, obj);
    else console.log('[Diagnostics] ' + msg);
  }

  function onReady(){
    try {
      // Check essential DOM elements exist
      var elements = [
        'globeContainer',
        'searchBar',
        'sidebar',
        'rightDrawer',
      ];
      var missing = [];
      elements.forEach(function(id){
        if (!document.getElementById(id)) missing.push(id);
      });
      if (missing.length > 0){
        log('Missing DOM elements:', missing);
      } else {
        log('All key DOM elements present.');
      }

      // MapLibre presence check
      if (window.maplibregl) {
        log('MapLibre is loaded. Source:', window.MAPLIBRE_SOURCE || 'unknown');
      } else {
        log('MapLibre is not loaded yet. Globe rendering may fail.');
      }
    } catch (e) {
      console.error('[Diagnostics] Error during readiness checks:', e);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    onReady();
  } else {
    document.addEventListener('DOMContentLoaded', onReady);
  }

  // Global error logger for uncaught errors
  window.addEventListener('error', function(ev){
    console.error('[Diagnostics] Uncaught error:', ev.message, 'at', ev.filename + ':' + ev.lineno + ':' + ev.colno);
  });
})();
