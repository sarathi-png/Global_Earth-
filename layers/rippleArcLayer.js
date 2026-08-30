const RippleArcLayer = {
    rippleEntities: [],
    arcEntities: [],
    visible: false,
    _initialized: false,
    _animFrame: null,

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('RippleArcLayer initialized');
    },

    async generateFromLiveEvents() {
        if (!GlobeManager.viewer || !this.visible) return;
        this.clearAll();
        var events = [];
        if (typeof LiveLayer !== 'undefined' && LiveLayer._lastEvents) {
            events = LiveLayer._lastEvents;
        }
        if (events.length === 0) return;

        var critical = events.filter(function(e) {
            return e.severity === 'Critical' || e.severity === 'High';
        });
        critical = critical.slice(0, 20);

        var self = this;
        critical.forEach(function(event, idx) {
            self.addRipple(event, idx);
        });

        if (critical.length >= 2) {
            var pairs = [];
            for (var i = 0; i < Math.min(critical.length, 8); i++) {
                for (var j = i + 1; j < Math.min(critical.length, 8); j++) {
                    if (critical[i].category === critical[j].category ||
                        critical[i].source === critical[j].source) {
                        pairs.push([critical[i], critical[j]]);
                        if (pairs.length >= 5) break;
                    }
                }
                if (pairs.length >= 5) break;
            }
            pairs.forEach(function(pair, idx) {
                self.addArc(pair[0], pair[1], idx);
            });
        }
    },

    addRipple(event, idx) {
        if (!GlobeManager.viewer || !event.lat || !event.lng) return;
        var sevColor = event.severity === 'Critical' ?
            new Cesium.Color(1, 0.23, 0.19, 0.6) :
            new Cesium.Color(1, 0.58, 0, 0.6);
        var baseRadius = event.severity === 'Critical' ? 60000 : 40000;
        var ringCount = event.severity === 'Critical' ? 3 : 2;

        for (var r = 0; r < ringCount; r++) {
            var delay = r * 0.3;
            var entity = GlobeManager.viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(event.lng, event.lat),
                ellipse: {
                    semiMajorAxis: new Cesium.CallbackProperty(function(state) {
                        var elapsed = (performance.now() / 1000 + delay) % 3;
                        var t = elapsed / 3;
                        return baseRadius * (0.3 + t * 2.5);
                    }, false),
                    semiMinorAxis: new Cesium.CallbackProperty(function(state) {
                        var elapsed = (performance.now() / 1000 + delay) % 3;
                        var t = elapsed / 3;
                        return baseRadius * (0.3 + t * 2.5);
                    }, false),
                    material: new Cesium.CallbackProperty(function(state) {
                        var elapsed = (performance.now() / 1000 + delay) % 3;
                        var t = elapsed / 3;
                        var alpha = 0.5 * (1 - t);
                        return new Cesium.Color(sevColor.red, sevColor.green, sevColor.blue, alpha);
                    }, false),
                    outline: true,
                    outlineColor: new Cesium.CallbackProperty(function() {
                        var elapsed = (performance.now() / 1000 + delay) % 3;
                        var t = elapsed / 3;
                        return new Cesium.Color(sevColor.red, sevColor.green, sevColor.blue, 0.3 * (1 - t));
                    }, false),
                    height: 100
                }
            });
            this.rippleEntities.push(entity);
        }
    },

    addArc(event1, event2, idx) {
        if (!GlobeManager.viewer) return;
        if (!event1.lat || !event1.lng || !event2.lat || !event2.lng) return;

        var start = Cesium.Cartesian3.fromDegrees(event1.lng, event1.lat, 0);
        var end = Cesium.Cartesian3.fromDegrees(event2.lng, event2.lat, 0);
        var dist = Cesium.Cartesian3.distance(start, end);
        var midHeight = dist * 0.25;

        var midCartographic = new Cesium.Cartographic(
            (Cesium.Cartographic.fromCartesian(start).longitude + Cesium.Cartographic.fromCartesian(end).longitude) / 2,
            (Cesium.Cartographic.fromCartesian(start).latitude + Cesium.Cartographic.fromCartesian(end).latitude) / 2
        );
        var mid = Cesium.Cartesian3.fromRadians(
            midCartographic.longitude, midCartographic.latitude, midHeight
        );

        var points = [];
        var segments = 30;
        for (var s = 0; s <= segments; s++) {
            var t = s / segments;
            var u = 1 - t;
            var x = u * u * start.x + 2 * u * t * mid.x + t * t * end.x;
            var y = u * u * start.y + 2 * u * t * mid.y + t * t * end.y;
            var z = u * u * start.z + 2 * u * t * mid.z + t * t * end.z;
            points.push(new Cesium.Cartesian3(x, y, z));
        }

        var colors = [
            new Cesium.Color(1, 0.58, 0, 0.4),
            new Cesium.Color(1, 0.23, 0.19, 0.4),
            new Cesium.Color(0, 0.7, 1, 0.4)
        ];

        var entity = GlobeManager.viewer.entities.add({
            polyline: {
                positions: points,
                width: 1.5,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.15,
                    color: colors[idx % colors.length]
                }),
                clampToGround: false
            }
        });
        this.arcEntities.push(entity);
    },

    clearAll() {
        if (!GlobeManager.viewer) return;
        this.rippleEntities.forEach(function(e) {
            try { GlobeManager.viewer.entities.remove(e); } catch(err) {}
        });
        this.arcEntities.forEach(function(e) {
            try { GlobeManager.viewer.entities.remove(e); } catch(err) {}
        });
        this.rippleEntities = [];
        this.arcEntities = [];
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show) {
            this.generateFromLiveEvents();
        } else {
            this.clearAll();
        }
    }
};

window.RippleArcLayer = RippleArcLayer;
