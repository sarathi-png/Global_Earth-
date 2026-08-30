const HeatmapLayer = {
    entities: [],
    visible: false,
    _initialized: false,

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('HeatmapLayer initialized');
    },

    async generateFromLiveEvents() {
        if (!GlobeManager.viewer || !this.visible) return;
        this.clearEntities();
        var events = [];
        if (typeof LiveLayer !== 'undefined' && LiveLayer._lastEvents) {
            events = LiveLayer._lastEvents;
        }
        if (events.length === 0) return;

        var gridSize = 8;
        var grid = {};
        events.forEach(function(e) {
            if (!e.lat || !e.lng) return;
            var glat = Math.round(e.lat / gridSize) * gridSize;
            var glng = Math.round(e.lng / gridSize) * gridSize;
            var key = glat + ',' + glng;
            if (!grid[key]) grid[key] = { lat: glat, lng: glng, count: 0, maxSeverity: 0 };
            grid[key].count++;
            var sev = e.severity === 'Critical' ? 4 : e.severity === 'High' ? 3 : e.severity === 'Moderate' ? 2 : 1;
            if (sev > grid[key].maxSeverity) grid[key].maxSeverity = sev;
        });

        var self = this;
        var maxCount = 1;
        Object.values(grid).forEach(function(cell) { if (cell.count > maxCount) maxCount = cell.count; });

        Object.values(grid).forEach(function(cell) {
            var ratio = cell.count / maxCount;
            var baseRadius = 30000 + ratio * 120000;
            var alpha = 0.15 + ratio * 0.45;
            var r, g, b;
            if (cell.maxSeverity >= 4) { r = 255; g = 59; b = 48; }
            else if (cell.maxSeverity >= 3) { r = 255; g = 149; b = 0; }
            else if (cell.maxSeverity >= 2) { r = 255; g = 204; b = 0; }
            else { r = 52; g = 199; b = 89; }

            var entity = GlobeManager.viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(cell.lng, cell.lat),
                ellipse: {
                    semiMajorAxis: baseRadius,
                    semiMinorAxis: baseRadius,
                    material: new Cesium.ColorMaterialProperty(
                        new Cesium.CallbackProperty(function() {
                            return new Cesium.Color(r/255, g/255, b/255, alpha);
                        }, false)
                    ),
                    outline: false
                }
            });
            self.entities.push(entity);
        });
    },

    clearEntities() {
        if (GlobeManager.viewer) {
            this.entities.forEach(function(e) {
                try { GlobeManager.viewer.entities.remove(e); } catch(err) {}
            });
        }
        this.entities = [];
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show) {
            this.generateFromLiveEvents();
        } else {
            this.entities.forEach(function(e) { e.show = false; });
        }
    }
};

window.HeatmapLayer = HeatmapLayer;
