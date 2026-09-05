const HistoricalLayer = {
    entities: [],
    visible: false,

    async init() {
        if (!this.visible) return;
        try {
            const response = await fetch('data/historical-events.json');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            this.renderMarkers(data);
            console.log(`Historical Layer Initialized: ${data.length} markers`);
        } catch (error) {
            console.error("Error loading historical data:", error);
        }
    },

    renderMarkers(data) {
        if (!GlobeManager.viewer) return;
        const color = CONFIG.LAYERS.historical ? CONFIG.LAYERS.historical.color : '#9cdef2';

        data.forEach(item => {
            const entity = MarkerFactory.createPoint(item, color);
            entity.show = this.visible;
            this.entities.push(entity);
        });
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show && this.entities.length === 0 && !this._initialized) {
            this._initialized = true;
            this.init();
        }
        this.entities.forEach(entity => {
            entity.show = show;
        });
    }
};

window.HistoricalLayer = HistoricalLayer;

