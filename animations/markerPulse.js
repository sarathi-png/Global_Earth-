// MarkerPulse — expanding alert rings, MapLibre edition.
// One shared source (src-pulse) + one ring layer; a 20fps loop recomputes
// per-point radius/alpha in JS and pushes them as feature properties
// (paint expressions cannot read wall-clock). Same create/remove API.
const PulseEngine = {
    _points: [],   // {id, lng, lat, color, base, phase}
    _timer: null,

    ensure() {
        if (typeof GlobeManager === 'undefined') return;
        GlobeManager.ensureGeoSource('src-pulse', null);
        GlobeManager.addLayerOnce({
            id: 'pulse-ring', type: 'circle', source: 'src-pulse',
            paint: {
                'circle-radius': ['coalesce', ['get', '_rad'], 10],
                'circle-color': ['coalesce', ['get', 'color'], '#ff3b30'],
                'circle-opacity': ['coalesce', ['get', '_a'], 0.4],
                'circle-stroke-width': 1.5,
                'circle-stroke-color': ['coalesce', ['get', 'color'], '#ff3b30'],
                'circle-stroke-opacity': ['coalesce', ['get', '_a'], 0.4]
            }
        });
    },

    _hexRgb(hex) {
        try {
            const h = String(hex || '#ff3b30').replace('#', '');
            const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
            return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
        } catch (_) { return [255, 59, 48]; }
    },

    add(entity) {
        if (!entity || !entity.properties) return;
        const p = entity.properties;
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
        this.remove(entity.id);
        const sev = String(p.severity || 'Low');
        const base = (sev === 'Critical' || sev === 'Extreme') ? 12 : (sev === 'High' ? 10 : 8);
        this._points.push({
            id: entity.id, lng: p.lng, lat: p.lat,
            color: p.color || '#ff3b30', base: base,
            phase: Math.random() * 3
        });
        this.ensure();
        this.start();
    },

    remove(entityId) {
        if (!entityId) return;
        const before = this._points.length;
        this._points = this._points.filter((pt) => pt.id !== entityId);
        if (this._points.length !== before && !this._points.length) this.stop();
    },

    clear() {
        this._points = [];
        this.stop();
        if (typeof GlobeManager !== 'undefined') GlobeManager.setGeoData('src-pulse', null);
    },

    start() {
        if (this._timer || !this._points.length) return;
        this.ensure();
        this._timer = setInterval(() => this.tick(), 50);
    },

    stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    tick() {
        if (!this._points.length || typeof GlobeManager === 'undefined') return;
        const now = performance.now() / 1000;
        const features = this._points.map((pt) => {
            const t = ((now + pt.phase) % 3) / 3;
            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
                properties: {
                    color: pt.color,
                    _rad: pt.base * (0.3 + t * 2.5),
                    _a: Math.max(0, 0.5 * (1 - t))
                }
            };
        });
        GlobeManager.setGeoData('src-pulse', { type: 'FeatureCollection', features });
    }
};

const MarkerPulse = {
    create(entity) {
        if (!entity) return;
        try { PulseEngine.add(entity); } catch (_) {}
    },
    remove(entityId) {
        try { PulseEngine.remove(entityId); } catch (_) {}
    },
    clear() {
        try { PulseEngine.clear(); } catch (_) {}
    }
};

window.MarkerPulse = MarkerPulse;
window.PulseEngine = PulseEngine;
