// ControlManager — MapLibre picking (hover popup, click drawer, dblclick zoom).
const ControlManager = {
    map: null,

    init() {
        if (!GlobeManager.map) return;
        this.map = GlobeManager.map;
        const map = this.map;
        const canvas = map.getCanvas();

        // Hover (rAF-throttled, keeps 60fps parity with reference apps)
        let hoverQueued = false;
        let lastEvt = null;
        map.on('mousemove', (e) => {
            lastEvt = e;
            if (hoverQueued) return;
            hoverQueued = true;
            requestAnimationFrame(() => {
                hoverQueued = false;
                try {
                    if (!lastEvt) return;
                    const hit = GlobeManager.queryAt(lastEvt.point);
                    if (hit && hit.entity) {
                        canvas.style.cursor = 'pointer';
                        this.onHover(hit.entity, lastEvt.point);
                    } else {
                        canvas.style.cursor = '';
                        this.onHoverOut();
                    }
                } catch (_) { /* picking not ready */ }
            });
        });
        map.on('mouseout', () => this.onHoverOut());

        // Single click: incident → drawer + fly; cluster → expand; empty → hide chrome
        map.on('click', (e) => {
            try {
                const hit = GlobeManager.queryAt(e.point);
                if (hit && hit.cluster) {
                    GlobeManager.expandCluster(hit.srcId, hit.clusterId, hit.lngLat);
                    return;
                }
                if (hit && hit.entity) {
                    this.onClick(hit.entity);
                    return;
                }
                // Empty-globe click (not a drag — MapLibre click already filters drags)
                if (typeof hideUI === 'function') hideUI();
                else if (typeof DrawerManager !== 'undefined') { try { DrawerManager.close(); } catch (_) {} }
            } catch (_) {}
        });

        // Double click: zoom closer to the picked incident
        map.on('dblclick', (e) => {
            try {
                e.preventDefault();
                const hit = GlobeManager.queryAt(e.point);
                if (hit && hit.entity && hit.entity.properties) {
                    const p = hit.entity.properties;
                    if (typeof p.lat === 'number' && typeof p.lng === 'number' &&
                        typeof CameraManager !== 'undefined') {
                        CameraManager.flyToZoom(p.lat, p.lng, Math.min((map.getZoom() || 4) + 2.5, 14));
                    }
                } else {
                    map.zoomIn({ duration: 300 });
                }
            } catch (_) {}
        });

        console.log('Control Manager Initialized (MapLibre)');
    },

    onHover(entity, position) {
        if (!entity) return;
        if (entity.properties) {
            HoverPopup.show(entity, position);
        } else {
            HoverPopup.show({
                properties: { title: 'Unknown Object', type: 'info', year: '' }
            }, position);
        }
    },

    onHoverOut() {
        HoverPopup.hide();
    },

    onClick(entity) {
        if (entity && entity.properties) {
            DrawerManager.open(entity);
            const p = entity.properties;
            if (typeof p.lat === 'number' && typeof p.lng === 'number') {
                CameraManager.flyToIncident(p.lat, p.lng);
            }
        }
    }
};
