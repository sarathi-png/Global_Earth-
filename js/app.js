// Global Application Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Initializing Intelligence Platform...");

    try {
        await GlobeManager.init('globeContainer');
    } catch (e) {
        console.error("GlobeManager init failed:", e);
    }

    try {
        if (typeof TerrainManager !== 'undefined' && TerrainManager.init) TerrainManager.init();
    } catch (e) {
        console.warn("TerrainManager init failed:", e);
    }

    try {
        if (typeof ControlManager !== 'undefined' && ControlManager.init) ControlManager.init();
    } catch (e) {
        console.warn("ControlManager init failed:", e);
    }

    const layerInitPromises = [];
    const layerNames = ['DisastersLayer', 'WarsLayer', 'MysteryLayer', 'HistoricalLayer', 'BordersLayer'];
    layerNames.forEach(name => {
        if (typeof window[name] !== 'undefined' && window[name].init) {
            layerInitPromises.push(
                window[name].init().catch(e => console.warn(`${name} init failed:`, e))
            );
        }
    });

    await Promise.allSettled(layerInitPromises);

    ['AircraftLayer', 'SatelliteLayer', 'WeatherLayer'].forEach(name => {
        if (typeof window[name] !== 'undefined' && window[name].init) {
            try {
                window[name].init();
            } catch (e) {
                console.warn(`${name} init failed:`, e);
            }
        }
    });

    try {
        if (typeof SearchEngine !== 'undefined') {
            SearchEngine.init();
            SearchEngine.updateIndex();
        }
    } catch (e) {
        console.warn("SearchEngine init failed:", e);
    }

    try {
        if (typeof SearchUI !== 'undefined' && SearchUI.init) SearchUI.init();
    } catch (e) {
        console.warn("SearchUI init failed:", e);
    }

    try {
        if (typeof TimelineManager !== 'undefined' && TimelineManager.init) TimelineManager.init();
    } catch (e) {
        console.warn("TimelineManager init failed:", e);
    }

    try {
        if (typeof DrawerManager !== 'undefined' && DrawerManager.init) DrawerManager.init();
    } catch (e) {
        console.warn("DrawerManager init failed:", e);
    }

    try {
        if (typeof HoverPopup !== 'undefined' && HoverPopup.init) HoverPopup.init();
    } catch (e) {
        console.warn("HoverPopup init failed:", e);
    }

    try {
        if (typeof UIAnimations !== 'undefined' && UIAnimations.init) UIAnimations.init();
    } catch (e) {
        console.warn("UIAnimations init failed:", e);
    }

    try {
        if (typeof ClusteringManager !== 'undefined' && ClusteringManager.init) ClusteringManager.init();
    } catch (e) {
        console.warn("ClusteringManager init failed:", e);
    }

    try {
        if (typeof CameraManager !== 'undefined' && CameraManager.home) CameraManager.home();
    } catch (e) {
        console.warn("CameraManager.home failed:", e);
    }

    setupUIListeners();
    syncAllLayerVisibility();
    updateLegendVisibility();
    updateGlobalStats();

    console.log("System Online");
    
    window.DisastersLayer = DisastersLayer;
    window.WarsLayer = WarsLayer;
    window.SearchEngine = SearchEngine;
    window.TimelineManager = TimelineManager;
    window.GlobeManager = GlobeManager;
    window.App = { status: "Online", version: "1.0.0" };
});

function updateLegendVisibility() {
    const toggleMap = {
        'toggleDisasters': 'disasters',
        'toggleWars': 'wars',
        'toggleMysteries': 'mysteries',
        'toggleHistory': 'history',
        'toggleAircraft': 'aircraft',
        'toggleSat': 'sat',
        'toggleWeather': 'weather',
        'toggleBorders': 'borders'
    };

    Object.entries(toggleMap).forEach(([toggleId, layerClass]) => {
        const el = document.getElementById(toggleId);
        const legendItem = document.querySelector(`.legend-item[data-layer="${layerClass}"]`);
        if (!el || !legendItem) return;

        if (el.checked) {
            legendItem.classList.remove('hidden-layer');
        } else {
            legendItem.classList.add('hidden-layer');
        }
    });
}

function syncAllLayerVisibility() {
    const toggleMap = {
        'toggleDisasters': DisastersLayer,
        'toggleWars': WarsLayer,
        'toggleMysteries': MysteryLayer,
        'toggleHistory': HistoricalLayer,
        'toggleAircraft': AircraftLayer,
        'toggleSat': SatelliteLayer,
        'toggleWeather': WeatherLayer,
        'toggleBorders': BordersLayer
    };

    Object.entries(toggleMap).forEach(([toggleId, layer]) => {
        const el = document.getElementById(toggleId);
        if (!el || !layer) return;
        const isChecked = el.checked;
        layer.visible = isChecked;
        if (layer.toggleVisibility) {
            layer.toggleVisibility(isChecked);
        }
    });
}

function updateGlobalStats() {
    let total = 0;
    const layers = [DisastersLayer, WarsLayer, MysteryLayer, HistoricalLayer, BordersLayer, AircraftLayer, SatelliteLayer];
    layers.forEach(l => {
        if (!l) return;
        if (l.visible && l.entities) {
            l.entities.forEach(e => {
                if (e.show) total++;
            });
        }
    });
    const badge = document.getElementById('activeMarkerCount');
    if (badge) badge.innerText = total;
}

function setupUIListeners() {
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
                if (t.layer) {
                    t.layer.visible = e.target.checked;
                    if (t.layer.toggleVisibility) {
                        t.layer.toggleVisibility(e.target.checked);
                    }
                    updateGlobalStats();
                    if (window.TimelineManager && window.TimelineManager.applyFilters) {
                        window.TimelineManager.applyFilters();
                    }
                    if (typeof updateLegendVisibility === 'function') {
                        updateLegendVisibility();
                    }
                }
            });
        }
    });

    const yearSlider = document.getElementById('yearSlider');
    const yearDisplay = document.getElementById('currentYearDisplay');
    
    if (yearSlider && yearDisplay) {
        yearSlider.addEventListener('input', (e) => {
            yearDisplay.innerText = e.target.value;
        });
    }
}
