const DisastersLayer = {
    entities: [],
    visible: true,

    async init() {
        try {
            const response = await fetch('data/disasters.json');
            const data = await response.json();
            this.renderMarkers(data);
            console.log(`Disasters Layer Initialized: ${data.length} markers`);
        } catch (error) {
            console.error("Error loading disasters data:", error);
        }
    },

    renderMarkers(data) {
        if (!GlobeManager.viewer) return;

        data.forEach(item => {
            const entity = GlobeManager.viewer.entities.add({
                name: item.title,
                position: Cesium.Cartesian3.fromDegrees(item.lng, item.lat, 1000),
                point: {
                    pixelSize: 12,
                    color: Cesium.Color.fromCssColorString(CONFIG.LAYERS.disasters.color),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                },
                properties: {
                    title: item.title,
                    description: item.description,
                    type: item.type,
                    year: item.year,
                    severity: item.severity,
                    lat: item.lat,
                    lng: item.lng
                }
            });
            this.entities.push(entity);
        });

        document.getElementById('activeMarkerCount').innerText = this.entities.length;
    },

    toggleVisibility(show) {
        this.visible = show;
        this.entities.forEach(entity => {
            entity.show = show;
        });
    }
};
