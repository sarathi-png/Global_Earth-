// AircraftLayer — live ADS-B as MapLibre symbols (OSIRIS pattern: canvas
// plane icon, icon-rotate by heading, callsign labels).
const AircraftLayer = {
    entities: [],
    entitiesById: {},
    visible: false,
    _key: 'aircraft',
    _initialized: false,
    _setup: false,
    refreshTimer: null,
    REFRESH_INTERVAL: 30000,

    init() {
        if (!this.visible) return;
        console.log('Aircraft Layer Initialized (Live ADS-B)');
        this.setup();
        this.refresh();
        this.startAutoRefresh();
    },

    setup() {
        if (this._setup || typeof GlobeManager === 'undefined') return;
        this._setup = true;
        GlobeManager.ensureGeoSource('src-aircraft', null);
        GlobeManager.addImage('plane-cyan', this.createPlaneCanvas('#00e5ff', 28));
        GlobeManager.addLayerOnce({
            id: 'aircraft-sym', type: 'symbol', source: 'src-aircraft',
            layout: {
                'icon-image': 'plane-cyan',
                'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 5, 0.8, 10, 1.1],
                'icon-rotate': ['coalesce', ['get', 'heading'], 0],
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
            },
            paint: { 'icon-opacity': 0.9 }
        });
        GlobeManager.addLayerOnce({
            id: 'aircraft-label', type: 'symbol', source: 'src-aircraft',
            minzoom: 5,
            layout: {
                'text-field': ['get', 'title'],
                'text-size': 9,
                'text-font': ['Noto Sans Regular', 'Open Sans Regular'],
                'text-offset': [0, 1.6],
                'text-allow-overlap': false
            },
            paint: {
                'text-color': '#9cdef2',
                'text-halo-color': '#000000',
                'text-halo-width': 1.5,
                'text-opacity': 0.85
            }
        });
        GlobeManager.registerPickable('aircraft-sym', this);
        this.applyVisibility();
    },

    createPlaneCanvas(color, size) {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2, cy = size / 2;
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.4);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx, cy + size * 0.35);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        return canvas;
    },

    startAutoRefresh() {
        if (this.refreshTimer) return;
        this.refreshTimer = setInterval(() => {
            if (document.hidden || !this.visible) return;
            this.refresh();
        }, this.REFRESH_INTERVAL);
    },

    async refresh() {
        if (!navigator.onLine || !this.visible) return;
        try {
            const center = GlobeManager.getCenter ? GlobeManager.getCenter() : { lat: 20, lng: 0 };
            const radius = 500;
            const url = 'https://api.airplanes.live/v2/point/' + center.lat + '/' + center.lng + '/' + radius;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const aircraft = data && data.ac ? data.ac.slice(0, 150) : [];
            this.renderAircraft(aircraft);
        } catch (e) {
            console.warn('ADS-B fetch failed:', e.message);
            if (this.entities.length === 0) this.renderSimulated();
        }
    },

    renderAircraft(aircraft) {
        this.clearEntities();
        if (!GlobeManager.map) return;
        aircraft.forEach(ac => {
            try {
                const lat = ac.lat || (ac.geom && ac.geom.latitude);
                const lng = ac.lon || (ac.geom && ac.geom.longitude);
                const altM = (ac.alt_baro || ac.alt_geom || 10000) * 0.3048;
                const callSign = String(ac.flight || ac.hex || 'UNKNOWN').trim();
                const heading = Number(ac.track || 0);
                const speed = Number(ac.gs || 0);
                if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
                const entity = MarkerFactory.createPoint({
                    id: 'ac-' + (ac.hex || callSign),
                    title: callSign,
                    type: 'aircraft',
                    description: 'Callsign: ' + callSign + '\n' +
                        'Altitude: ' + Math.round(altM) + 'm (' + Math.round(altM * 3.281) + 'ft)\n' +
                        'Speed: ' + speed.toFixed(0) + ' kts\n' +
                        'Heading: ' + heading.toFixed(0) + '°\n' +
                        'Squawk: ' + (ac.squawk || 'N/A') + '\n' +
                        'Source: ADS-B',
                    year: new Date().getFullYear(),
                    severity: 'Low',
                    lat, lng,
                    heading
                }, '#00e5ff', this._key);
                entity.show = this.visible;
                this.entities.push(entity);
            } catch (e) { /* skip bad aircraft */ }
        });
        this.sync();
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    renderSimulated() {
        this.clearEntities();
        if (!GlobeManager.map) return;
        const hubs = [
            { name: 'JFK', lat: 40.6413, lng: -73.7781 },
            { name: 'LHR', lat: 51.4700, lng: -0.4543 },
            { name: 'HND', lat: 35.5494, lng: 139.7798 },
            { name: 'DXB', lat: 25.2532, lng: 55.3657 },
            { name: 'SIN', lat: 1.3644, lng: 103.9915 }
        ];
        for (let i = 0; i < 5; i++) {
            const hub = hubs[Math.floor(Math.random() * hubs.length)];
            const lat = hub.lat + (Math.random() - 0.5) * 30;
            const lng = hub.lng + (Math.random() - 0.5) * 30;
            const id = 'SIM-FLIGHT-' + (800 + i);
            const entity = MarkerFactory.createPoint({
                id, title: id, type: 'aircraft',
                description: 'Simulated flight. ADS-B unavailable.',
                year: new Date().getFullYear(), severity: 'Low',
                lat, lng, heading: Math.random() * 360
            }, '#888888', this._key);
            entity.show = this.visible;
            this.entities.push(entity);
        }
        this.sync();
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    sync() {
        const features = [];
        const idx = {};
        this.entities.forEach((e) => {
            if (!e || e.show === false) return;
            const p = e.properties || {};
            idx[e.id] = e;
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                properties: Object.assign({}, p, { _eid: e.id, _key: this._key })
            });
        });
        this.entitiesById = idx;
        this.setup();
        GlobeManager.setCustomData('src-aircraft', this, features);
        this.applyVisibility();
    },

    applyVisibility() {
        GlobeManager.setLayerVisible('aircraft-sym', this.visible);
        GlobeManager.setLayerVisible('aircraft-label', this.visible);
    },

    clearEntities() {
        this.entities = [];
        this.entitiesById = {};
        GlobeManager.setCustomData('src-aircraft', this, []);
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show && this.entities.length === 0 && !this._initialized) {
            this._initialized = true;
            this.init();
            return;
        } else if (show) {
            this.setup();
            this.refresh();
        } else {
            this.clearEntities();
            if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
        }
        this.applyVisibility();
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    destroy() {
        if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
        this.clearEntities();
    }
};

window.AircraftLayer = AircraftLayer;
