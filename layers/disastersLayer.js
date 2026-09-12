const DisastersLayer = {
    entities: [],
    entitiesById: {},
    visible: false,
    _key: 'disasters',
    _initialized: false,

    async init() {
        if (!this.visible) return;
        console.log('DisastersLayer: init started');
        try {
            const response = await fetch('data/disasters.json');
            const data = await response.json();
            console.log(`DisastersLayer: Data fetched, length: ${data.length}`);
            this.renderMarkers(data);
            console.log(`DisastersLayer: Finished rendering ${this.entities.length} markers`);
        } catch (error) {
            console.error('DisastersLayer: Error loading disasters data:', error);
        }
    },

    renderMarkers(data) {
        if (!GlobeManager.map) {
            console.error('DisastersLayer: GlobeManager.map is null!');
            return;
        }
        const color = CONFIG.LAYERS.disasters.color;

        data.forEach(item => {
            try {
                const entity = MarkerFactory.createPoint(item, color, this._key);
                entity.show = this.visible;
                this.entities.push(entity);
            } catch (e) {
                console.error('DisastersLayer: Error creating marker for item', item.id, e);
            }
        });

        GlobeManager.syncLayer(this, this._key);
        GlobeManager.setGroupVisible(this._key, this.visible);
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    clearEntities() {
        if (typeof MarkerPulse !== 'undefined') {
            this.entities.forEach((e) => { try { MarkerPulse.remove(e.id); } catch (_) {} });
        }
        this.entities = [];
        this.entitiesById = {};
        GlobeManager.syncLayer(this, this._key);
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show && this.entities.length === 0 && !this._initialized) {
            this._initialized = true;
            this.init();
            return;
        }
        this.entities.forEach(entity => { entity.show = show; });
        GlobeManager.syncLayer(this, this._key);
        GlobeManager.setGroupVisible(this._key, show);
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    }
};

window.DisastersLayer = DisastersLayer;
