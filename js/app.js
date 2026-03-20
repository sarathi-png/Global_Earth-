// Global Application Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Initializing Intelligence Platform...");

    // 1. Initialize Engine
    await GlobeManager.init('globeContainer');
    CameraManager.init();

    // 2. Initialize Managers
    TerrainManager.init();
    ControlManager.init();

    // 3. Initialize layers
    await Promise.all([
        DisastersLayer.init(),
        WarsLayer.init(),
        MysteryLayer.init(),
        HistoricalLayer.init(),
        BordersLayer.init()
    ]);
    
    AircraftLayer.init();
    SatelliteLayer.init();
    WeatherLayer.init();

    // 4. Initialize Systems
    SearchEngine.init();
    SearchEngine.updateIndex();
    SearchUI.init();
    TimelineManager.init();
    
    // Phase 4 Systems
    DrawerManager.init();
    HoverPopup.init();
    UIAnimations.init();
    ClusteringManager.init();

    // 5. Set Initial Camera
    CameraManager.home();

    // 6. Global Event Listeners
    setupUIListeners();

    updateGlobalStats();

    console.log("System Online");
});

function updateGlobalStats() {
    let total = 0;
    const layers = [DisastersLayer, WarsLayer, MysteryLayer, HistoricalLayer, BordersLayer];
    layers.forEach(l => {
        if (l.visible) {
            // For borders, we don't count individual segments as markers yet
            if (l.entities) {
                l.entities.forEach(e => {
                    if (e.show) total++;
                });
            }
        }
    });
    document.getElementById('activeMarkerCount').innerText = total;
}

function setupUIListeners() {
    // Note: Sidebar animation handled by UIAnimations.js
    
    // Layer Toggles
    const toggles = [
        { id: 'toggleDisasters', layer: DisastersLayer },
        { id: 'toggleWars', layer: WarsLayer },
        { id: 'toggleMysteries', layer: MysteryLayer },
        { id: 'toggleHistory', layer: HistoricalLayer },
        { id: 'toggleAircraft', layer: AircraftLayer },
        { id: 'toggleSat', layer: SatelliteLayer },
        { id: 'toggleWeather', layer: WeatherLayer },
        { id: 'toggleBorders', layer: BordersLayer }
    ];

    toggles.forEach(t => {
        const el = document.getElementById(t.id);
        if (el) {
            el.addEventListener('change', (e) => {
                t.layer.toggleVisibility(e.target.checked);
                TimelineManager.applyFilters(); // Re-apply current year filter
            });
        }
    });

    // Year Slider
    const yearSlider = document.getElementById('yearSlider');
    const yearDisplay = document.getElementById('currentYearDisplay');
    
    yearSlider.addEventListener('input', (e) => {
        yearDisplay.innerText = e.target.value;
    });
}
