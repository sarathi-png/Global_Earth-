// ScaleBar — metric/imperial scale at the map center (OSIRIS ScaleBar parity).
// metersPerPixel = 156543.03 * cos(lat) / 2^zoom; snap to a 1/2/5 step.
const ScaleBar = {
    init() {
        this.fill = document.getElementById('scaleBarFill');
        this.label = document.getElementById('scaleBarLabel');
        if (!this.fill || !this.label) return;
        const update = () => this.update();
        if (GlobeManager.map) {
            try { GlobeManager.map.on('move', update); } catch (_) {}
        }
        // Re-bind once the engine is ready (boot order: UI may init first).
        const t = setInterval(() => {
            if (GlobeManager.map && !this._bound) {
                this._bound = true;
                try { GlobeManager.map.on('move', update); } catch (_) {}
                clearInterval(t);
            }
        }, 1000);
        setTimeout(() => clearInterval(t), 30000);
        this.update();
    },

    update() {
        if (!this.fill || !this.label || !GlobeManager.map) return;
        let zoom = 2, lat = 20;
        try {
            const c = GlobeManager.getCenter();
            zoom = c.zoom; lat = c.lat;
        } catch (_) {}
        const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
        const targetPx = 100;
        const raw = mpp * targetPx;
        const pow = Math.pow(10, Math.floor(Math.log10(raw)));
        const norm = raw / pow;
        const step = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
        const meters = step * pow;
        const px = Math.max(30, Math.round(meters / mpp));
        this.fill.style.width = px + 'px';
        this.label.textContent = meters >= 1000
            ? ((meters / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' km')
            : (Math.round(meters) + ' m');
    }
};
window.ScaleBar = ScaleBar;
