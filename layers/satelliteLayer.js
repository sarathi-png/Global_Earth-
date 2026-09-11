// SatelliteLayer — CelesTrak positions ground-projected as MapLibre
// dots + labels (OSIRIS draws 19k sats at altitude via a custom WebGL layer;
// with ≤80 points, ground-projected circles read identically and stay cheap).
const SatelliteLayer = {
    entities: [],
    entitiesById: {},
    visible: false,
    _key: 'sat',
    _initialized: false,
    _pointOpts: { cluster: false, labelMinzoom: 4 },
    refreshTimer: null,

    init() {
        if (!this.visible) return;
        console.log('Satellite Layer Initialized (CelesTrak Live)');
        this.refresh();
        this.startAutoRefresh();
    },

    startAutoRefresh() {
        if (this.refreshTimer) return;
        this.refreshTimer = setInterval(() => {
            if (document.hidden || !this.visible) return;
            this.refresh();
        }, 120000);
    },

    async refresh() {
        if (!navigator.onLine || !this.visible) return;
        try {
            const url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json';
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const sats = data && data.satellites ? data.satellites.slice(0, 80) : [];
            this.renderSatellites(sats);
        } catch (e) {
            console.warn('CelesTrak fetch failed:', e.message);
            if (this.entities.length === 0) this.renderSimulated();
        }
    },

    // Keplerian propagation → ECI (metres) → geodetic via GMST rotation.
    propagateLatLng(sat) {
        const now = Date.now();
        const jd = 2440587.5 + now / 86400000;
        const deg2rad = Math.PI / 180;

        const n = (sat.meanMotion || 15.5) * 2 * Math.PI / 86400; // rad/s
        const a = Math.pow(398600.4418 / (n * n), 1 / 3);          // km
        const e = sat.eccentricity || 0.001;
        const i = (sat.inclination || 51.6) * deg2rad;
        const raan = (sat.rightAscensionOfMeanNode || 0) * deg2rad;
        const argP = (sat.argumentOfPerigee || 0) * deg2rad;
        const M = (((sat.meanAnomaly || 0) * deg2rad + n * (now / 1000)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

        let E = M;
        for (let j = 0; j < 10; j++) E = M + e * Math.sin(E);
        const cosV = (Math.cos(E) - e) / (1 - e * Math.cos(E));
        const sinV = (Math.sqrt(1 - e * e) * Math.sin(E)) / (1 - e * Math.cos(E));
        const v = Math.atan2(sinV, cosV);
        const r = a * (1 - e * Math.cos(E)); // km

        const xO = r * Math.cos(v), yO = r * Math.sin(v);
        const cR = Math.cos(raan), sR = Math.sin(raan);
        const cA = Math.cos(argP), sA = Math.sin(argP);
        const cI = Math.cos(i), sI = Math.sin(i);
        const x = (cR * cA - sR * sA * cI) * xO + (-cR * sA - sR * cA * cI) * yO;
        const y = (sR * cA + cR * sA * cI) * xO + (-sR * sA + cR * cA * cI) * yO;
        const z = (sA * sI) * xO + (cA * sI) * yO;

        // ECI → ECEF → geodetic (spherical-earth approximation)
        const T = (jd - 2451545.0) / 36525.0;
        let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T;
        gmst = (((gmst % 360) + 360) % 360) * deg2rad;
        const cG = Math.cos(gmst), sG = Math.sin(gmst);
        const xe = x * cG + y * sG, ye = -x * sG + y * cG, ze = z;
        const rr = Math.sqrt(xe * xe + ye * ye + ze * ze);
        return {
            lat: Math.asin(ze / rr) / deg2rad,
            lng: Math.atan2(ye, xe) / deg2rad,
            altKm: rr - 6371
        };
    },

    renderSatellites(sats) {
        this.clearEntities();
        if (!GlobeManager.map) return;
        const year = new Date().getFullYear();
        sats.forEach(sat => {
            try {
                const ll = this.propagateLatLng(sat);
                if (!isFinite(ll.lat) || !isFinite(ll.lng)) return;
                const name = String(sat.name || sat.OBJECT_NAME || 'SAT').trim();
                const noradId = sat.noradCatId || sat.NORAD_CAT_ID || '???';
                const alt = isFinite(ll.altKm) ? ll.altKm : (sat.semimajorAxis ? (sat.semimajorAxis - 6371) : 400);
                const entity = MarkerFactory.createPoint({
                    id: 'sat-' + noradId,
                    title: name.substring(0, 40),
                    type: 'satellite',
                    description: 'NORAD ID: ' + noradId + '\n' +
                        'Inclination: ' + (sat.inclination || 0).toFixed(1) + '°\n' +
                        'Altitude: ~' + Math.round(alt) + 'km\n' +
                        'Period: ' + (sat.orbitalPeriod ? (sat.orbitalPeriod / 60).toFixed(1) : 'N/A') + ' min\n' +
                        'Source: CelesTrak',
                    year, severity: 'Low',
                    lat: ll.lat, lng: ll.lng
                }, '#ff9500', this._key);
                entity.show = this.visible;
                this.entities.push(entity);
            } catch (e) { /* skip */ }
        });
        GlobeManager.syncLayer(this, this._key);
        GlobeManager.setGroupVisible(this._key, this.visible);
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    renderSimulated() {
        this.clearEntities();
        if (!GlobeManager.map) return;
        const year = new Date().getFullYear();
        for (let i = 0; i < 10; i++) {
            const id = 'SIM-SAT-' + (100 + i);
            const entity = MarkerFactory.createPoint({
                id, title: id, type: 'satellite',
                description: 'Simulated satellite. CelesTrak unavailable.',
                year, severity: 'Low',
                lat: (Math.random() - 0.5) * 140,
                lng: (Math.random() - 0.5) * 340
            }, '#666666', this._key);
            entity.show = this.visible;
            this.entities.push(entity);
        }
        GlobeManager.syncLayer(this, this._key);
        GlobeManager.setGroupVisible(this._key, this.visible);
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    clearEntities() {
        this.entities = [];
        this.entitiesById = {};
        GlobeManager.syncLayer(this, this._key);
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show && this.entities.length === 0 && !this._initialized) {
            this._initialized = true;
            this.init();
            return;
        } else if (show) {
            this.entities.forEach((e) => { e.show = true; });
            GlobeManager.syncLayer(this, this._key);
            this.refresh();
        } else {
            this.entities.forEach((e) => { e.show = false; });
            GlobeManager.syncLayer(this, this._key);
            if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
        }
        GlobeManager.setGroupVisible(this._key, show);
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    destroy() {
        if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
        this.clearEntities();
    }
};

window.SatelliteLayer = SatelliteLayer;
