const SearchEngine = {
    index: [],
    _rebuildTimer: null,

    init() {
        console.log("Search Engine Initialized");
    },

    getVal(prop) {
        if (prop === null || prop === undefined) return prop;
        if (typeof prop.getValue === 'function') return prop.getValue();
        return prop;
    },

    updateIndex() {
        console.log("SearchEngine: Updating index...");
        this.index = [];
        const layers = [
            window.DisastersLayer,
            window.WarsLayer,
            window.MysteryLayer,
            window.HistoricalLayer,
            window.AircraftLayer,
            window.SatelliteLayer,
            window.LiveLayer
        ];

        layers.forEach(layer => {
            if (!layer || !layer.entities) return;
            layer.entities.forEach(entity => {
                const props = entity.properties;
                if (!props || !props.title) return;
                const title = this.getVal(props.title);
                if (!title) return;
                this.index.push({
                    id: this.getVal(props.id) || `${title}-${this.getVal(props.lat) || 0}-${this.getVal(props.lng) || 0}`,
                    title: title,
                    type: this.getVal(props.type) || 'info',
                    description: this.getVal(props.description) || '',
                    country: this.getVal(props.country) || this.getVal(props.source) || 'Global',
                    year: this.getVal(props.year) || 'N/A',
                    lat: this.getVal(props.lat) || 0,
                    lng: this.getVal(props.lng) || 0,
                    source: this.getVal(props.source) || '',
                    category: this.getVal(props.category) || '',
                    entity: entity
                });
            });
        });
        console.log(`SearchEngine: Index updated with ${this.index.length} items`);
    },

    rebuildIndex() {
        if (this._rebuildTimer) clearTimeout(this._rebuildTimer);
        this._rebuildTimer = setTimeout(() => this.updateIndex(), 200);
    },

    search(query) {
        if (!query) return [];
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) return [];
        return this.index.filter(item => {
            const haystack = [
                item.title, item.country, item.type, item.description,
                item.source, item.category, String(item.year)
            ].join(' ').toLowerCase();
            return words.every(w => haystack.includes(w));
        }).slice(0, 10);
    }
};

window.SearchEngine = SearchEngine;
