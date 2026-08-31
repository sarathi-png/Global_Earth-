const CONFIG = {
    CESIUM_TOKEN: (typeof process !== 'undefined' && process.env && process.env.CESIUM_TOKEN) || '',
    FIRMS_MAP_KEY: (typeof process !== 'undefined' && process.env && process.env.FIRMS_MAP_KEY) || '',
    NASA_API_KEY: (typeof process !== 'undefined' && process.env && process.env.NASA_API_KEY) || 'DEMO_KEY',

    GLOBE_SETTINGS: {
        baseColor: '#1a202c',
        enableAtmosphere: true,
        enableLighting: true,
        nightAlpha: 0.8
    },

    CAMERA: {
        incidentZoom: 50000
    },

    CAMERA_DEFAULTS: {
        destination: {
            lat: 20.0,
            lng: 0.0,
            height: 20000000.0
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

    OSIRIS: {
        enabled: false,
        url: (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'http://localhost:8080',
        layers: ['cctv','maritime','conflicts','news','fires','earthquakes']
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
        streetview: { enabled: false, color: '#4ade80', icon: 'fa-street-view' },
        osiris: { enabled: false, color: '#a78bfa', icon: 'fa-eye' }
    }
};

if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('cesium_token')) CONFIG.CESIUM_TOKEN = params.get('cesium_token');
    if (params.get('firms_key')) CONFIG.FIRMS_MAP_KEY = params.get('firms_key');
}

if (typeof Cesium !== 'undefined' && CONFIG.CESIUM_TOKEN) {
    Cesium.Ion.defaultAccessToken = CONFIG.CESIUM_TOKEN;
}
