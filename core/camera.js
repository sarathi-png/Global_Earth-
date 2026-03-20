const CameraManager = {
    flyTo(lat, lng, height = 500000) {
        if (!GlobeManager.viewer) return;

        GlobeManager.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
            duration: CONFIG.CAMERA_DEFAULTS.duration,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
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
