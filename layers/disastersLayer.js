const DisastersLayer = {
    entities: [],
    visible: false,

    async init() {
        if (!this.visible) return;
        console.log("DisastersLayer: init started");
        try {
            const response = await fetch('data/disasters.json');
            const data = await response.json();
            console.log(`DisastersLayer: Data fetched, length: ${data.length}`);
            this.renderMarkers(data);
            console.log(`DisastersLayer: renderMarkers called, entities now: ${this.entities.length}`);
        } catch (error) {
            console.error("DisastersLayer: Error loading disasters data:", error);
        }
    },

    renderMarkers(data) {
        console.log("DisastersLayer: renderMarkers started");
        if (!GlobeManager.viewer) {
            console.error("DisastersLayer: GlobeManager.viewer is null!");
            return;
        }
        const color = CONFIG.LAYERS.disasters.color;

        data.forEach(item => {
            try {
                const entity = MarkerFactory.createPoint(item, color);
                entity.show = this.visible;
                this.entities.push(entity);
            } catch (e) {
                console.error("DisastersLayer: Error creating marker for item", item.id, e);
            }
        });

        document.getElementById('activeMarkerCount').innerText = this.entities.length;
        console.log(`DisastersLayer: Finished rendering ${this.entities.length} markers`);
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

window.DisastersLayer = DisastersLayer;
