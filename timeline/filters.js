const FilterSystem = {
    activeFilters: {
        severity: 'all',
        type: 'all'
    },

    init() {
        console.log("Filter System Ready");
    },

    setFilter(key, value) {
        this.activeFilters[key] = value;
        TimelineManager.applyFilters();
    }
};
