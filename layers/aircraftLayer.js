const AircraftLayer = {
    entities: [],
    visible: false,
    refreshTimer: null,
    REFRESH_INTERVAL: 30000,

    init() {
        if (!this.visible) return;
        console.log("Aircraft Layer Initialized (Live ADS-B)");
        this.refresh();
        this.startAutoRefresh();
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
            const center = this.getCameraCenter();
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

    getCameraCenter() {
        if (GlobeManager.viewer && GlobeManager.viewer.camera) {
            const cam = GlobeManager.viewer.camera;
            const carto = Cesium.Cartographic.fromCartesian(cam.position);
            return { lat: Cesium.Math.toDegrees(carto.latitude), lng: Cesium.Math.toDegrees(carto.longitude) };
        }
        return { lat: 20, lng: 0 };
    },

    renderAircraft(aircraft) {
        this.clearEntities();
        aircraft.forEach(ac => {
            try {
                const lat = ac.lat || (ac.geom && ac.geom.latitude);
                const lng = ac.lon || (ac.geom && ac.geom.longitude);
                const alt = (ac.alt_baro || ac.alt_geom || 10000) * 0.3048;
                const callSign = ac.flight || ac.hex || 'UNKNOWN';
                const heading = ac.track || 0;
                const speed = ac.gs || 0;

                if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

                const pos = Cesium.Cartesian3.fromDegrees(lng, lat, alt);
                const headingRad = Cesium.Math.toRadians(heading);
                const orientation = Cesium.Transforms.headingPitchRollQuaternion(
                    pos, new Cesium.HeadingPitchRoll(headingRad, 0, 0)
                );

                const entity = GlobeManager.viewer.entities.add({
                    id: 'ac-' + ac.hex || callSign,
                    position: pos,
                    orientation: orientation,
                    show: this.visible,
                    properties: {
                        id: new Cesium.ConstantProperty('ac-' + callSign),
                        title: new Cesium.ConstantProperty(callSign.trim()),
                        type: new Cesium.ConstantProperty('aircraft'),
                        description: new Cesium.ConstantProperty(
                            'Callsign: ' + callSign.trim() + '\n' +
                            'Altitude: ' + Math.round(alt) + 'm (' + Math.round(alt * 3.281) + 'ft)\n' +
                            'Speed: ' + speed.toFixed(0) + ' kts\n' +
                            'Heading: ' + heading.toFixed(0) + '°\n' +
                            'Squawk: ' + (ac.squawk || 'N/A') + '\n' +
                            'Source: ADS-B'
                        ),
                        year: new Cesium.ConstantProperty(new Date().getFullYear()),
                        severity: new Cesium.ConstantProperty('Low'),
                        lat: new Cesium.ConstantProperty(lat),
                        lng: new Cesium.ConstantProperty(lng)
                    },
                    point: {
                        pixelSize: 6,
                        color: Cesium.Color.fromCssColorString('#ffffff'),
                        outlineColor: Cesium.Color.fromCssColorString('#00d4ff'),
                    outlineWidth: 2
                    },
                    label: {
                        text: callSign.trim(),
                        font: '10px monospace',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        showBackground: true,
                        backgroundColor: new Cesium.Color(0, 0, 0, 0.5),
                        pixelOffset: new Cesium.Cartesian2(0, -15),
                        translucencyByDistance: new Cesium.NearFarScalar(500000, 1.0, 5000000, 0.0),
                        show: true
                    }
                });
                this.entities.push(entity);
            } catch (e) { /* skip bad aircraft */ }
        });
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    renderSimulated() {
        this.clearEntities();
        const hubs = [
            { name: "JFK", lat: 40.6413, lng: -73.7781 },
            { name: "LHR", lat: 51.4700, lng: -0.4543 },
            { name: "HND", lat: 35.5494, lng: 139.7798 },
            { name: "DXB", lat: 25.2532, lng: 55.3657 },
            { name: "SIN", lat: 1.3644, lng: 103.9915 }
        ];
        for (let i = 0; i < 5; i++) {
            const hub = hubs[Math.floor(Math.random() * hubs.length)];
            const lat = hub.lat + (Math.random() - 0.5) * 30;
            const lng = hub.lng + (Math.random() - 0.5) * 30;
            const alt = 10000 + Math.random() * 2000;
            const id = 'SIM-FLIGHT-' + (800 + i);
            const entity = GlobeManager.viewer.entities.add({
                id, position: Cesium.Cartesian3.fromDegrees(lng, lat, alt),
                show: this.visible,
                properties: {
                    id: new Cesium.ConstantProperty(id),
                    title: new Cesium.ConstantProperty(id),
                    type: new Cesium.ConstantProperty('aircraft'),
                    description: new Cesium.ConstantProperty('Simulated flight. ADS-B unavailable.'),
                    year: new Cesium.ConstantProperty(new Date().getFullYear()),
                    severity: new Cesium.ConstantProperty('Low'),
                    lat: new Cesium.ConstantProperty(lat),
                    lng: new Cesium.ConstantProperty(lng)
                },
                point: { pixelSize: 5, color: Cesium.Color.fromCssColorString('#888888'), outlineColor: Cesium.Color.fromCssColorString('#555555'), outlineWidth: 1 },
                label: { text: id, font: '9px monospace', fillColor: Cesium.Color.WHITE.withAlpha(0.5), outlineColor: Cesium.Color.BLACK, outlineWidth: 1, showBackground: true, backgroundColor: new Cesium.Color(0, 0, 0, 0.3), pixelOffset: new Cesium.Cartesian2(0, -12), show: true }
            });
            this.entities.push(entity);
        }
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    clearEntities() {
        if (GlobeManager.viewer) {
            this.entities.forEach(e => GlobeManager.viewer.entities.remove(e));
        }
        this.entities = [];
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show && this.entities.length === 0 && !this._initialized) {
            this._initialized = true;
            this.init();
        } else if (show) {
            this.refresh();
        } else {
            this.clearEntities();
            if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
        }
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    destroy() {
        if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
        this.clearEntities();
    }
};

window.AircraftLayer = AircraftLayer;
