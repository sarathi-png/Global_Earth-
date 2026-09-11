// CameraManager — MapLibre flyTo wrappers (OSIRIS: map.flyTo center/zoom).
const CameraManager = {
    flyTo(lat, lng, height) {
        if (!GlobeManager.map) return;
        try {
            if (GlobeManager.map.stop) GlobeManager.map.stop();
            const zoom = (typeof height === 'number' && height > 30)
                ? GlobeManager.heightToZoom(height, lat) // legacy metre call sites
                : 6;
            GlobeManager.map.flyTo({ center: [lng, lat], zoom: zoom, duration: 1400 });
        } catch (_) {}
    },

    flyToZoom(lat, lng, zoom) {
        if (!GlobeManager.map) return;
        try {
            if (GlobeManager.map.stop) GlobeManager.map.stop();
            GlobeManager.map.flyTo({ center: [lng, lat], zoom: zoom, duration: 1400 });
        } catch (_) {}
    },

    flyToIncident(lat, lng) {
        const zoom = (CONFIG.CAMERA && CONFIG.CAMERA.incidentZoom) || 8;
        this.flyToZoom(lat, lng, zoom);
    },

    home() {
        if (!GlobeManager.map) return;
        const d = (CONFIG.CAMERA_DEFAULTS && CONFIG.CAMERA_DEFAULTS.destination) || { lat: 20, lng: 0, zoom: 2 };
        this.flyToZoom(d.lat, d.lng, d.zoom || 2);
    },

    lookAtEntity(entity) {
        if (!GlobeManager.map || !entity || !entity.properties) return;
        const p = entity.properties;
        if (typeof p.lat === 'number' && typeof p.lng === 'number') this.flyToIncident(p.lat, p.lng);
    }
};
