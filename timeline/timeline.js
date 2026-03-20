const TimelineManager = {
    currentYear: 2025,

    init() {
        const slider = document.getElementById('yearSlider');
        const display = document.getElementById('currentYearDisplay');

        slider.addEventListener('input', (e) => {
            this.currentYear = parseInt(e.target.value);
            display.innerText = this.currentYear;
            this.applyFilters();
        });

        console.log("Timeline Manager Initialized");
    },

    applyFilters() {
        const layers = [DisastersLayer, WarsLayer, MysteryLayer, HistoricalLayer];
        
        layers.forEach(layer => {
            layer.entities.forEach(entity => {
                if (!layer.visible) return; // Respect layer toggle
                
                const entityYear = entity.properties.year.getValue();
                // Show if entity year is less than or equal to current year (historical perspective)
                // Or only if it matches exactly? Let's go with "up to this year" for historical flow
                entity.show = (entityYear <= this.currentYear);
            });
        });
        
        if (typeof updateGlobalStats === 'function') {
            updateGlobalStats();
        }
    }
};
