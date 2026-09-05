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
        if (!window.GlobeManager || !GlobeManager.viewer) return; // engine offline — skip camera restore
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
        if (!window.GlobeManager || !GlobeManager.viewer || typeof Cesium === 'undefined') return;
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

    // Wait for the Cesium loader chain (local vendor + CDN fallbacks) before
    // booting the engine, so a slow CDN doesn't race the app. Non-fatal:
    // UI layers boot regardless and no-op gracefully without a viewer.
    if (window.__cesiumReady) {
        try {
            const src = await window.__cesiumReady;
            console.log("Cesium library ready via " + src);
        } catch (e) {
            console.warn("Cesium library unavailable, continuing in degraded mode:", e.message);
        }
    }

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
        const layerNames = ['DisastersLayer', 'WarsLayer', 'MysteryLayer', 'HistoricalLayer', 'BordersLayer', 'LiveLayer', 'StreetViewLayer', 'OsirisLayer', 'RippleArcLayer', 'DayNightLayer'];
        layerNames.forEach(name => {
            if (typeof window[name] !== 'undefined' && window[name].init) {
                layerInitPromises.push(
                    window[name].init().catch(e => console.warn(`${name} init failed:`, e))
                );
            }
        });

        Promise.allSettled(layerInitPromises).then(() => {
            ['AircraftLayer', 'SatelliteLayer', 'WeatherLayer', 'HeatmapLayer'].forEach(name => {
                if (typeof window[name] !== 'undefined' && window[name].init) {
                    try { window[name].init(); } catch (e) { console.warn(`${name} init failed:`, e); }
                }
            });
        });

        try {
            if (typeof SearchEngine !== 'undefined') {
                SearchEngine.init();
                const deferIndex = () => { try { SearchEngine.updateIndex(); } catch (e) {} };
                if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(deferIndex);
                else setTimeout(deferIndex, 0);
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
        window._urlStateInterval = setInterval(() => URLStateManager.update(), 2000);

        console.log("System Online");
        
        window.DisastersLayer = (typeof DisastersLayer !== 'undefined') ? DisastersLayer : window.DisastersLayer;
        window.WarsLayer = (typeof WarsLayer !== 'undefined') ? WarsLayer : window.WarsLayer;
        window.SearchEngine = (typeof SearchEngine !== 'undefined') ? SearchEngine : window.SearchEngine;
        window.TimelineManager = (typeof TimelineManager !== 'undefined') ? TimelineManager : window.TimelineManager;
        window.LiveLayer = (typeof LiveLayer !== 'undefined') ? LiveLayer : window.LiveLayer;
        if (typeof NotificationSystem !== 'undefined' && window.LiveLayer && window.LiveLayer._lastEvents) { NotificationSystem.processEvents(window.LiveLayer._lastEvents); }
        window.App = { status: "Online", version: "2.1.0" };
    }, 0);
});

// ── Shared toggle ID registry ──
// NOTE: layer objects are resolved lazily via window[] (never bare globals)
// so a single failed layer script can never break the whole boot file.
const TOGGLE_IDS = [
    'toggleDisasters','toggleWars','toggleMysteries','toggleHistory',
    'toggleAircraft','toggleSat','toggleWeather','toggleBorders',
    'toggleLive','toggleGIBS','toggleHeatmap','toggleRipple',
    'toggleDayNight','toggleStreetView','toggleOsiris'
];

const TOGGLE_ID_TO_LAYER_NAME = {
    'toggleDisasters':'DisastersLayer','toggleWars':'WarsLayer',
    'toggleMysteries':'MysteryLayer','toggleHistory':'HistoricalLayer',
    'toggleAircraft':'AircraftLayer','toggleSat':'SatelliteLayer',
    'toggleWeather':'WeatherLayer','toggleBorders':'BordersLayer',
    'toggleLive':'LiveLayer','toggleGIBS':null,
    'toggleHeatmap':'HeatmapLayer','toggleRipple':'RippleArcLayer',
    'toggleDayNight':'DayNightLayer','toggleStreetView':'StreetViewLayer',
    'toggleOsiris':'OsirisLayer'
};

function layerByToggle(toggleId) {
    const name = TOGGLE_ID_TO_LAYER_NAME[toggleId];
    if (!name) return null;
    const layer = window[name];
    return (layer && typeof layer === 'object') ? layer : null;
}

const TOGGLE_ID_TO_LEGEND_CLASS = {
    'toggleDisasters':'disasters','toggleWars':'wars','toggleMysteries':'mysteries',
    'toggleHistory':'history','toggleAircraft':'aircraft','toggleSat':'sat',
    'toggleWeather':'weather','toggleBorders':'borders','toggleLive':'live',
    'toggleGIBS':'gibs','toggleHeatmap':'heatmap','toggleRipple':'ripple',
    'toggleDayNight':'daynight','toggleStreetView':'streetview','toggleOsiris':'osiris'
};

function updateLegendVisibility() {
    TOGGLE_IDS.forEach(toggleId => {
        const el = document.getElementById(toggleId);
        const legendClass = TOGGLE_ID_TO_LEGEND_CLASS[toggleId];
        const legendItem = legendClass ? document.querySelector(`.legend-item[data-layer="${legendClass}"]`) : null;
        if (!el || !legendItem) return;
        el.checked ? legendItem.classList.remove('hidden-layer') : legendItem.classList.add('hidden-layer');
    });
}

function syncAllLayerVisibility() {
    TOGGLE_IDS.forEach(toggleId => {
        const el = document.getElementById(toggleId);
        const layer = layerByToggle(toggleId);
        if (!el || !layer) return;
        try {
            const isChecked = el.checked;
            layer.visible = isChecked;
            if (layer.toggleVisibility) layer.toggleVisibility(isChecked);
        } catch (e) { console.warn(toggleId, 'sync failed:', e); }
    });
}

function _processNotifications(events) { if (typeof NotificationSystem !== 'undefined' && events) NotificationSystem.processEvents(events); }
function updateGlobalStats() {
    let total = 0;
    ['DisastersLayer','WarsLayer','MysteryLayer','HistoricalLayer','BordersLayer','AircraftLayer','SatelliteLayer','LiveLayer','HeatmapLayer','RippleArcLayer','OsirisLayer'].forEach(name => {
        const l = window[name];
        if (!l || !l.entities) return;
        try {
            if (l.visible) l.entities.forEach(e => { if (e && e.show) total++; });
        } catch (_) { /* partially-initialized layer */ }
    });
    const badge = document.getElementById('activeMarkerCount');
    if (badge) badge.innerText = total;
}

function setupUIListeners() {
    const toggles = [
        { id: 'toggleDisasters' }, { id: 'toggleWars' },
        { id: 'toggleMysteries' }, { id: 'toggleHistory' },
        { id: 'toggleAircraft' }, { id: 'toggleSat' },
        { id: 'toggleWeather' }, { id: 'toggleBorders' },
        { id: 'toggleLive' }, { id: 'toggleGIBS' },
        { id: 'toggleHeatmap' }, { id: 'toggleRipple' },
        { id: 'toggleDayNight' }, { id: 'toggleStreetView' },
        { id: 'toggleOsiris' }
    ];

    toggles.forEach(t => {
        const el = document.getElementById(t.id);
        if (el) {
            el.addEventListener('change', (e) => {
                if (t.id === 'toggleGIBS') {
                    GIBSLayerManager.toggle(e.target.checked);
                    return;
                }
                const layer = layerByToggle(t.id);
                if (layer) {
                    try {
                        layer.visible = e.target.checked;
                        if (layer.toggleVisibility) {
                            layer.toggleVisibility(e.target.checked);
                        }
                    } catch (err) { console.warn(t.id, 'toggle failed:', err); }
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

    var toggleSidebarBtn = document.getElementById('toggleSidebar');
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', function () {
            document.body.classList.toggle('sidebar-collapsed');
        });
    }
    var sidebarFab = document.getElementById('sidebarFab');
    if (sidebarFab) {
        sidebarFab.addEventListener('click', function () {
            document.body.classList.toggle('sidebar-open');
        });
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

    // Cleanup previous handler if re-initializing
    if (window._cesiumClickHandler) { try { window._cesiumClickHandler.destroy(); } catch (_) {} window._cesiumClickHandler = null; }
    if (typeof Cesium !== 'undefined' && window.GlobeManager && window.GlobeManager.viewer) {
        var viewer = window.GlobeManager.viewer;
        window._cesiumClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        // Hide chrome only on empty-globe clicks (not marker picks, not drags):
        // a LEFT_DOWN+LEFT_UP pair with minimal movement and no picked entity.
        var downPos = null;
        window._cesiumClickHandler.setInputAction(function (movement) {
            downPos = movement.position;
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        window._cesiumClickHandler.setInputAction(function (movement) {
            try {
                if (!downPos) return;
                var dx = movement.position.x - downPos.x;
                var dy = movement.position.y - downPos.y;
                downPos = null;
                if (dx * dx + dy * dy > 25) return; // it was a drag
                var picked = viewer.scene.pick(movement.position);
                if (!picked) hideUI();
            } catch (_) { /* picking not ready */ }
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
        if (window._cesiumClickHandler) { try { window._cesiumClickHandler.destroy(); } catch (_) {} }
        if (window._urlStateInterval) clearInterval(window._urlStateInterval);
        if (window.LiveLayer && window.LiveLayer.destroy) window.LiveLayer.destroy();
        if (window.AircraftLayer && window.AircraftLayer.destroy) window.AircraftLayer.destroy();
        if (window.SatelliteLayer && window.SatelliteLayer.destroy) window.SatelliteLayer.destroy();
        if (window.OsirisLayer && window.OsirisLayer.destroy) window.OsirisLayer.destroy();
        if (window.GlobeManager && window.GlobeManager.destroyCulling) window.GlobeManager.destroyCulling();
    });
}
