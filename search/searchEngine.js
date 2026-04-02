const SearchEngine = {
    index: [],

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
            window.SatelliteLayer
        ];
        
        layers.forEach(layer => {
            if (!layer || !layer.entities) {
                console.warn("SearchEngine: Layer missing or entities not initialized", layer);
                return;
            }

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
                    entity: entity
                });
            });
        });
        console.log(`SearchEngine: Index updated with ${this.index.length} items`);
    },

    search(query) {
        if (!query) return [];
        const q = query.toLowerCase();
        
        return this.index.filter(item => 
            item.title.toLowerCase().includes(q) || 
            item.country.toLowerCase().includes(q) ||
            item.type.toLowerCase().includes(q) ||
            item.year.toString().includes(q) ||
            item.description.toLowerCase().includes(q)
        ).slice(0, 10);
    }
};

window.SearchEngine = SearchEngine;
