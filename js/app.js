const GIBSLayerManager = {
    activeLayer: null,
    visible: false,

    async toggle(show) {
        this.visible = show;
        if (show) {
            if (!this.activeLayer) {
                this.activeLayer = await GlobeManager.addGIBSLayer('MODIS_Terra_CorrectedReflectance_TrueColor');
            }
            if (this.activeLayer) this.activeLayer.show = true;
        } else if (this.activeLayer) {
            this.activeLayer.show = false;
        }
    }
};

const URLStateManager = {
    params: {},

    init() {
        this.params = new URLSearchParams(window.location.search);
        if (this.params.has('lat') && this.params.has('lng')) {
            const lat = parseFloat(this.params.get('lat'));
            const lng = parseFloat(this.params.get('lng'));
            const zoom = parseFloat(this.params.get('zoom') || '5000000');
            if (!isNaN(lat) && !isNaN(lng) && GlobeManager.viewer) {
                GlobeManager.viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(lng, lat, zoom),
                    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
                    duration: 0
                });
            }
        }
        if (this.params.has('layers')) {
            const layerMap = {
                'disasters': 'toggleDisasters', 'wars': 'toggleWars',
                'mysteries': 'toggleMysteries', 'history': 'toggleHistory',
                'aircraft': 'toggleAircraft', 'sat': 'toggleSat',
                'weather': 'toggleWeather', 'borders': 'toggleBorders',
                'live': 'toggleLive', 'gibs': 'toggleGIBS', 'streetview': 'toggleStreetView', 'osiris': 'toggleOsiris'
            };
            const layers = this.params.get('layers').split(',');
            Object.entries(layerMap).forEach(([key, toggleId]) => {
                const el = document.getElementById(toggleId);
                if (el) el.checked = layers.includes(key);
            });
        }
    },

    update() {
        if (!GlobeManager.viewer) return;
        const cam = GlobeManager.viewer.camera;
        const carto = Cesium.Cartographic.fromCartesian(cam.position);
        const params = new URLSearchParams();
        params.set('lat', Cesium.Math.toDegrees(carto.latitude).toFixed(4));
        params.set('lng', Cesium.Math.toDegrees(carto.longitude).toFixed(4));
        params.set('zoom', Math.round(carto.height).toString());
        const activeLayers = [];
        const layerMap = {
            'toggleDisasters': 'disasters', 'toggleWars': 'wars',
            'toggleMysteries': 'mysteries', 'toggleHistory': 'history',
            'toggleAircraft': 'aircraft', 'toggleSat': 'sat',
            'toggleWeather': 'weather', 'toggleBorders': 'borders',
            'toggleLive': 'live', 'toggleGIBS': 'gibs', 'toggleHeatmap': 'heatmap', 'toggleRipple': 'ripple', 'toggleDayNight': 'daynight',
            'toggleStreetView': 'streetview', 'toggleOsiris': 'osiris'
        };
        Object.entries(layerMap).forEach(([toggleId, key]) => {
            const el = document.getElementById(toggleId);
            if (el && el.checked) activeLayers.push(key);
        });
        if (activeLayers.length) params.set('layers', activeLayers.join(','));
        const newUrl = window.location.pathname + '?' + params.toString();
        window.history.replaceState({}, '', newUrl);
    }
};

window.GIBSLayerManager = GIBSLayerManager;
window.URLStateManager = URLStateManager;

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

    await new Promise(resolve => requestAnimationFrame(resolve));

    setTimeout(() => {
        const layerInitPromises = [];
        const layerNames = ['DisastersLayer', 'WarsLayer', 'MysteryLayer', 'HistoricalLayer', 'BordersLayer', 'LiveLayer'];
        layerNames.forEach(name => {
            if (typeof window[name] !== 'undefined' && window[name].init) {
                layerInitPromises.push(
                    window[name].init().catch(e => console.warn(`${name} init failed:`, e))
                );
            }
        });

        Promise.allSettled(layerInitPromises).then(() => {
            ['AircraftLayer', 'SatelliteLayer', 'WeatherLayer'].forEach(name => {
                if (typeof window[name] !== 'undefined' && window[name].init) {
                    try { window[name].init(); } catch (e) { console.warn(`${name} init failed:`, e); }
                }
            });
        });

        try {
            if (typeof SearchEngine !== 'undefined') {
                SearchEngine.init();
                requestIdleCallback(() => SearchEngine.updateIndex());
            }
        } catch (e) { console.warn("SearchEngine init failed:", e); }

        try { if (typeof SearchUI !== 'undefined' && SearchUI.init) SearchUI.init(); } catch (e) {}
        try { if (typeof TimelineManager !== 'undefined' && TimelineManager.init) TimelineManager.init(); } catch (e) {}
        try { if (typeof DrawerManager !== 'undefined' && DrawerManager.init) DrawerManager.init(); } catch (e) {}
        try { if (typeof HoverPopup !== 'undefined' && HoverPopup.init) HoverPopup.init(); } catch (e) {}
        try { if (typeof UIAnimations !== 'undefined' && UIAnimations.init) UIAnimations.init(); } catch (e) {}
        try { if (typeof ClusteringManager !== 'undefined' && ClusteringManager.init) ClusteringManager.init(); } catch (e) {}
        try { if (typeof NotificationSystem !== 'undefined' && NotificationSystem.init) NotificationSystem.init(); } catch (e) {}
        try { if (typeof StatsDashboard !== 'undefined' && StatsDashboard.init) StatsDashboard.init(); } catch (e) {}

        try { if (typeof CameraManager !== 'undefined' && CameraManager.home) CameraManager.home(); } catch (e) {}

        window.GlobeManager = GlobeManager;
        setupUIListeners();
        syncAllLayerVisibility();
        updateLegendVisibility();
        updateGlobalStats();
        URLStateManager.init();
        setInterval(() => URLStateManager.update(), 2000);

        console.log("System Online");
        
        window.DisastersLayer = DisastersLayer;
        window.WarsLayer = WarsLayer;
        window.SearchEngine = SearchEngine;
        window.TimelineManager = TimelineManager;
        window.LiveLayer = LiveLayer;
        if (typeof NotificationSystem !== 'undefined' && LiveLayer._lastEvents) { NotificationSystem.processEvents(LiveLayer._lastEvents); }
        window.App = { status: "Online", version: "2.1.0" };
    }, 0);
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
        'toggleBorders': 'borders',
        'toggleLive': 'live',
        'toggleGIBS': 'gibs',
        'toggleHeatmap': 'heatmap', 'toggleRipple': 'ripple', 'toggleDayNight': 'daynight',
        'toggleStreetView': 'streetview', 'toggleOsiris': 'osiris'
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
        'toggleBorders': BordersLayer,
        'toggleLive': LiveLayer,
        'toggleGIBS': null,
        'toggleHeatmap': HeatmapLayer,
        'toggleRipple': RippleArcLayer,
        'toggleDayNight': DayNightLayer,
        'toggleStreetView': StreetViewLayer,
        'toggleOsiris': OsirisLayer
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

function _processNotifications(events) { if (typeof NotificationSystem !== 'undefined' && events) NotificationSystem.processEvents(events); }
let _statsTimer = null;
function updateGlobalStats() {
    if (_statsTimer) cancelAnimationFrame(_statsTimer);
    _statsTimer = requestAnimationFrame(() => {
        let total = 0;
        const layers = [DisastersLayer, WarsLayer, MysteryLayer, HistoricalLayer, BordersLayer, AircraftLayer, SatelliteLayer, LiveLayer, HeatmapLayer, RippleArcLayer, OsirisLayer];
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
    });
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
        { id: 'toggleBorders', layer: BordersLayer },
        { id: 'toggleLive', layer: LiveLayer },
        { id: 'toggleGIBS', layer: null },
        { id: 'toggleHeatmap', layer: HeatmapLayer },
        { id: 'toggleRipple', layer: RippleArcLayer },
        { id: 'toggleDayNight', layer: DayNightLayer },
        { id: 'toggleStreetView', layer: StreetViewLayer },
        { id: 'toggleOsiris', layer: OsirisLayer }
    ];

    toggles.forEach(t => {
        const el = document.getElementById(t.id);
        if (el) {
            el.addEventListener('change', (e) => {
                if (t.id === 'toggleGIBS') {
                    GIBSLayerManager.toggle(e.target.checked);
                    return;
                }
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

    function hideUI() {
        var sidebar = document.getElementById('sidebar');
        var searchBar = document.getElementById('searchBar');
        document.body.classList.add('ui-hidden');
        if (sidebar) { sidebar.style.transform = 'translateX(-100%)'; sidebar.style.opacity = '0'; sidebar.style.pointerEvents = 'none'; }
        if (searchBar) { searchBar.style.transform = 'translateX(-50%) translateY(-30px)'; searchBar.style.opacity = '0'; searchBar.style.pointerEvents = 'none'; }
    }
    function showUI() {
        var sidebar = document.getElementById('sidebar');
        var searchBar = document.getElementById('searchBar');
        document.body.classList.remove('ui-hidden');
        if (sidebar) { sidebar.style.transform = ''; sidebar.style.opacity = ''; sidebar.style.pointerEvents = ''; }
        if (searchBar) { searchBar.style.transform = ''; searchBar.style.opacity = ''; searchBar.style.pointerEvents = ''; }
        if (typeof DrawerManager !== 'undefined') {
            try { DrawerManager.close(); } catch(e) {}
            try { DrawerManager.closeModal(); } catch(e) {}
        }
    }

    var homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        homeBtn.addEventListener('click', function() {
            showUI();
            CameraManager.home();
        });
    }

    var randomBtn = document.getElementById('randomBtn');
    if (randomBtn) {
        randomBtn.addEventListener('click', function() {
            var allEntities = [];
            var layerNames = ['DisastersLayer','WarsLayer','MysteryLayer','HistoricalLayer','LiveLayer'];
            layerNames.forEach(function(name) {
                var layer = window[name];
                if (layer && layer.entities) {
                    layer.entities.forEach(function(entity) {
                        if (entity && entity.show !== false && entity.properties) {
                            allEntities.push(entity);
                        }
                    });
                }
            });
            if (typeof AircraftLayer !== 'undefined' && AircraftLayer.entities) {
                AircraftLayer.entities.forEach(function(e) { if (e && e.show !== false && e.properties) allEntities.push(e); });
            }
            if (typeof SatelliteLayer !== 'undefined' && SatelliteLayer.entities) {
                SatelliteLayer.entities.forEach(function(e) { if (e && e.show !== false && e.properties) allEntities.push(e); });
            }
            if (allEntities.length === 0) { alert('No events loaded yet. Enable a layer first.'); return; }
            var entity = allEntities[Math.floor(Math.random() * allEntities.length)];
            var getVal = function(p) { return (p && typeof p.getValue === 'function') ? p.getValue() : p; };
            var lat = getVal(entity.properties.lat);
            var lng = getVal(entity.properties.lng);
            if (lat !== undefined && lng !== undefined) {
                hideUI();
                CameraManager.flyToIncident(lat, lng);
                DrawerManager.open(entity);
            }
        });
    }

    if (window.GlobeManager && window.GlobeManager.viewer) {
        var viewer = window.GlobeManager.viewer;
        var handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction(function() { hideUI(); }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
}
