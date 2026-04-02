const TimelineManager = {
    currentYear: 2025,

    init() {
        const slider = document.getElementById('yearSlider');
        const display = document.getElementById('currentYearDisplay');

        if (slider) {
            slider.addEventListener('input', (e) => {
                this.currentYear = parseInt(e.target.value);
                display.innerText = this.currentYear;
                this.applyFilters();
            });
        }

        const playBtn = document.getElementById('playTimeline');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlay());
        }

        console.log("Timeline Manager Initialized");
        this.applyFilters();
    },

    applyFilters() {
        const layers = [
            window.DisastersLayer, 
            window.WarsLayer, 
            window.MysteryLayer, 
            window.HistoricalLayer, 
            window.AircraftLayer, 
            window.SatelliteLayer
        ];
        
        layers.forEach(layer => {
            if (!layer || !layer.entities) return;
            layer.entities.forEach(entity => {
                if (!layer.visible) return; // Respect layer toggle
                
                // For simulated layers that don't use ConstantProperty yet, we add a check
                const propYear = entity.properties.year;
                const entityYear = (propYear && typeof propYear.getValue === 'function') ? propYear.getValue() : propYear;
                
                entity.show = (entityYear <= this.currentYear);
            });
        });
        
        if (typeof updateGlobalStats === 'function') {
            updateGlobalStats();
        }
    },

    playInterval: null,
    isPlaying: false,

    togglePlay() {
        const btn = document.getElementById('playTimeline');
        const icon = btn ? btn.querySelector('i') : null;
        const slider = document.getElementById('yearSlider');
        
        if (this.isPlaying) {
            clearInterval(this.playInterval);
            if (icon) icon.className = 'fas fa-play';
            this.isPlaying = false;
        } else {
            if (parseInt(slider.value) >= parseInt(slider.max)) {
                slider.value = slider.min;
                this.currentYear = parseInt(slider.min);
                document.getElementById('currentYearDisplay').innerText = slider.min;
                this.applyFilters();
            }

            if (icon) icon.className = 'fas fa-pause';
            this.isPlaying = true;
            
            this.playInterval = setInterval(() => {
                let nextYear = parseInt(slider.value) + 1;
                
                if (nextYear > parseInt(slider.max)) {
                    this.togglePlay();
                    return;
                }
                
                slider.value = nextYear;
                this.currentYear = nextYear;
                document.getElementById('currentYearDisplay').innerText = nextYear;
                this.applyFilters();
            }, 800);
        }
    }
};

window.TimelineManager = TimelineManager;
