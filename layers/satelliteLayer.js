const SatelliteLayer = {
    entities: [],
    visible: false,

    init() {
        console.log("Satellite Layer Initialized");
        this.createSatellites();
    },

    createSatellites() {
        // Create 10 simulated satellites
        for (let i = 0; i < 10; i++) {
            const id = `SAT-${100 + i}`;
            const startAngle = Math.random() * Math.PI * 2;
            const inclination = (Math.random() - 0.5) * Math.PI / 2;
            const altitude = 400000 + Math.random() * 200000; // 400-600km

            const positionProperty = new Cesium.SampledPositionProperty();
            
            // Create a simple orbital path for the next 24 hours
            const startTime = Cesium.JulianDate.now();
            for (let j = 0; j < 360; j += 10) {
                const time = Cesium.JulianDate.addSeconds(startTime, j * 60, new Cesium.JulianDate());
                const angle = startAngle + (j * Math.PI / 180);
                
                // Sphere to Cartesian conversion for orbit
                const x = (Cesium.Ellipsoid.WGS84.maximumRadius + altitude) * Math.cos(angle) * Math.cos(inclination);
                const y = (Cesium.Ellipsoid.WGS84.maximumRadius + altitude) * Math.sin(angle) * Math.cos(inclination);
                const z = (Cesium.Ellipsoid.WGS84.maximumRadius + altitude) * Math.sin(inclination);
                
                const pos = new Cesium.Cartesian3(x, y, z);
                positionProperty.addSample(time, pos);
            }

            const entity = GlobeManager.viewer.entities.add({
                id: id,
                position: positionProperty,
                show: this.visible,
                point: {
                    pixelSize: 5,
                    color: Cesium.Color.fromCssColorString('#00f2ff'),
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 1,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                },
                label: {
                    text: id,
                    font: '10px monospace',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    showBackground: true,
                    backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
                    pixelOffset: new Cesium.Cartesian2(0, -15),
                    eyeOffset: new Cesium.Cartesian3(0, 0, -1000)
                },
                path: {
                    resolution: 1,
                    material: new Cesium.PolylineGlowMaterialProperty({
                        glowPower: 0.1,
                        color: Cesium.Color.fromCssColorString('#00f2ff').withAlpha(0.3)
                    }),
                    width: 2,
                    leadTime: 0,
                    trailTime: 5000
                }
            });

            this.entities.push(entity);
        }
    },

    toggleVisibility(show) {
        this.visible = show;
        this.entities.forEach(e => e.show = show);
    }
};
