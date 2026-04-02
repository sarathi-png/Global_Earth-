// Fallback script for Cesium load detection
(function () {
  const timeout = 2000; // ms to wait for Cesium to load
  let cesiumLoaded = false;

  // Check if Cesium is already defined (maybe loaded synchronously)
  if (window.Cesium) {
    cesiumLoaded = true;
  }

  // Poll for a short period
  const poller = setInterval(() => {
    if (window.Cesium) {
      cesiumLoaded = true;
      clearInterval(poller);
    }
  }, 100);

  // After timeout, if still not loaded, show fallback
  setTimeout(() => {
    clearInterval(poller);
    if (!cesiumLoaded) {
      // Create fallback banner
      const banner = document.createElement('div');
      banner.id = 'cesium-fallback-banner';
      banner.style = `
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.7);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        font-family: sans-serif;
        pointer-events: none;
      `;
      banner.textContent = '3D globe unavailable – showing limited view.';
      // Insert after globeContainer if exists
      const globeContainer = document.getElementById('globeContainer');
      if (globeContainer) {
        globeContainer.parentNode.insertBefore(banner, globeContainer.nextSibling);
        // Optionally hide the globe container
        globeContainer.style.display = 'none';
      } else {
        // Fallback: append to body
        document.body.appendChild(banner);
      }
      // Log to console
      console.warn('[Fallback] Cesium did not load within timeout. Showing fallback UI.');
    }
  }, timeout);
})();