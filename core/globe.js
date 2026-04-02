const GlobeManager = {
    viewer: null,

    async init(containerId) {
        try {
            const viewerOptions = {
                animation: false,
                baseLayerPicker: false,
                fullscreenButton: false,
                geocoder: false,
                homeButton: false,
                infoBox: false,
                sceneModePicker: false,
                selectionIndicator: false,
                timeline: false,
                navigationHelpButton: false,
                navigationInstructionsInitiallyVisible: false,
                scene3DOnly: true,
                shouldAnimate: true
            };

            if (CONFIG.CESIUM_TOKEN) {
                try {
                    viewerOptions.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
                } catch (e) {
                    console.warn("Terrain failed, falling back to ellipsoid.");
                }
            }

            this.viewer = new Cesium.Viewer(containerId, viewerOptions);

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

            if (CONFIG.CESIUM_TOKEN) {
                try {
                    this.viewer.imageryLayers.removeAll();
                    this.viewer.imageryLayers.addImageryProvider(
                        await Cesium.IonImageryProvider.fromAssetId(3)
                    );
                } catch (e) {
                    console.warn("Ion Imagery failed, using default.");
                    await this.setupFallbackImagery();
                }
            } else {
                console.log("No Cesium Token; using OpenStreetMap fallback.");
                await this.setupFallbackImagery();
            }

            this.initFrustumCulling();
            console.log("Cesium Globe Initialized");
            return this.viewer;
        } catch (error) {
            console.error("Error initializing Cesium Globe:", error);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="glass-panel" style="margin: 20px; padding: 30px; color: #ff3b30; text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 15px;"></i>
                        <h3>Engine Initialization Failure</h3>
                        <p style="color: #ccc; margin-top: 10px;">The 3D engine failed to start. This usually happens due to script blocking or invalid configuration.</p>
                        <ul style="text-align: left; display: inline-block; margin-top: 15px; color: #aaa;">
                            <li>Check your internet connection</li>
                            <li>Ensure CesiumJS script is loaded</li>
                            <li>Add a valid CESIUM_TOKEN in <code style="color: #00f2ff;">js/config.js</code></li>
                        </ul>
                    </div>
                `;
            }
        }
    },

    initFrustumCulling() {
        if (!this.viewer) return;

        const scene = this.viewer.scene;
        const camera = this.viewer.camera;
        const canvas = scene.canvas;

        let lastUpdate = 0;
        const UPDATE_INTERVAL = 200;

        scene.preRender.addEventListener(() => {
            try {
                const now = Date.now();
                if (now - lastUpdate < UPDATE_INTERVAL) return;
                lastUpdate = now;

                const camPos = camera.position;
                const camDir = Cesium.Cartesian3.normalize(camera.direction, new Cesium.Cartesian3());
                const W = canvas.clientWidth;
                const H = canvas.clientHeight;

                const allLayers = [
                    window.DisastersLayer,
                    window.WarsLayer,
                    window.MysteryLayer,
                    window.HistoricalLayer,
                    window.AircraftLayer,
                    window.SatelliteLayer
                ];

                allLayers.forEach(layer => {
                    if (!layer || !layer.entities) return;

                    layer.entities.forEach(entity => {
                        if (!entity.position || !entity.point || !entity.label) return;

                        const worldPos = entity.position.getValue(scene.clock.currentTime);
                        if (!worldPos) return;

                        const toPoint = Cesium.Cartesian3.subtract(worldPos, camPos, new Cesium.Cartesian3());
                        const dist = Cesium.Cartesian3.magnitude(toPoint);
                        if (dist < 1) return;

                        const toPointNorm = Cesium.Cartesian3.divideByScalar(toPoint, dist, new Cesium.Cartesian3());
                        const dot = Cesium.Cartesian3.dot(camDir, toPointNorm);

                        if (dot < 0.1) {
                            entity.label.show = false;
                            entity.point.show = false;
                            return;
                        }

                        try {
                            const screenPos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, worldPos);
                            if (!screenPos ||
                                screenPos.x < -100 || screenPos.x > W + 100 ||
                                screenPos.y < -100 || screenPos.y > H + 100) {
                                entity.label.show = false;
                                entity.point.show = false;
                                return;
                            }
                        } catch (e) {
                            entity.label.show = false;
                            entity.point.show = false;
                            return;
                        }

                        entity.point.show = true;
                        entity.label.show = true;
                    });
                });
            } catch (e) {
                // Silently ignore frustum culling errors to prevent render crashes
            }
        });
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
