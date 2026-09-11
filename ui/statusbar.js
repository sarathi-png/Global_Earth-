// StatusBar — bottom live readout (OSIRIS GlobalStatusBar parity):
// live-source state · visible event count · projection/basemap · cursor coords.
const StatusBar = {
    init() {
        this.elLive = document.getElementById('stLive');
        this.elEvents = document.getElementById('stEvents');
        this.elView = document.getElementById('stView');
        this.elCoords = document.getElementById('stCoords');
        if (!this.elLive) return;
        this._queued = null;
        this._raf = false;
        const bindMouse = () => {
            try {
                if (GlobeManager.map && !this._mouseBound) {
                    this._mouseBound = true;
                    GlobeManager.map.on('mousemove', (e) => {
                        this._queued = e.lngLat;
                        if (this._raf) return;
                        this._raf = true;
                        requestAnimationFrame(() => {
                            this._raf = false;
                            if (this._queued && this.elCoords) {
                                this.elCoords.textContent =
                                    this._queued.lat.toFixed(3) + ', ' + this._queued.lng.toFixed(3);
                            }
                        });
                    });
                    GlobeManager.map.on('mouseout', () => {
                        if (this.elCoords) this.elCoords.textContent = '—, —';
                    });
                }
            } catch (_) {}
        };
        bindMouse();
        const t = setInterval(bindMouse, 2000);
        setTimeout(() => clearInterval(t), 60000);
        setInterval(() => this.update(), 2000);
        this.update();
    },

    update() {
        if (!this.elLive) return;
        try {
            // Live source state mirrors the sidebar badge.
            const src = document.getElementById('liveDataStatus');
            const txt = src ? src.textContent : 'Offline';
            this.elLive.textContent = '● ' + txt;
            const cls = src ? src.className : '';
            this.elLive.className = /online/.test(cls) ? 'st-ok' : (/partial|loading/.test(cls) ? 'st-warn' : (/error/.test(cls) ? 'st-err' : ''));
            // Visible event total mirrors the sidebar counter.
            const total = document.getElementById('activeMarkerCount');
            this.elEvents.textContent = (total ? total.textContent : '0') + ' events';
            // Projection + basemap tags.
            const proj = (typeof GlobeManager !== 'undefined' && GlobeManager.getProjection) ? GlobeManager.getProjection() : 'globe';
            const sv = document.getElementById('toggleStreetView');
            const base = (sv && sv.checked) ? 'sat' : 'dark';
            this.elView.textContent = (proj === 'globe' ? '3D' : '2D') + ' · ' + base;
        } catch (_) {}
    }
};
window.StatusBar = StatusBar;
