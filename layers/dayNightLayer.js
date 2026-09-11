// DayNightLayer — solar terminator as a MapLibre fill + line
// (OSIRIS algorithm: subsolar longitude from UTC, declination from day of
// year, terminator latitude per longitude, dark-side pole corners).
const DayNightLayer = {
    visible: false,
    _initialized: false,
    _setup: false,
    _timer: null,

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        this.setup();
        console.log('DayNightLayer initialized');
    },

    setup() {
        if (this._setup || typeof GlobeManager === 'undefined') return;
        this._setup = true;
        GlobeManager.ensureGeoSource('src-daynight', null);
        GlobeManager.addLayerOnce({
            id: 'day-night-fill', type: 'fill', source: 'src-daynight',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: { 'fill-color': '#000022', 'fill-opacity': 0.35 }
        });
        GlobeManager.addLayerOnce({
            id: 'day-night-line', type: 'line', source: 'src-daynight',
            filter: ['==', ['geometry-type'], 'LineString'],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#ffd700', 'line-width': 1.5, 'line-opacity': 0.7 }
        });
        this.applyVisibility();
    },

    computeSolarTerminator() {
        const now = new Date();
        const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
        const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
        const decRad = declination * Math.PI / 180;
        const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
        const subsolarLng = (12 - utcHours) * 15;
        const points = [];
        for (let lng = -180; lng <= 180; lng += 2) {
            const lngRad = (lng - subsolarLng) * Math.PI / 180;
            const lat = Math.atan(-Math.cos(lngRad) / Math.tan(decRad)) * 180 / Math.PI;
            points.push([lng, lat]);
        }
        const darkSide = declination >= 0 ? -90 : 90;
        points.push([180, darkSide]);
        points.push([-180, darkSide]);
        points.push(points[0]);
        return points;
    },

    update() {
        if (!this.visible || !GlobeManager.map) return;
        this.setup();
        let ring;
        try {
            ring = this.computeSolarTerminator();
        } catch (_) { return; }
        // terminator line: drop the pole-closing corners
        const line = ring.slice(0, 181);
        GlobeManager.setGeoData('src-daynight', {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} },
                { type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: {} }
            ]
        });
        this.applyVisibility();
        if (this._timer) clearInterval(this._timer);
        const self = this;
        this._timer = setInterval(function () { self.update(); }, 60000);
    },

    applyVisibility() {
        GlobeManager.setLayerVisible('day-night-fill', this.visible);
        GlobeManager.setLayerVisible('day-night-line', this.visible);
    },

    remove() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        GlobeManager.setGeoData('src-daynight', null);
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show) {
            this.init();
            this.update();
        } else {
            this.remove();
            this.applyVisibility();
        }
    }
};

window.DayNightLayer = DayNightLayer;
