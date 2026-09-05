const GlobeManager = {
    viewer: null,
    _allLayerNames: [
        'DisastersLayer','WarsLayer','MysteryLayer','HistoricalLayer',
        'AircraftLayer','SatelliteLayer','WeatherLayer','LiveLayer',
        'BordersLayer','OsirisLayer','HeatmapLayer','RippleArcLayer',
        'DayNightLayer','StreetViewLayer'
    ],

    async init(containerId) {
        // Guard 1: WebGL support (headless / blocked canvas environments)
        try {
            const testCanvas = document.createElement('canvas');
            if (!(window.WebGLRenderingContext &&
                (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')))) {
                this.showFatal(containerId, 'WebGL Unavailable',
                    'This browser (or its current settings) does not provide WebGL, which the 3D globe requires.');
                return null;
            }
        } catch (_) { /* proceed — Viewer will report */ }

        // Guard 2: Cesium failed to load (CDN + vendor both blocked)
        if (typeof Cesium === 'undefined') {
            this.showFatal(containerId, 'Engine Failed to Load',
                'The CesiumJS library could not be loaded from the local bundle or any CDN fallback. Check your connection or ad/script blocker, then retry.');
            return null;
        }
        try {
            const viewerOptions = {
                animation: false,
                baseLayerPicker: false,
                fullscreenButton: false,
                geocoder: false,
                homeButton: false, // custom #homeBtn is used instead
                infoBox: false,
                sceneModePicker: false,
                selectionIndicator: false,
                timeline: false,
                navigationHelpButton: true,
                navigationInstructionsInitiallyVisible: false,
                scene3DOnly: true,
                shouldAnimate: true
            };

            this.viewer = new Cesium.Viewer(containerId, viewerOptions);

            if (CONFIG.CESIUM_TOKEN && navigator.onLine) {
                Cesium.CesiumTerrainProvider.fromIonAssetId(1).then(terrain => {
                    this.viewer.terrainProvider = terrain;
                }).catch(() => console.warn("Terrain failed, using ellipsoid."));
            }

            const scene = this.viewer.scene;
            const globe = scene.globe;

            globe.baseColor = Cesium.Color.fromCssColorString(CONFIG.GLOBE_SETTINGS.baseColor);
            globe.showGroundAtmosphere = CONFIG.GLOBE_SETTINGS.enableAtmosphere;

            if ('enableLighting' in globe) {
                try {
                    globe.enableLighting = CONFIG.GLOBE_SETTINGS.enableLighting;
                } catch (e) {
                    console.warn("globe.enableLighting not supported in this Cesium version, skipping.");
                }
            }

            scene.skyAtmosphere.show = true;
            scene.fog.enabled = true;
            scene.fog.density = 0.0001;

            scene.renderError.addEventListener((scene, error) => {
                console.warn("Cesium render error caught:", error);
            });

            if (CONFIG.CESIUM_TOKEN && navigator.onLine) {
                Cesium.IonImageryProvider.fromAssetId(3).then(provider => {
                    this.viewer.imageryLayers.removeAll();
                    this.viewer.imageryLayers.addImageryProvider(provider);
                }).catch(() => {
                    console.warn("Ion Imagery failed, using local texture.");
                    this.setupLocalImagery();
                });
            } else {
                console.log("Offline mode: using bundled texture imagery.");
                this.setupLocalImagery();
            }

            this.initFrustumCulling();
            console.log("Cesium Globe Initialized");
            return this.viewer;
        } catch (error) {
            console.error("Error initializing Cesium Globe:", error);
            this.showFatal(containerId, 'Engine Initialization Failure',
                'The 3D engine failed to start. This usually happens due to script blocking, missing WebGL, or an invalid Cesium Ion token.');
            return null;
        }
    },

    showFatal(containerId, title, detail) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `
            <div class="glass-panel globe-fatal">
                <i class="fas fa-exclamation-triangle globe-fatal-icon"></i>
                <h3>${title}</h3>
                <p class="globe-fatal-detail">${detail}</p>
                <div class="globe-fatal-actions">
                    <button class="fatal-retry-btn" onclick="location.reload()">
                        <i class="fas fa-rotate-right"></i> Retry
                    </button>
                    <span class="globe-fatal-hint">Tip: set a valid CESIUM_TOKEN env var for Ion imagery, or run fully offline with the bundled texture.</span>
                </div>
            </div>
        `;
    },

    async addGIBSLayer(type) {
        if (!this.viewer) return;
        try {
            const gibsUrl = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/' + type + '/default/2024-01-01/250m/{z}/{y}/{x}.png';
            const provider = await Cesium.UrlTemplateImageryProvider.fromUrl(gibsUrl, {
                maximumLevel: 8,
                credit: 'NASA GIBS'
            });
            const layer = this.viewer.imageryLayers.addImageryProvider(provider);
            layer.alpha = 0.5;
            return layer;
        } catch (e) {
            console.warn('GIBS layer failed:', e.message);
            return null;
        }
    },

    _cullingReset() {
        const allLayers = this._allLayerNames.map(n => window[n]);
        allLayers.forEach(layer => {
            if (!layer || !layer.entities) return;
            layer.entities.forEach(entity => {
                if (!layer.visible) { entity.show = false; return; }
                entity.show = true;
            });
            if (layer.dataSource) layer.dataSource.show = layer.visible;
        });
        this._lastCullUpdate = 0;
    },

    initFrustumCulling() {
        if (!this.viewer) return;

        const scene = this.viewer.scene;
        const camera = this.viewer.camera;
        const canvas = scene.canvas;

        let lastUpdate = 0;
        let lastCamPos = null;
        let lastCamDir = null;
        const UPDATE_INTERVAL = 300;
        const MAX_IDLE_INTERVAL = 600;
        const LABEL_MAX_DISTANCE = 8000000;
        const MIN_DOT_THRESHOLD = 0.0;
        const occluder = new Cesium.EllipsoidalOccluder(Cesium.Ellipsoid.WGS84, Cesium.Cartesian3.ZERO);

        const scratchTo = new Cesium.Cartesian3();
        const scratchNorm = new Cesium.Cartesian3();
        const scratchCamDir = new Cesium.Cartesian3();

        this._cullingUpdate = () => {
            try {
                const now = Date.now();
                const camPos = camera.position;
                const camDir = camera.direction;

                const cameraMoved = !lastCamPos ||
                    !Cesium.Cartesian3.equalsEpsilon(camPos, lastCamPos, 500) ||
                    !Cesium.Cartesian3.equalsEpsilon(camDir, lastCamDir, 1e-6);

                if (!cameraMoved && now - lastUpdate < MAX_IDLE_INTERVAL) return;
                if (cameraMoved && now - lastUpdate < UPDATE_INTERVAL) return;
                lastUpdate = now;
                lastCamPos = Cesium.Cartesian3.clone(camPos);
                lastCamDir = Cesium.Cartesian3.clone(camDir);

                const camDirNorm = Cesium.Cartesian3.normalize(camDir, scratchCamDir);
                const W = canvas.clientWidth;
                const H = canvas.clientHeight;
                occluder.cameraPosition = camPos;

                const allLayers = this._allLayerNames.map(n => window[n]);

                allLayers.forEach(layer => {
                    if (!layer || !layer.entities || !layer.visible) return;

                    layer.entities.forEach(entity => {
                        try {
                            if (!entity.position || (!entity.point && !entity.billboard)) return;

                            const worldPos = entity.position.getValue(scene.clock.currentTime);
                            if (!worldPos) return;

                            Cesium.Cartesian3.subtract(worldPos, camPos, scratchTo);
                            const dist = Cesium.Cartesian3.magnitude(scratchTo);
                            if (dist < 1) return;

                            Cesium.Cartesian3.divideByScalar(scratchTo, dist, scratchNorm);
                            const dot = Cesium.Cartesian3.dot(camDirNorm, scratchNorm);

                            if (dot < MIN_DOT_THRESHOLD) {
                                entity.show = false;
                                return;
                            }

                            if (occluder.isPointVisible(worldPos) === false) {
                                entity.show = false;
                                return;
                            }

                            try {
                                const screenPos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, worldPos);
                                if (!screenPos ||
                                    screenPos.x < -150 || screenPos.x > W + 150 ||
                                    screenPos.y < -150 || screenPos.y > H + 150) {
                                    entity.show = false;
                                    return;
                                }
                            } catch (e) {
                                entity.show = false;
                                return;
                            }

                            entity.show = true;

                            if (entity.label) {
                                if (dist > LABEL_MAX_DISTANCE) {
                                    entity.label.show = false;
                                } else {
                                    const fadeStart = LABEL_MAX_DISTANCE * 0.6;
                                    if (dist > fadeStart) {
                                        const alpha = 1 - ((dist - fadeStart) / (LABEL_MAX_DISTANCE - fadeStart));
                                        entity.label.translucency = Math.max(0.1, alpha);
                                    } else {
                                        entity.label.translucency = 1.0;
                                    }
                                    entity.label.show = true;
                                }
                            }
                        } catch (e) { /* skip bad entity */ }
                    });
                });
            } catch (e) { /* silently ignore */ }
        };

        scene.preRender.addEventListener(this._cullingUpdate);
        this._cullingListenerAttached = true;
    },

    destroyCulling() {
        if (this.viewer && this.viewer.scene && this.viewer.scene.preRender && this._cullingUpdate && this._cullingListenerAttached) {
            this.viewer.scene.preRender.removeEventListener(this._cullingUpdate);
            this._cullingListenerAttached = false;
        }
    },

    async setupLocalImagery() {
        try {
            this.viewer.imageryLayers.removeAll();
        } catch (_) { /* viewer may be tearing down */ }
        try {
            const provider = await Cesium.SingleTileImageryProvider.fromUrl(
                'assets/textures/earth-texture.jpg'
            );
            this.viewer.imageryLayers.addImageryProvider(provider);
            console.log("Bundled earth texture imagery active.");
        } catch (e) {
            console.warn("Local texture imagery failed; trying OSM.", e);
            try {
                await this.setupFallbackImagery();
            } catch (e2) {
                console.warn("All imagery fallbacks failed; rendering plain ellipsoid.", e2);
            }
        }
    },

    async setupFallbackImagery() {
        this.viewer.imageryLayers.removeAll();
        try {
            const osmProvider = await Cesium.OpenStreetMapImageryProvider.fromUrl(
                'https://a.tile.openstreetmap.org/'
            );
            this.viewer.imageryLayers.addImageryProvider(osmProvider);
        } catch (e) {
            console.warn("OSM fallback imagery also failed.", e);
        }
    }
};
