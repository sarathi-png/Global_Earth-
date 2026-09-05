const MysteryLayer = {
    entities: [],
    visible: false,

    async init() {
        if (!this.visible) return;
        try {
            const response = await fetch('data/mysteries.json');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            this.renderMarkers(data);
            console.log(`Mysteries Layer Initialized: ${data.length} markers`);
        } catch (error) {
            console.error("Error loading mysteries data:", error);
        }
    },

    renderMarkers(data) {
        if (!GlobeManager.viewer) return;
        const color = CONFIG.LAYERS.mysteries ? CONFIG.LAYERS.mysteries.color : '#bf5af2';

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

window.MysteryLayer = MysteryLayer;

