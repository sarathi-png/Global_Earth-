const CONFIG = {
    // Cesium Ion Access Token - Replace with your own token from https://ion.cesium.com/
    // Defaulting to a placeholder; some features may require a valid token.
    CESIUM_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMmZjZTI4ZC05NGRkLTRjNjctYWVmMC05YzRkOWVjNGYwOTgiLCJpZCI6NDA2NjUyLCJpYXQiOjE3NzQwMDk5NTB9.BdwMpJaBew2ZYDOtRQP1XB5wyJpIpKTQphP97k4ixa0', 
    
    GLOBE_SETTINGS: {
        baseColor: '#1a202c', // Lighter dark blue for visibility if imagery fails
        enableAtmosphere: true,
        enableLighting: true,
        nightAlpha: 0.8
    },
    
    CAMERA: {
        incidentZoom: 1200000
    },

    CAMERA_DEFAULTS: {
        destination: {
            lat: 20.0,
            lng: 0.0,
            height: 20000000.0
        },
        duration: 3
    },
    
    LAYERS: {
        disasters: {
            enabled: true,
            color: '#ffb400',
            icon: 'fa-house-damage'
        },
        wars: {
            enabled: true,
            color: '#ff3b30',
            icon: 'fa-shield-alt'
        },
        mysteries: {
            enabled: false,
            color: '#bf5af2',
            icon: 'fa-question-circle'
        },
        historical: {
            enabled: false,
            color: '#00f2ff',
            icon: 'fa-history'
        },
        borders: {
            enabled: false,
            color: '#00f2ff',
            opacity: 0.5,
            icon: 'fa-globe-americas'
        },
        weather: {
            enabled: false,
            color: '#ffffff',
            icon: 'fa-cloud'
        },
        aircraft: {
            enabled: false,
            color: '#00d4ff',
            icon: 'fa-plane'
        },
        satellite: {
            enabled: false,
            color: '#ff9500',
            icon: 'fa-satellite'
        },
        live: {
            enabled: false,
            color: '#ffb400',
            icon: 'fa-broadcast-tower',
            refreshMinutes: 5
        }
    }
};

// Initialize Cesium Token
if (CONFIG.CESIUM_TOKEN) {
    Cesium.Ion.defaultAccessToken = CONFIG.CESIUM_TOKEN;
}
