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

            // Only add world terrain if token is present
            if (CONFIG.CESIUM_TOKEN) {
                try {
                    viewerOptions.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
                        'https://assets.ion.cesium.com/asset_depot/1/terrain/v1/'
                    );
                } catch (e) {
                    console.warn("Terrain failed, falling back to ellipsoid.");
                }
            }

            this.viewer = new Cesium.Viewer(containerId, viewerOptions);

            const scene = this.viewer.scene;
            const globe = scene.globe;

            // Premium Visuals
            globe.enableLighting = CONFIG.GLOBE_SETTINGS.enableLighting;
            globe.showGroundAtmosphere = CONFIG.GLOBE_SETTINGS.enableAtmosphere;
            globe.baseColor = Cesium.Color.fromCssColorString(CONFIG.GLOBE_SETTINGS.baseColor);

            scene.skyAtmosphere.show = true;
            scene.fog.enabled = true;
            scene.fog.density = 0.0001;

            // Imagery Setup
            if (CONFIG.CESIUM_TOKEN) {
                try {
                    this.viewer.imageryLayers.removeAll();
                    this.viewer.imageryLayers.addImageryProvider(
                        await Cesium.IonImageryProvider.fromAssetId(3812) // Blue Marble
                    );
                } catch (e) {
                    console.warn("Ion Imagery failed, using default.");
                    this.setupFallbackImagery();
                }
            } else {
                console.log("No Cesium Token; using OpenStreetMap fallback.");
                this.setupFallbackImagery();
            }
            
            console.log("Cesium Globe Initialized");
            
            // Explicitly set base color again to ensure it's applied if no imagery
            globe.baseColor = Cesium.Color.fromCssColorString(CONFIG.GLOBE_SETTINGS.baseColor);
            
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

    setupFallbackImagery() {
        this.viewer.imageryLayers.removeAll();
        // Use OpenStreetMap for a functional globe without a token
        this.viewer.imageryLayers.addImageryProvider(
            new Cesium.OpenStreetMapImageryProvider({
                url : 'https://a.tile.openstreetmap.org/'
            })
        );
    }
};
