const WarsLayer = {
    entities: [],
    entitiesById: {},
    visible: false,
    _key: 'wars',
    _initialized: false,

    async init() {
        if (!this.visible) return;
        try {
            const response = await fetch('data/wars.json');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            this.renderMarkers(data);
            console.log(`Wars Layer Initialized: ${data.length} markers`);
        } catch (error) {
            console.error('Error loading wars data:', error);
        }
    },

    renderMarkers(data) {
        if (!GlobeManager.map) return;
        const color = CONFIG.LAYERS.wars ? CONFIG.LAYERS.wars.color : '#ff3b30';

        data.forEach(item => {
            const entity = MarkerFactory.createPoint(item, color, this._key);
            entity.show = this.visible;
            this.entities.push(entity);
            if (entity.properties.severity === 'Critical' || entity.properties.severity === 'Extreme') {
                if (typeof MarkerPulse !== 'undefined') MarkerPulse.create(entity);
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

window.WarsLayer = WarsLayer;
