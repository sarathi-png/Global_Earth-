const HistoricalLayer = {
    entities: [],
    visible: false,

    async init() {
        try {
            const response = await fetch('data/historical-events.json');
            const data = await response.json();
            this.renderMarkers(data);
            console.log(`Historical Layer Initialized: ${data.length} markers`);
        } catch (error) {
            console.error("Error loading historical data:", error);
        }
    },

    renderMarkers(data) {
        if (!GlobeManager.viewer) return;
        const color = CONFIG.LAYERS.historical ? CONFIG.LAYERS.historical.color : '#00f2ff';

        data.forEach(item => {
            const entity = MarkerFactory.createPoint(item, color);
            entity.show = this.visible;
            this.entities.push(entity);
        });
    },

    toggleVisibility(show) {
        this.visible = show;
        this.entities.forEach(entity => {
            entity.show = show;
        });
    }
};

window.HistoricalLayer = HistoricalLayer;

