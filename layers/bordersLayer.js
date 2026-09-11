// BordersLayer — country polygons colored by stability (MapLibre fill +
// line, data-driven match expressions). Entities list kept for stats parity.
const BordersLayer = {
    entities: [],
    entitiesById: {},
    visible: false,
    _initialized: false,
    _setup: false,

    RISK: {
        'AF': 0.9, 'SY': 0.85, 'YE': 0.85, 'SO': 0.8, 'IQ': 0.7,
        'LY': 0.7, 'SD': 0.7, 'SS': 0.75, 'MM': 0.65, 'UA': 0.6,
        'PK': 0.55, 'IN': 0.4, 'CN': 0.35, 'RU': 0.5, 'IR': 0.6,
        'KP': 0.7, 'VE': 0.55, 'HT': 0.5, 'ET': 0.5, 'NG': 0.45,
        'CD': 0.6, 'ML': 0.55, 'BF': 0.5, 'NE': 0.55, 'TG': 0.35,
        'BD': 0.4, 'PH': 0.4, 'MX': 0.35, 'BR': 0.3, 'CO': 0.4,
        'US': 0.15, 'CA': 0.1, 'GB': 0.1, 'DE': 0.1, 'FR': 0.15,
        'JP': 0.1, 'AU': 0.1, 'NZ': 0.1, 'NO': 0.05, 'SE': 0.1,
        'CH': 0.05, 'IS': 0.05, 'FI': 0.1, 'DK': 0.1, 'NL': 0.1
    },

    async init() {
        if (!this.visible) return;
        try {
            const res = await fetch('data/countries.geo.json');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const geo = await res.json();
            this.setup();
            this.applyStability(geo);
            GlobeManager.setGeoData('src-borders', geo);
            this.entities = (geo.features || []).map((f, i) => ({
                id: 'border-' + i, show: this.visible,
                properties: { id: 'border-' + i, title: (f.properties && (f.properties.name || f.properties.admin)) || 'Country', type: 'borders' }
            }));
            this.applyVisibility();
            console.log('Balance of Power (Borders) Layer Initialized');
            if (typeof updateGlobalStats === 'function') updateGlobalStats();
        } catch (error) {
            console.error('Error loading borders GeoJSON:', error);
        }
    },

    setup() {
        if (this._setup || typeof GlobeManager === 'undefined') return;
        this._setup = true;
        GlobeManager.ensureGeoSource('src-borders', null);
        // stability buckets: <0.3 red, <0.5 orange, <0.7 yellow, else green
        const fillColor = [
            'step', ['coalesce', ['get', 'stability'], 0.5],
            '#ff3b30', 0.3,
            '#ff9500', 0.5,
            '#ffcc00', 0.7,
            '#00e676'
        ];
        const lineColor = [
            'step', ['coalesce', ['get', 'stability'], 0.5],
            '#ff3b30', 0.3,
            '#ff9500', 0.5,
            '#ffcc00', 0.7,
            '#00e676'
        ];
        GlobeManager.addLayerOnce({
            id: 'borders-fill', type: 'fill', source: 'src-borders',
            paint: { 'fill-color': fillColor, 'fill-opacity': 0.12 }
        });
        GlobeManager.addLayerOnce({
            id: 'borders-line', type: 'line', source: 'src-borders',
            paint: { 'line-color': lineColor, 'line-opacity': 0.6, 'line-width': 1 }
        });
    },

    stabilityFor(props) {
        props = props || {};
        const code = props.iso_a2 || props.ISO_A2;
        if (code && this.RISK[code] !== undefined) return 1 - this.RISK[code];
        const name = String(props.name || props.NAME || props.admin || '').toLowerCase();
        if (name) {
            const codes = Object.keys(this.RISK);
            for (let i = 0; i < codes.length; i++) {
                if (name.indexOf(codes[i].toLowerCase()) !== -1) return 1 - this.RISK[codes[i]];
            }
        }
        return 0.5;
    },

    applyStability(geo) {
        (geo.features || []).forEach((f) => {
            f.properties = f.properties || {};
            f.properties.stability = this.stabilityFor(f.properties);
        });
    },

    applyVisibility() {
        GlobeManager.setLayerVisible('borders-fill', this.visible);
        GlobeManager.setLayerVisible('borders-line', this.visible);
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show && !this._initialized) {
            this._initialized = true;
            this.init();
            return;
        }
        this.setup();
        this.entities.forEach((e) => { e.show = show; });
        this.applyVisibility();
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    }
};

window.BordersLayer = BordersLayer;
