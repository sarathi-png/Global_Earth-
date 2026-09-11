const ControlManager = {
    handler: null,
    init() {
        if (!GlobeManager.viewer) return;
        if (this.handler) { this.handler.destroy(); this.handler = null; }

        this.handler = new Cesium.ScreenSpaceEventHandler(GlobeManager.viewer.scene.canvas);

        // Hover handling (throttled via rAF flag to keep 60fps parity with reference apps)
        let hoverQueued = false;
        let lastHover = null;
        this.handler.setInputAction((movement) => {
            lastHover = movement;
            if (hoverQueued) return;
            hoverQueued = true;
            requestAnimationFrame(() => {
                hoverQueued = false;
                try {
                    const pickedObject = GlobeManager.viewer.scene.pick(lastHover.endPosition);
                    if (Cesium.defined(pickedObject) && pickedObject.id) {
                        this.onHover(pickedObject.id, lastHover.endPosition);
                    } else {
                        this.onHoverOut();
                    }
                } catch (_) { /* picking not ready */ }
            });
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Single click: open drawer + fly to incident
        this.handler.setInputAction((click) => {
            const pickedObject = GlobeManager.viewer.scene.pick(click.position);
            if (Cesium.defined(pickedObject) && pickedObject.id) {
                this.onClick(pickedObject.id);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Double click: zoom closer to the picked incident
        this.handler.setInputAction((click) => {
            try {
                const pickedObject = GlobeManager.viewer.scene.pick(click.position);
                if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
                    const getVal = (prop) => (prop && typeof prop.getValue === 'function') ? prop.getValue() : prop;
                    const lat = getVal(pickedObject.id.properties.lat);
                    const lng = getVal(pickedObject.id.properties.lng);
                    if (lat !== undefined && lng !== undefined && typeof CameraManager !== 'undefined') {
                        CameraManager.flyTo(lat, lng, 400000);
                    }
                }
            } catch (_) {}
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        console.log("Control Manager Initialized");
    },

    onHover(entity, position) {
        const popup = document.getElementById('popup');
        if (!popup || !entity) return;
        
        // Use a safe property getter
        const getVal = (prop) => (prop && typeof prop.getValue === 'function') ? prop.getValue() : prop;
        
        if (entity.properties) {
            HoverPopup.show(entity, position);
        } else {
            // Fallback for entities without property bags (like planes/satellites if not updated yet)
            HoverPopup.show({
                properties: {
                    title: { getValue: () => entity.id || 'Unknown Object' },
                    type: { getValue: () => 'info' },
                    year: { getValue: () => '' }
                }
            }, position);
        }
    },

    onHoverOut() {
        HoverPopup.hide();
    },

    onClick(entity) {
        if (entity && entity.properties) {
            DrawerManager.open(entity);
            
            const props = entity.properties;
            const getVal = (prop) => (prop && typeof prop.getValue === 'function') ? prop.getValue() : prop;

            const lat = getVal(props.lat);
            const lng = getVal(props.lng);

            if (lat !== undefined && lng !== undefined) {
                CameraManager.flyToIncident(lat, lng);
            }
        }
    }
};
