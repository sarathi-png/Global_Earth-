const WeatherLayer = {
    entities: [],
    visible: false,

    init() {
        console.log("Weather Layer Initialized");
        this.createWeatherMarkers();
    },

    createWeatherMarkers() {
        const conditions = [
            { type: "Storm", lat: 35.0, lng: -75.0, icon: "fa-bolt", color: "#ffea00" },
            { type: "Cyclone", lat: 15.0, lng: 90.0, icon: "fa-wind", color: "#00f2ff" },
            { type: "Heatwave", lat: 25.0, lng: 45.0, icon: "fa-sun", color: "#ff3b30" },
            { type: "Heavy Snow", lat: 60.0, lng: 10.0, icon: "fa-snowflake", color: "#ffffff" }
        ];

        conditions.forEach(c => {
            const entity = GlobeManager.viewer.entities.add({
                name: `${c.type} Warning`,
                position: Cesium.Cartesian3.fromDegrees(c.lng, c.lat, 20000),
                show: this.visible,
                billboard: {
                    image: this.createSymbolCanvas(c.icon, c.color),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                },
                properties: {
                    id: new Cesium.ConstantProperty(`weather-${c.type}`),
                    title: new Cesium.ConstantProperty(`${c.type} System`),
                    type: new Cesium.ConstantProperty('weather'),
                    description: new Cesium.ConstantProperty(`Severe ${c.type} system detected via satellite imaging. High probability of operational impact.`),
                    year: new Cesium.ConstantProperty(new Date().getFullYear()),
                    severity: new Cesium.ConstantProperty('Critical'),
                    source: new Cesium.ConstantProperty('NOAA / Global Weather')
                }
            });
            this.entities.push(entity);
        });
    },

    createSymbolCanvas(iconClass, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        
        // Draw glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        
        // Draw circle background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.arc(24, 24, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // FontAwesome icons are tricky to draw on canvas without loading fonts
        // We will draw a representative shape
        ctx.fillStyle = color;
        ctx.shadowBlur = 0;
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠', 24, 24);

        return canvas;
    },

    toggleVisibility(show) {
        this.visible = show;
        this.entities.forEach(e => e.show = show);
    }
};

window.WeatherLayer = WeatherLayer;
