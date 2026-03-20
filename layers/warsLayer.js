const WarsLayer = {
    entities: [],
    visible: false,

    async init() {
        try {
            const response = await fetch('data/wars.json');
            const data = await response.json();
            this.renderMarkers(data);
        } catch (error) {
            console.error("Error loading wars data:", error);
        }
    },

    renderMarkers(data) {
        if (!GlobeManager.viewer) return;
        const color = CONFIG.LAYERS.wars ? CONFIG.LAYERS.wars.color : '#ff3b30';

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
        this.updateMarkerCount();
    },

    updateMarkerCount() {
        const activeCount = document.querySelectorAll('.layer-item input:checked').length;
        // Simple count update logic for Phase 2
    }
};
