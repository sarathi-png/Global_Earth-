const AircraftLayer = {
    entities: [],
    visible: false,

    init() {
        console.log("Aircraft Layer Initialized (Simulated Pathing)");
        this.createFlights();
    },

    createFlights() {
        const hubs = [
            { name: "JFK", lat: 40.6413, lng: -73.7781 },
            { name: "LHR", lat: 51.4700, lng: -0.4543 },
            { name: "HND", lat: 35.5494, lng: 139.7798 },
            { name: "DXB", lat: 25.2532, lng: 55.3657 },
            { name: "SIN", lat: 1.3644, lng: 103.9915 }
        ];

        for (let i = 0; i < 8; i++) {
            const start = hubs[Math.floor(Math.random() * hubs.length)];
            let end = hubs[Math.floor(Math.random() * hubs.length)];
            while (end === start) end = hubs[Math.floor(Math.random() * hubs.length)];

            const id = `FLIGHT-${800 + i}`;
            const altitude = 10000 + Math.random() * 2000; // 10-12km
            
            const positionProperty = new Cesium.SampledPositionProperty();
            const startPos = Cesium.Cartesian3.fromDegrees(start.lng, start.lat, altitude);
            const endPos = Cesium.Cartesian3.fromDegrees(end.lng, end.lat, altitude);
            
            const startTime = Cesium.JulianDate.now();
            const duration = 10000 + Math.random() * 5000;
            const endTime = Cesium.JulianDate.addSeconds(startTime, duration, new Cesium.JulianDate());

            positionProperty.addSample(startTime, startPos);
            positionProperty.addSample(endTime, endPos);

            const entity = GlobeManager.viewer.entities.add({
                id: id,
                position: positionProperty,
                orientation: new Cesium.VelocityOrientationProperty(positionProperty),
                show: this.visible,
                properties: {
                    id: new Cesium.ConstantProperty(id),
                    title: new Cesium.ConstantProperty(id),
                    type: new Cesium.ConstantProperty('aircraft'),
                    description: new Cesium.ConstantProperty(`Automated flight path from ${start.name} to ${end.name}. Altitude: ${Math.floor(altitude)}m.`),
                    year: new Cesium.ConstantProperty(new Date().getFullYear()),
                    severity: new Cesium.ConstantProperty('Low')
                },
                point: {
                    pixelSize: 6,
                    color: Cesium.Color.fromCssColorString('#ffffff'),
                    outlineColor: Cesium.Color.fromCssColorString('#00f2ff'),
                    outlineWidth: 2,
                    disableDepthTestDistance: 1000000
                },
                label: {
                    text: id,
                    font: '10px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    showBackground: true,
                    backgroundColor: new Cesium.Color(0, 0, 0, 0.5),
                    pixelOffset: new Cesium.Cartesian2(0, -15)
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

window.AircraftLayer = AircraftLayer;
