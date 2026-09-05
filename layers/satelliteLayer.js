const SatelliteLayer = {
    entities: [],
    visible: false,
    refreshTimer: null,

    init() {
        if (!this.visible) return;
        console.log("Satellite Layer Initialized (CelesTrak Live)");
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

    propagatePosition(sat) {
        const now = new Date();
        const jd = 2440587.5 + now.getTime() / 86400000;
        const t = (jd - 2451545.0) / 36525.0;
        const deg2rad = Math.PI / 180;

        const a = Math.pow(398600.4418 / (Math.pow((sat.meanMotion || 15.5) * 2 * Math.PI / 86400, 2)), 1 / 3);
        const e = sat.eccentricity || 0.001;
        const i = (sat.inclination || 51.6) * deg2rad;
        const raan = (sat.rightAscensionOfMeanNode || 0) * deg2rad;
        const argPerigee = (sat.argumentOfPerigee || 0) * deg2rad;
        const meanAnomaly = ((sat.meanAnomaly || 0) * deg2rad + (sat.meanMotion || 15.5) * 2 * Math.PI * (now.getTime() / 1000 % 86400) / 86400) % (2 * Math.PI);

        let E = meanAnomaly;
        for (let j = 0; j < 10; j++) E = meanAnomaly + e * Math.sin(E);
        const cosV = (Math.cos(E) - e) / (1 - e * Math.cos(E));
        const sinV = (Math.sqrt(1 - e * e) * Math.sin(E)) / (1 - e * Math.cos(E));
        const v = Math.atan2(sinV, cosV);
        const r = a * (1 - e * Math.cos(E));

        const xOrbital = r * Math.cos(v);
        const yOrbital = r * Math.sin(v);

        const cosRaan = Math.cos(raan), sinRaan = Math.sin(raan);
        const cosArg = Math.cos(argPerigee), sinArg = Math.sin(argPerigee);
        const cosI = Math.cos(i), sinI = Math.sin(i);

        const x = (cosRaan * cosArg - sinRaan * sinArg * cosI) * xOrbital + (-cosRaan * sinArg - sinRaan * cosArg * cosI) * yOrbital;
        const y = (sinRaan * cosArg + cosRaan * sinArg * cosI) * xOrbital + (-sinRaan * sinArg + cosRaan * cosArg * cosI) * yOrbital;
        const z = (sinArg * sinI) * xOrbital + (cosArg * sinI) * yOrbital;

        return new Cesium.Cartesian3(x * 1000, y * 1000, z * 1000);
    },

    renderSatellites(sats) {
        this.clearEntities();
        sats.forEach(sat => {
            try {
                const pos = this.propagatePosition(sat);
                const name = sat.name || sat.OBJECT_NAME || 'SAT';
                const noradId = sat.noradCatId || sat.NORAD_CAT_ID || '???';
                const alt = sat.semimajorAxis ? (sat.semimajorAxis - 6371) : 400;

                const entity = GlobeManager.viewer.entities.add({
                    id: 'sat-' + noradId, position: pos,
                    show: this.visible,
                    properties: {
                        id: new Cesium.ConstantProperty('sat-' + noradId),
                        title: new Cesium.ConstantProperty(name.trim()),
                        type: new Cesium.ConstantProperty('satellite'),
                        description: new Cesium.ConstantProperty(
                            'NORAD ID: ' + noradId + '\n' +
                            'Inclination: ' + (sat.inclination || 0).toFixed(1) + '°\n' +
                            'Altitude: ~' + Math.round(alt) + 'km\n' +
                            'Period: ' + (sat.orbitalPeriod ? (sat.orbitalPeriod / 60).toFixed(1) : 'N/A') + ' min\n' +
                            'Source: CelesTrak'
                        ),
                        year: new Cesium.ConstantProperty(new Date().getFullYear()),
                        severity: new Cesium.ConstantProperty('Low')
                    },
                    point: {
                        pixelSize: 4,
                        color: Cesium.Color.fromCssColorString('#ff9500'),
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 1
                    },
                    label: {
                        text: name.trim().substring(0, 15),
                        font: '9px monospace',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 1,
                        showBackground: true,
                        backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
                        pixelOffset: new Cesium.Cartesian2(0, -10),
                        translucencyByDistance: new Cesium.NearFarScalar(1000000, 1.0, 8000000, 0.0),
                        show: true
                    },
                    path: {
                        resolution: 300,
                        material: new Cesium.PolylineGlowMaterialProperty({
                            glowPower: 0.05,
                            color: Cesium.Color.fromCssColorString('#ff9500').withAlpha(0.2)
                        }),
                        width: 1, leadTime: 300, trailTime: 300
                    }
                });
                this.entities.push(entity);
            } catch (e) { /* skip */ }
        });
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    renderSimulated() {
        this.clearEntities();
        for (let i = 0; i < 10; i++) {
            const startAngle = Math.random() * Math.PI * 2;
            const inclination = (Math.random() - 0.5) * Math.PI / 2;
            const altitude = 400000 + Math.random() * 200000;
            const id = 'SIM-SAT-' + (100 + i);
            const posProp = new Cesium.SampledPositionProperty();
            const now = Cesium.JulianDate.now();
            for (let j = 0; j < 360; j += 10) {
                const time = Cesium.JulianDate.addSeconds(now, j * 60, new Cesium.JulianDate());
                const angle = startAngle + (j * Math.PI / 180);
                const R = Cesium.Ellipsoid.WGS84.maximumRadius + altitude;
                posProp.addSample(time, new Cesium.Cartesian3(R * Math.cos(angle) * Math.cos(inclination), R * Math.sin(angle) * Math.cos(inclination), R * Math.sin(inclination)));
            }
            const entity = GlobeManager.viewer.entities.add({
                id, position: posProp, show: this.visible,
                properties: {
                    id: new Cesium.ConstantProperty(id), title: new Cesium.ConstantProperty(id),
                    type: new Cesium.ConstantProperty('satellite'),
                    description: new Cesium.ConstantProperty('Simulated satellite. CelesTrak unavailable.'),
                    year: new Cesium.ConstantProperty(new Date().getFullYear()),
                    severity: new Cesium.ConstantProperty('Low')
                },
                point: { pixelSize: 4, color: Cesium.Color.fromCssColorString('#666666'), outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
                label: { text: id, font: '9px monospace', fillColor: Cesium.Color.WHITE.withAlpha(0.4), outlineColor: Cesium.Color.BLACK, outlineWidth: 1, showBackground: true, backgroundColor: new Cesium.Color(0, 0, 0, 0.3), pixelOffset: new Cesium.Cartesian2(0, -10), show: true },
                path: { resolution: 300, material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.05, color: Cesium.Color.fromCssColorString('#444444').withAlpha(0.15) }), width: 1, leadTime: 0, trailTime: 3000 }
            });
            this.entities.push(entity);
        }
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    clearEntities() {
        if (GlobeManager.viewer) { this.entities.forEach(e => GlobeManager.viewer.entities.remove(e)); }
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

window.SatelliteLayer = SatelliteLayer;
