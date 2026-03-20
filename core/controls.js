const ControlManager = {
    init() {
        if (!GlobeManager.viewer) return;
        
        const handler = new Cesium.ScreenSpaceEventHandler(GlobeManager.viewer.scene.canvas);
        
        // Hover handling
        handler.setInputAction((movement) => {
            const pickedObject = GlobeManager.viewer.scene.pick(movement.endPosition);
            if (Cesium.defined(pickedObject) && pickedObject.id) {
                this.onHover(pickedObject.id, movement.endPosition);
            } else {
                this.onHoverOut();
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Click handling
        handler.setInputAction((click) => {
            const pickedObject = GlobeManager.viewer.scene.pick(click.position);
            if (Cesium.defined(pickedObject) && pickedObject.id) {
                this.onClick(pickedObject.id);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        console.log("Control Manager Initialized");
    },

    onHover(entity, position) {
        const popup = document.getElementById('popup');
        if (!popup || !entity.properties) return;
        if (entity) {
            HoverPopup.show(entity, position);
        } else {
            HoverPopup.hide();
        }
    },

    onHoverOut() {
        HoverPopup.hide();
    },

    onClick(entity) {
        if (entity) {
            DrawerManager.open(entity);
            
            const props = entity.properties;
            const zoom = (CONFIG.CAMERA && CONFIG.CAMERA.incidentZoom) ||
                         (CONFIG.CAMERA_DEFAULTS && CONFIG.CAMERA_DEFAULTS.destination && CONFIG.CAMERA_DEFAULTS.destination.height) ||
                         1200000;

            CameraManager.flyTo(
                props.lat.getValue(),
                props.lng.getValue(),
                zoom
            );
        }
    }
};
