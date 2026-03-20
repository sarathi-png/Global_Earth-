const SearchEngine = {
    index: [],

    init() {
        console.log("Search Engine Initialized");
    },

    updateIndex() {
        this.index = [];
        const layers = [DisastersLayer, WarsLayer, MysteryLayer, HistoricalLayer];
        
        layers.forEach(layer => {
            layer.entities.forEach(entity => {
                const props = entity.properties;
                this.index.push({
                    id: props.id ? props.id.getValue() : Math.random().toString(),
                    title: props.title.getValue(),
                    type: props.type.getValue(),
                    country: props.country ? props.country.getValue() : 'Global',
                    year: props.year.getValue(),
                    lat: props.lat.getValue(),
                    lng: props.lng.getValue(),
                    entity: entity
                });
            });
        });
    },

    search(query) {
        if (!query) return [];
        const q = query.toLowerCase();
        
        return this.index.filter(item => 
            item.title.toLowerCase().includes(q) || 
            item.country.toLowerCase().includes(q) ||
            item.type.toLowerCase().includes(q) ||
            item.year.toString().includes(q)
        ).slice(0, 10); // Limit results
    }
};
