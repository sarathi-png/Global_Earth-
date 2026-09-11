// NOTE: browser keys are injected server-side from environment variables
// (see server.js config handler). Never commit real keys here.
const CONFIG = {
    FIRMS_MAP_KEY: (typeof process !== 'undefined' && process.env && process.env.FIRMS_MAP_KEY) || '',
    NASA_API_KEY: '__NASA_API_KEY__',

    // MapLibre GL basemap (OSIRIS engine + style). CARTO dark-matter is the
    // OSIRIS basemap; ESRI World Imagery is the keyless aerial overlay used
    // by the Street View toggle. GIBS is the NASA overlay (toggleGIBS).
    MAP: {
        STYLE_URL: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        PROJECTION: 'globe',
        MIN_ZOOM: 1.2,
        MAX_ZOOM: 18,
        MAX_PITCH: 85,
        AERIAL_TILES: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        AERIAL_ATTR: 'Esri World Imagery'
    },

    GLOBE_SETTINGS: {
        baseColor: '#1a202c',
        enableAtmosphere: true,
        enableLighting: true,
        nightAlpha: 0.8
    },

    CAMERA: {
        incidentZoom: 8
    },

    CAMERA_DEFAULTS: {
        destination: {
            lat: 20.0,
            lng: 0.0,
            zoom: 2.0
        },
        duration: 3
    },

    API: {
        PROXY_BASE: '',
        SSE_ENABLED: true,
        CACHE_TTL: 60000,
        REFRESH_INTERVAL: 120000
    },

    SOURCES: {
        EONET: 'https://eonet.gsfc.nasa.gov/api/v3/events',
        USGS: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
        GDACS: 'https://www.gdacs.org/xml/rss.xml',
        NOAA_NWS: 'https://api.weather.gov/alerts/active?status=actual&message_type=alert',
        FIRMS: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv',
        OPEN_METEO: 'https://api.open-meteo.com/v1/forecast',
        FEMA: 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries',
        GIBS: 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best',
        AIRPLANES_LIVE: 'https://api.airplanes.live/v2',
        CELESTRAK: 'https://celestrak.org/NORAD/elements/gp.php',
        WIKIPEDIA: 'https://en.wikipedia.org/api/rest_v1/page/summary',
        GDELT: 'https://api.gdeltproject.org/api/v2/doc/doc',
        RELIEFWEB: 'https://api.reliefweb.int/v2/disasters'
    },

    STREETVIEW: {
        enabled: false,
        minAltitudeMeters: 500000,
        maxLevel: 19,
        alpha: 0.95
    },

    LAYERS: {
        disasters: { enabled: true, color: '#ffb400', icon: 'fa-house-damage' },
        wars: { enabled: true, color: '#ff3b30', icon: 'fa-shield-alt' },
        mysteries: { enabled: false, color: '#bf5af2', icon: 'fa-question-circle' },
        historical: { enabled: false, color: '#9cdef2', icon: 'fa-history' },
        borders: { enabled: false, color: '#5ee9b5', opacity: 0.5, icon: 'fa-globe-americas' },
        weather: { enabled: false, color: '#ffffff', icon: 'fa-cloud' },
        aircraft: { enabled: false, color: '#9cdef2', icon: 'fa-plane' },
        satellite: { enabled: false, color: '#ff9500', icon: 'fa-satellite' },
        live: { enabled: false, color: '#ffb400', icon: 'fa-broadcast-tower', refreshMinutes: 2 },
        streetview: { enabled: false, color: '#4ade80', icon: 'fa-street-view' }
    }
};

if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('firms_key')) CONFIG.FIRMS_MAP_KEY = params.get('firms_key');
    if (params.get('map_style')) CONFIG.MAP.STYLE_URL = params.get('map_style');
}
