const MysteryLayer = {
    entities: [],
    visible: false,

    async init() {
        try {
            const response = await fetch('data/mysteries.json');
            const data = await response.json();
            this.renderMarkers(data);
        } catch (error) {
            console.error("Error loading mysteries data:", error);
        }
    },

    renderMarkers(data) {
        if (!GlobeManager.viewer) return;
        const color = '#bf5af2';

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
