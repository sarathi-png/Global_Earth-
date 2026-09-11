// RippleArcLayer — expanding alert rings + glow arcs between severe events.
// Rings animate via a 20fps timer rewriting radius/alpha feature properties
// (same mechanism as PulseEngine); arcs are static glow line strings.
const RippleArcLayer = {
    visible: false,
    _initialized: false,
    _setup: false,
    _timer: null,
    _t0: 0,
    _rings: [],

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        this.setup();
        console.log('RippleArcLayer initialized');
    },

    setup() {
        if (this._setup || typeof GlobeManager === 'undefined') return;
        this._setup = true;
        GlobeManager.ensureGeoSource('src-ripple', null);
        GlobeManager.ensureGeoSource('src-ripple-arcs', null);
        GlobeManager.addLayerOnce({
            id: 'ripple-ring', type: 'circle', source: 'src-ripple',
            paint: {
                'circle-radius': ['coalesce', ['get', '_rad'], 12],
                'circle-color': ['coalesce', ['get', 'color'], '#ff9500'],
                'circle-opacity': 0,
                'circle-stroke-width': 2,
                'circle-stroke-color': ['coalesce', ['get', 'color'], '#ff9500'],
                'circle-stroke-opacity': ['coalesce', ['get', '_a'], 0.4]
            }
        });
        GlobeManager.addLayerOnce({
            id: 'ripple-arc-glow', type: 'line', source: 'src-ripple-arcs',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': ['coalesce', ['get', 'color'], '#ff9500'],
                'line-width': 3, 'line-opacity': 0.25, 'line-blur': 2
            }
        });
        GlobeManager.addLayerOnce({
            id: 'ripple-arc', type: 'line', source: 'src-ripple-arcs',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': ['coalesce', ['get', 'color'], '#ff9500'],
                'line-width': 1.5, 'line-opacity': 0.6
            }
        });
        this.applyVisibility();
    },

    async generateFromLiveEvents() {
        if (!GlobeManager.map || !this.visible) return;
        this.setup();
        this.clearAll(true);
        let events = [];
        if (typeof LiveLayer !== 'undefined' && LiveLayer._lastEvents) {
            events = LiveLayer._lastEvents;
        }
        if (!events.length) return;

        let critical = events.filter((e) => e.severity === 'Critical' || e.severity === 'High');
        critical = critical.slice(0, 20);

        const ringFeatures = [];
        critical.forEach((event) => {
            if (!isFinite(event.lat) || !isFinite(event.lng)) return;
            const color = event.severity === 'Critical' ? '#ff3b30' : '#ff9500';
            const rings = event.severity === 'Critical' ? 3 : 2;
            const base = event.severity === 'Critical' ? 14 : 11;
            for (let r = 0; r < rings; r++) {
                ringFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [Number(event.lng), Number(event.lat)] },
                    properties: { color, _base: base, _off: r * 1.0, _rad: base, _a: 0.4 }
                });
            }
        });
        this._rings = ringFeatures;
        GlobeManager.setGeoData('src-ripple', { type: 'FeatureCollection', features: ringFeatures });

        const arcFeatures = [];
        if (critical.length >= 2) {
            const pairs = [];
            const n = Math.min(critical.length, 8);
            for (let i = 0; i < n && pairs.length < 5; i++) {
                for (let j = i + 1; j < n && pairs.length < 5; j++) {
                    if (critical[i].category === critical[j].category || critical[i].source === critical[j].source) {
                        pairs.push([critical[i], critical[j]]);
                    }
                }
            }
            const palette = ['#ff9500', '#ff3b30', '#00b4ff'];
            pairs.forEach((pair, idx) => {
                const line = this.greatArc(pair[0], pair[1]);
                if (line) arcFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: line },
                    properties: { color: palette[idx % palette.length] }
                });
            });
        }
        GlobeManager.setGeoData('src-ripple-arcs', { type: 'FeatureCollection', features: arcFeatures });

        this.applyVisibility();
        this.startAnim();
    },

    // Great-circle-ish elevated arc sampled in lng/lat space.
    greatArc(a, b) {
        try {
            const coords = [];
            const segs = 30;
            for (let s = 0; s <= segs; s++) {
                const t = s / segs;
                let lng = a.lng + (b.lng - a.lng) * t;
                let lat = a.lat + (b.lat - a.lat) * t;
                // perpendicular bulge peaks mid-arc
                const bulge = Math.sin(t * Math.PI) * Math.min(25, Math.hypot(b.lng - a.lng, b.lat - a.lat) * 0.18);
                lat += bulge;
                coords.push([lng, lat]);
            }
            return coords;
        } catch (_) { return null; }
    },

    startAnim() {
        this.stopAnim();
        this._t0 = performance.now() / 1000;
        this._timer = setInterval(() => this.tick(), 50);
    },
    stopAnim() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },
    tick() {
        if (!this.visible || typeof GlobeManager === 'undefined' || !this._rings.length) return;
        const now = performance.now() / 1000 - this._t0;
        const feats = this._rings.map((f) => {
            const p = Object.assign({}, f.properties);
            const t = ((now + (p._off || 0)) % 3) / 3;
            p._rad = (p._base || 11) * (0.3 + t * 2.5);
            p._a = Math.max(0, 0.5 * (1 - t));
            return { type: 'Feature', geometry: f.geometry, properties: p };
        });
        GlobeManager.setGeoData('src-ripple', { type: 'FeatureCollection', features: feats });
    },

    applyVisibility() {
        GlobeManager.setLayerVisible('ripple-ring', this.visible);
        GlobeManager.setLayerVisible('ripple-arc-glow', this.visible);
        GlobeManager.setLayerVisible('ripple-arc', this.visible);
    },

    clearAll(silent) {
        this.stopAnim();
        this._rings = [];
        GlobeManager.setGeoData('src-ripple', null);
        GlobeManager.setGeoData('src-ripple-arcs', null);
        if (!silent) this.applyVisibility();
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show) {
            this.init();
            this.generateFromLiveEvents();
        } else {
            this.clearAll();
        }
    }
};

window.RippleArcLayer = RippleArcLayer;
