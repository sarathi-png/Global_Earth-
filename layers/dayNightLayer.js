const DayNightLayer = {
    visible: false,
    _initialized: false,
    _polyline: null,
    _darkPolygon: null,
    _timer: null,

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('DayNightLayer initialized');
    },

    calculateSunPosition() {
        var now = new Date();
        var JD = 2440587.5 + (now.getTime() / 86400000);
        var T = (JD - 2451545.0) / 36525.0;
        var L0 = 280.46646 + T * (36000.76983 + 0.0003032 * T);
        L0 = L0 % 360;
        if (L0 < 0) L0 += 360;
        var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
        var Mrad = M * Math.PI / 180;
        var C = (1.9146 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
              + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
              + 0.00029 * Math.sin(3 * Mrad);
        var sunLong = L0 + C;
        var sunAnomaly = M + C;
        var omega = 125.04 - 1934.136 * T;
        var lambda = sunLong - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180);
        var epsilon = 23.439 - 0.00000036 * T;
        var sunDeclination = Math.asin(Math.sin(epsilon * Math.PI / 180) * Math.sin(lambda * Math.PI / 180));
        var greenwichMeanSiderealTime = 280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T;
        greenwichMeanSiderealTime = greenwichMeanSiderealTime % 360;
        if (greenwichMeanSiderealTime < 0) greenwichMeanSiderealTime += 360;
        var subSolarLng = greenwichMeanSiderealTime - lambda;
        subSolarLng = subSolarLng % 360;
        if (subSolarLng > 180) subSolarLng -= 360;
        if (subSolarLng < -180) subSolarLng += 360;
        var subSolarLat = Math.asin(Math.sin(sunDeclination) / 1) * 180 / Math.PI;
        return { longitude: subSolarLng, latitude: subSolarLat, declination: sunDeclination * 180 / Math.PI };
    },

    generateTerminatorPoints(sunLat, sunLng) {
        var points = [];
        var segments = 72;
        for (var i = 0; i <= segments; i++) {
            var angle = (i / segments) * 2 * Math.PI;
            var latRad = Math.asin(
                Math.cos(sunLat * Math.PI / 180) * Math.sin(angle)
            );
            var lngRad = sunLng * Math.PI / 180 + Math.atan2(
                -Math.cos(angle),
                Math.tan(0) * Math.cos(sunLat * Math.PI / 180) - Math.sin(0) * Math.sin(sunLat * Math.PI / 180) * Math.sin(angle)
            );
            var declRad = sunLat * Math.PI / 180;
            var termLat = Math.atan2(
                -Math.cos(angle) * Math.cos(declRad),
                Math.sin(declRad) - Math.sin(angle) * Math.sin(declRad)
            );
            var termLng = sunLng * Math.PI / 180 + Math.atan2(
                Math.sin(angle) * Math.cos(declRad),
                Math.cos(angle)
            );
            points.push(Cesium.Cartesian3.fromDegrees(termLng * 180 / Math.PI, termLat * 180 / Math.PI));
        }
        return points;
    },

    update() {
        if (!this.visible || !GlobeManager.viewer) return;
        this.remove();

        var sun = this.calculateSunPosition();
        var terminatorPoints = this.generateTerminatorPoints(sun.latitude, sun.longitude);

        this._polyline = GlobeManager.viewer.entities.add({
            polyline: {
                positions: terminatorPoints,
                width: 2,
                material: new Cesium.ColorMaterialProperty(
                    new Cesium.Color(1, 0.84, 0, 0.7)
                ),
                clampToGround: false
            }
        });

        var nightLng = sun.longitude + 180;
        if (nightLng > 180) nightLng -= 360;
        var nightVertices = [];
        for (var n = 0; n <= 36; n++) {
            var nAngle = (n / 36) * 2 * Math.PI;
            var nDeclRad = sun.declination * Math.PI / 180;
            var nLat = Math.atan2(
                -Math.cos(nAngle) * Math.cos(nDeclRad),
                Math.sin(nDeclRad) - Math.sin(nAngle) * Math.sin(nDeclRad)
            );
            var nLng = nightLng * Math.PI / 180 + Math.atan2(
                Math.sin(nAngle) * Math.cos(nDeclRad),
                Math.cos(nAngle)
            );
            nightVertices.push(nLng * 180 / Math.PI, nLat * 180 / Math.PI);
        }

        this._darkPolygon = GlobeManager.viewer.entities.add({
            polygon: {
                hierarchy: new Cesium.CallbackProperty(function() {
                    return nightVertices;
                }, false),
                material: new Cesium.Color(0, 0, 0.15, 0.35),
                outline: false
            }
        });

        if (this._timer) clearInterval(this._timer);
        var self = this;
        this._timer = setInterval(function() { self.update(); }, 60000);
    },

    remove() {
        if (!GlobeManager.viewer) return;
        if (this._polyline) {
            try { GlobeManager.viewer.entities.remove(this._polyline); } catch(e) {}
            this._polyline = null;
        }
        if (this._darkPolygon) {
            try { GlobeManager.viewer.entities.remove(this._darkPolygon); } catch(e) {}
            this._darkPolygon = null;
        }
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show) {
            this.update();
        } else {
            this.remove();
        }
    }
};

window.DayNightLayer = DayNightLayer;
