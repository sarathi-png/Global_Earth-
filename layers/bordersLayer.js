const BordersLayer = {
    dataSource: null,
    visible: false,

    async init() {
        try {
            // Load a simplified world GeoJSON for borders
            // Using a reliable public URL for small-scale world boundaries
            const url = 'https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson';
            
            this.dataSource = await Cesium.GeoJsonDataSource.load(url, {
                stroke: Cesium.Color.fromCssColorString(CONFIG.LAYERS.borders.color).withAlpha(0.8),
                fill: Cesium.Color.fromCssColorString(CONFIG.LAYERS.borders.color).withAlpha(0.05),
                strokeWidth: 2
            });

            GlobeManager.viewer.dataSources.add(this.dataSource);
            this.dataSource.show = this.visible;
            
            // Populating entities for global stats compatibility
            this.entities = this.dataSource.entities.values;
            
            this.applyStabilityStyling();
            
            console.log("Balance of Power (Borders) Layer Initialized");
        } catch (error) {
            console.error("Error loading borders GeoJSON:", error);
        }
    },

    applyStabilityStyling() {
        if (!this.dataSource) return;
        const entities = this.dataSource.entities.values;
        
        entities.forEach(entity => {
            // Simulate 'Balance' by randomly assigning 'stability' for demonstration
            // In a real app, this would come from a data source/API
            const stability = Math.random();
            entity.properties.addProperty('stability', stability);
            
            // Color based on stability (Green to Red)
            if (stability < 0.3) {
                entity.polygon.material = Cesium.Color.RED.withAlpha(0.15);
                entity.polygon.outlineColor = Cesium.Color.RED.withAlpha(0.6);
            } else if (stability > 0.8) {
                entity.polygon.material = Cesium.Color.SPRINGGREEN.withAlpha(0.1);
                entity.polygon.outlineColor = Cesium.Color.SPRINGGREEN.withAlpha(0.6);
            }
        });
    },

    toggleVisibility(show) {
        this.visible = show;
        if (this.dataSource) {
            this.dataSource.show = show;
        }
    }
};
