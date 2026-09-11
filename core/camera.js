const CameraManager = {
    _cancelFlight() {
        try {
            if (GlobeManager.viewer && GlobeManager.viewer.camera) {
                GlobeManager.viewer.camera.cancelFlight();
            }
        } catch (_) {}
    },

    flyTo(lat, lng, height = 500000) {
        if (!GlobeManager.viewer) return;
        this._cancelFlight();

        GlobeManager.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
            duration: 1.4,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
        });
    },

    flyToIncident(lat, lng) {
        if (!GlobeManager.viewer) return;
        this._cancelFlight();
        const height = (CONFIG.CAMERA && CONFIG.CAMERA.incidentZoom) || 120000;

        GlobeManager.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
            orientation: {
                heading: 0,
                pitch: Cesium.Math.toRadians(-35),
                roll: 0
            },
            duration: 1.4,
            easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
        });
    },

    home() {
        this.flyTo(
            CONFIG.CAMERA_DEFAULTS.destination.lat,
            CONFIG.CAMERA_DEFAULTS.destination.lng,
            CONFIG.CAMERA_DEFAULTS.destination.height
        );
    },

    lookAtEntity(entity) {
        if (!GlobeManager.viewer || !entity) return;
        GlobeManager.viewer.zoomTo(entity);
    }
};
