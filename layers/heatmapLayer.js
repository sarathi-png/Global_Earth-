// HeatmapLayer — MapLibre native heatmap over live events (severity-weighted).
const HeatmapLayer = {
    entities: [],
    entitiesById: {},
    visible: false,
    _initialized: false,
    _setup: false,

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        this.setup();
        console.log('HeatmapLayer initialized');
    },

    setup() {
        if (this._setup || typeof GlobeManager === 'undefined') return;
        this._setup = true;
        GlobeManager.ensureGeoSource('src-heatmap', null);
        GlobeManager.addLayerOnce({
            id: 'heatmap-heat', type: 'heatmap', source: 'src-heatmap',
            maxzoom: 9,
            paint: {
                'heatmap-weight': ['coalesce', ['get', 'w'], 0.5],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.2, 'rgba(52,199,89,0.5)',
                    0.4, 'rgba(255,204,0,0.6)',
                    0.6, 'rgba(255,149,0,0.7)',
                    0.8, 'rgba(255,59,48,0.8)',
                    1, 'rgba(255,59,48,0.95)'
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 9, 30],
                'heatmap-opacity': 0.85
            }
        });
        this.applyVisibility();
    },

    sevWeight(sev) {
        return sev === 'Critical' || sev === 'Extreme' ? 1
            : sev === 'High' ? 0.75
            : (sev === 'Moderate' || sev === 'Medium') ? 0.5 : 0.25;
    },

    async generateFromLiveEvents() {
        if (!GlobeManager.map || !this.visible) return;
        this.setup();
        this.entities = [];
        let events = [];
        if (typeof LiveLayer !== 'undefined' && LiveLayer._lastEvents) {
            events = LiveLayer._lastEvents;
        }
        const features = [];
        (events || []).forEach((e, i) => {
            if (!e || !isFinite(e.lat) || !isFinite(e.lng)) return;
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [Number(e.lng), Number(e.lat)] },
                properties: { w: this.sevWeight(e.severity) }
            });
            this.entities.push({ id: 'heat-' + i, show: true, properties: { id: 'heat-' + i, type: 'heatmap' } });
        });
        this.entitiesById = {};
        GlobeManager.setGeoData('src-heatmap', { type: 'FeatureCollection', features });
        this.applyVisibility();
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    applyVisibility() {
        GlobeManager.setLayerVisible('heatmap-heat', this.visible);
    },

    clearEntities() {
        this.entities = [];
        this.entitiesById = {};
        GlobeManager.setGeoData('src-heatmap', null);
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show) {
            this.init();
            this.generateFromLiveEvents();
        } else {
            this.applyVisibility();
        }
    }
};

window.HeatmapLayer = HeatmapLayer;
