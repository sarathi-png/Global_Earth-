// GlobeManager — MapLibre GL engine (OSIRIS design).
// CARTO dark-matter basemap, globe projection, glow/interpolate point layers,
// native clustering. Replaces the CesiumJS viewer; the public surface
// (GlobeManager.map, syncLayer, setGroupVisible, flyTo helpers) is what all
// layer modules talk to.
const GlobeManager = {
    map: null,
    ready: null,
    _resolveReady: null,
    _loaded: false,
    _pending: [],
    _pickables: {},      // dot/symbol layerId -> layer object (must expose entitiesById)
    _pickableIds: [],
    _clusterState: {},   // key -> bool
    _imageCache: {},
    _styleFallbackDone: false,
    _allLayerNames: [
        'DisastersLayer','WarsLayer','MysteryLayer','HistoricalLayer',
        'AircraftLayer','SatelliteLayer','WeatherLayer','LiveLayer',
        'BordersLayer','HeatmapLayer','RippleArcLayer',
        'DayNightLayer','StreetViewLayer'
    ],
    LAYER_KEYS: {
        DisastersLayer: 'disasters', WarsLayer: 'wars', MysteryLayer: 'mysteries',
        HistoricalLayer: 'history', AircraftLayer: 'aircraft', SatelliteLayer: 'sat',
        WeatherLayer: 'weather', LiveLayer: 'live', BordersLayer: 'borders',
        HeatmapLayer: 'heatmap', RippleArcLayer: 'ripple', DayNightLayer: 'daynight',
        StreetViewLayer: 'streetview'
    },

    FALLBACK_STYLE: {
        version: 8,
        name: 'geo-intel-dark-fallback',
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            'osm-dark': {
                type: 'raster',
                tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                maxzoom: 19
            }
        },
        layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#0b0e14' } },
            { id: 'osm-dark', type: 'raster', source: 'osm-dark', paint: { 'raster-opacity': 0.95 } }
        ]
    },

    async init(containerId) {
        // Guard 1: WebGL support
        try {
            const testCanvas = document.createElement('canvas');
            if (!(window.WebGLRenderingContext &&
                (testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')))) {
                this.showFatal(containerId, 'WebGL Unavailable',
                    'This browser (or its current settings) does not provide WebGL, which the 3D globe requires.');
                return null;
            }
        } catch (_) { /* proceed — map will report */ }

        // Guard 2: MapLibre failed to load (CDN + vendor both blocked)
        if (typeof maplibregl === 'undefined') {
            this.showFatal(containerId, 'Engine Failed to Load',
                'The MapLibre GL library could not be loaded from the local bundle or any CDN fallback. Check your connection or ad/script blocker, then retry.');
            return null;
        }

        this.ready = new Promise((resolve) => { this._resolveReady = resolve; });

        try {
            const container = document.getElementById(containerId);
            const styleUrl = (typeof CONFIG !== 'undefined' && CONFIG.MAP && CONFIG.MAP.STYLE_URL)
                || 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
            const home = (typeof CONFIG !== 'undefined' && CONFIG.CAMERA_DEFAULTS)
                ? CONFIG.CAMERA_DEFAULTS.destination : { lat: 20, lng: 0, zoom: 2 };

            const baseOptions = {
                container: container,
                style: styleUrl,
                center: [home.lng || 0, home.lat || 20],
                zoom: (typeof home.zoom === 'number') ? home.zoom : 2,
                minZoom: (CONFIG.MAP && CONFIG.MAP.MIN_ZOOM) || 1.2,
                maxZoom: (CONFIG.MAP && CONFIG.MAP.MAX_ZOOM) || 18,
                maxPitch: (CONFIG.MAP && CONFIG.MAP.MAX_PITCH) || 85,
                projection: (CONFIG.MAP && CONFIG.MAP.PROJECTION) || 'globe',
                attributionControl: { compact: true },
                doubleClickZoom: false, // custom double-click flies closer to the picked incident
                dragRotate: true,
                touchPitch: true,
                failIfMajorPerformanceCaveat: false
            };

            // OSIRIS pattern: MapLibre asks for a high-performance context and
            // throws outright if it cannot get one — walk down to weaker
            // requests before giving up.
            const attributeFallbacks = [
                undefined,
                { failIfMajorPerformanceCaveat: false }
            ];
            let map = null;
            for (const canvasContextAttributes of attributeFallbacks) {
                try {
                    map = new maplibregl.Map(
                        canvasContextAttributes ? { ...baseOptions, canvasContextAttributes } : baseOptions
                    );
                    break;
                } catch (e) {
                    container.innerHTML = '';
                    if (canvasContextAttributes === attributeFallbacks[attributeFallbacks.length - 1]) throw e;
                    console.warn('[Globe] WebGL context rejected, retrying with weaker attributes:', e && e.message);
                }
            }
            if (!map) return null;
            this.map = map;

            const onReady = () => {
                if (this._loaded) return;
                this._loaded = true;
                try { this.setProjection(this._projection || 'globe', false); } catch (_) {}
                this._flush();
                if (this._resolveReady) this._resolveReady(map);
                console.log('MapLibre globe initialized (source: ' + (window.MAPLIBRE_SOURCE || 'unknown') + ')');
            };
            map.on('load', onReady);
            this._onStyleReady = onReady;

            // If the CARTO style (or its sprites/glyphs) fails, fall back to
            // a bundled dark raster style so the globe always renders.
            // 'load' may never fire for a dead style, so the fallback also
            // resolves readiness via the style's idle event.
            const useFallbackStyle = (why) => {
                if (this._loaded || this._styleFallbackDone) return;
                this._styleFallbackDone = true;
                console.warn('[Globe] basemap style failed (' + why + '), switching to fallback style.');
                try {
                    map.setStyle(this.FALLBACK_STYLE);
                    map.once('idle', () => { if (this._onStyleReady) this._onStyleReady(); });
                } catch (_) {}
            };
            map.on('error', (e) => {
                try {
                    const msg = (e && e.error && e.error.message) || '';
                    if (/style|sprit|glyph|network|fetch/i.test(msg)) useFallbackStyle(msg);
                } catch (_) {}
            });
            // Watchdog: style never reported load → force fallback.
            setTimeout(() => {
                try {
                    if (!this._loaded && this.map) useFallbackStyle('timeout');
                } catch (_) {}
            }, 12000);

            map.on('styledata', () => { /* style (re)loaded */ });
            return map;
        } catch (error) {
            console.error('Error initializing MapLibre globe:', error);
            this.showFatal(containerId, 'Engine Initialization Failure',
                'The 3D engine failed to start. This usually happens due to script blocking or missing WebGL.');
            return null;
        }
    },

    // ── readiness queue: layer setup calls made before style load ──
    _whenReady(fn) {
        if (this._loaded && this.map) { try { fn(); } catch (e) { console.warn('[Globe] op failed:', e.message); } return; }
        this._pending.push(fn);
    },
    _flush() {
        const ops = this._pending.splice(0);
        ops.forEach((fn) => { try { fn(); } catch (e) { console.warn('[Globe] queued op failed:', e.message); } });
    },

    // ── projection (OSIRIS 3D globe / 2D map) ──
    _projection: 'globe',
    setProjection(p, animate) {
        this._projection = (p === 'mercator') ? 'mercator' : 'globe';
        if (!this.map) return this._projection;
        try {
            this.map.setProjection({ type: this._projection });
            if (animate === false) return this._projection;
            if (this._projection === 'globe') {
                this.map.easeTo({ pitch: 20, duration: 1200 });
                try {
                    this.map.setSky({
                        'sky-color': '#04040A', 'sky-horizon-blend': 0.5,
                        'horizon-color': '#0a0a1a', 'horizon-fog-blend': 0.3,
                        'fog-color': '#04040A', 'fog-ground-blend': 0.9
                    });
                } catch (_) { /* older MapLibre without sky */ }
            } else {
                this.map.easeTo({ pitch: 0, duration: 800 });
            }
        } catch (e) { console.warn('[Globe] projection switch failed:', e.message); }
        return this._projection;
    },
    getProjection() { return this._projection || 'globe'; },

    // Move a raster overlay (aerial/GIBS) below all vector layers so
    // markers, labels, clusters and fills always draw on top.
    lowerRaster(id) {
        this._whenReady(() => {
            if (!this.map.getLayer(id)) return;
            const order = [];
            ['disasters', 'wars', 'mysteries', 'history', 'live', 'sat'].forEach((k) => order.push(k + '-glow'));
            order.push('aircraft-sym', 'weather-sym', 'borders-fill', 'heatmap-heat',
                'ripple-ring', 'ripple-arc-glow', 'day-night-fill', 'pulse-ring');
            for (const lid of order) {
                if (lid !== id && this.map.getLayer(lid)) {
                    try { this.map.moveLayer(id, lid); } catch (_) {}
                    return;
                }
            }
        });
    },

    // ── height <-> zoom (keeps old call sites meaningful) ──
    heightToZoom(height, lat) {
        const h = Math.max(500, Number(height) || 500000);
        const la = (Number(lat) || 20) * Math.PI / 180;
        const z = Math.log2(40075016.686 * Math.cos(la) / h);
        return Math.min(18, Math.max(1.2, z));
    },
    zoomToHeight(zoom, lat) {
        const z = (typeof zoom === 'number') ? zoom : 2;
        const la = (Number(lat) || 20) * Math.PI / 180;
        return 40075016.686 * Math.cos(la) / Math.pow(2, z);
    },
    getCenter() {
        if (!this.map) return { lat: 20, lng: 0, zoom: 2 };
        try {
            const c = this.map.getCenter();
            return { lat: c.lat, lng: c.lng, zoom: this.map.getZoom() };
        } catch (_) { return { lat: 20, lng: 0, zoom: 2 }; }
    },

    // ── image registry (canvas icons, OSIRIS createIcon/createDot pattern) ──
    addImage(id, canvasOrData, width, height) {
        this._whenReady(() => {
            if (!id || this.map.hasImage(id)) return;
            try {
                if (canvasOrData instanceof HTMLCanvasElement || canvasOrData instanceof HTMLImageElement || canvasOrData instanceof ImageBitmap) {
                    this.map.addImage(id, canvasOrData);
                } else if (canvasOrData && canvasOrData.data) {
                    this.map.addImage(id, canvasOrData, { pixelRatio: 2 });
                } else if (width && height && canvasOrData instanceof Uint8Array) {
                    this.map.addImage(id, { width, height, data: canvasOrData });
                }
            } catch (e) { console.warn('[Globe] addImage failed:', id, e.message); }
        });
    },
    makeDotImage(color, size) {
        size = size || 16;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        return c;
    },

    // ── clustered point layers (OSIRIS glow + dots + labels + clusters) ──
    ensurePointLayers(key, opts) {
        opts = opts || {};
        const useCluster = opts.cluster !== false;
        this._whenReady(() => {
            const srcId = 'src-' + key;
            if (!this.map.getSource(srcId)) {
                this.map.addSource(srcId, {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                    cluster: useCluster,
                    clusterMaxZoom: 9,
                    clusterRadius: 50
                });
                this._clusterState[key] = useCluster;
                const noCluster = useCluster ? ['!', ['has', 'point_count']] : null;

                 // core dot
                 this.map.addLayer({
                     id: key + '-dots', type: 'circle', source: srcId,
                     filter: noCluster,
                     paint: {
                         'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 5, 6, 10, 10],
                         'circle-color': ['get', 'color'],
                         'circle-opacity': 0.9,
                         'circle-stroke-width': 2,
                         'circle-stroke-color': '#000000',
                         'circle-stroke-opacity': 0.75
                     }
                 });
                 // glow halo
                 this.map.addLayer({
                     id: key + '-glow', type: 'circle', source: srcId,
                     filter: noCluster,
                     paint: {
                         'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 8, 5, 16, 10, 28],
                         'circle-color': ['get', 'color'],
                         'circle-opacity': 0.2, 'circle-blur': 0.7
                     }
                 });
                // label
                this.map.addLayer({
                    id: key + '-label', type: 'symbol', source: srcId,
                    minzoom: opts.labelMinzoom || 5,
                    filter: noCluster,
                    layout: {
                        'text-field': ['get', 'title'],
                        'text-size': 9,
                        'text-font': ['Noto Sans Regular', 'Open Sans Regular'],
                        'text-offset': [0, 1.8],
                        'text-max-width': 12,
                        'text-allow-overlap': false
                    },
                    paint: {
                        'text-color': ['get', 'color'],
                        'text-halo-color': '#000000',
                        'text-halo-width': 1.5,
                        'text-opacity': 0.85
                    }
                });
                 // clusters (only for clustered sources)
                 if (useCluster) {
                     this.map.addLayer({
                         id: key + '-cluster', type: 'circle', source: srcId,
                         filter: ['has', 'point_count'],
                         paint: {
                             'circle-radius': ['step', ['get', 'point_count'], 20, 100, 26, 750, 34],
                             'circle-color': '#2a4a6f',
                             'circle-opacity': 0.95,
                             'circle-stroke-width': 2.5,
                             'circle-stroke-color': '#7fa8cc',
                             'circle-stroke-opacity': 0.9
                         }
                     });
                     this.map.addLayer({
                         id: key + '-count', type: 'symbol', source: srcId,
                         filter: ['has', 'point_count'],
                         layout: {
                             'text-field': ['get', 'point_count_abbreviated'],
                             'text-size': 13,
                             'text-font': ['Noto Sans Bold', 'Open Sans Bold']
                         },
                         paint: { 'text-color': '#ffffff', 'text-halo-color': '#0b0e14', 'text-halo-width': 2 }
                     });
                 }
             }
             // (re)register ALL point layers as pickable so clusters,
             // glow halos and labels are clickable at any zoom.
             [key + '-dots', key + '-glow', key + '-label', key + '-cluster', key + '-count']
                 .forEach((lid) => {
                     if (this._pickableIds.indexOf(lid) === -1) this._pickableIds.push(lid);
                 });
        });
    },

    setPointData(key, features) {
        this._whenReady(() => {
            const src = this.map.getSource('src-' + key);
            if (src && src.setData) src.setData({ type: 'FeatureCollection', features: features || [] });
        });
    },

    pointLayerIds(key) {
        const ids = [key + '-glow', key + '-dots', key + '-label'];
        if (this._clusterState[key] !== false) ids.push(key + '-cluster', key + '-count');
        return ids;
    },

    // Manual pickable registration for custom (non-point-helper) layers.
    registerPickable(layerId, layerObj) {
        this._whenReady(() => {
            this._pickables[layerId] = layerObj;
            if (this._pickableIds.indexOf(layerId) === -1) this._pickableIds.push(layerId);
        });
    },

    // Push prebuilt features to a custom source + rebuild the entity index.
    setCustomData(srcId, layerObj, features) {
        if (layerObj) {
            layerObj.entitiesById = layerObj.entitiesById || {};
            const idx = {};
            (features || []).forEach((f) => {
                const eid = f && f.properties && f.properties._eid;
                if (eid && layerObj.entities) {
                    const ent = layerObj.entities.find((e) => e.id === eid);
                    if (ent) idx[eid] = ent;
                }
            });
            layerObj.entitiesById = idx;
        }
        this.setGeoData(srcId, { type: 'FeatureCollection', features: features || [] });
    },

    setGroupVisible(key, show) {
        this._whenReady(() => {
            const vis = show ? 'visible' : 'none';
            this.pointLayerIds(key).forEach((lid) => {
                if (!this.map.getLayer(lid)) return;
                if ((lid === key + '-cluster' || lid === key + '-count') && !this._clusterState[key]) return;
                try { this.map.setLayoutProperty(lid, 'visibility', vis); } catch (_) {}
            });
        });
    },

    setClustering(key, on) {
        this._clusterState[key] = !!on;
        this._whenReady(() => {
            const vis = (lid, v) => { if (this.map.getLayer(lid)) { try { this.map.setLayoutProperty(lid, 'visibility', v); } catch (_) {} } };
            // determine current group visibility from dots layer
            let groupOn = true;
            try {
                const cur = this.map.getLayoutProperty(key + '-dots', 'visibility');
                groupOn = cur !== 'none';
            } catch (_) {}
            vis(key + '-cluster', (on && groupOn) ? 'visible' : 'none');
            vis(key + '-count', (on && groupOn) ? 'visible' : 'none');
            try {
                this.map.setFilter(key + '-dots', on ? ['!', ['has', 'point_count']] : null);
                this.map.setFilter(key + '-label', on ? ['!', ['has', 'point_count']] : null);
            } catch (_) {}
        });
    },

    // ── entity <-> feature sync ──
    // entities: [{id, properties:{...plain}, show}] → features; rebuilds the
    // layer's entity index for click resolution.
    syncLayer(layerObj, key) {
        if (!layerObj) return;
        layerObj.entitiesById = layerObj.entitiesById || {};
        const idx = {};
        const features = [];
        (layerObj.entities || []).forEach((e) => {
            if (!e || e.show === false) return;
            const p = e.properties || {};
            if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
            if (!isFinite(p.lat) || !isFinite(p.lng)) return;
            idx[e.id] = e;
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                properties: Object.assign({}, p, { _eid: e.id, _key: key })
            });
        });
        layerObj.entitiesById = idx;
        this.ensurePointLayers(key, layerObj._pointOpts);
        this.setPointData(key, features);
        if (layerObj._pickRegistered !== key) {
            layerObj._pickRegistered = key;
            this._whenReady(() => {
                [key + '-dots', key + '-glow', key + '-label', key + '-cluster', key + '-count']
                    .forEach((lid) => {
                        this._pickables[lid] = layerObj;
                        if (this._pickableIds.indexOf(lid) === -1) this._pickableIds.push(lid);
                    });
            });
        }
    },

    queryAt(point) {
        if (!this.map || !this._pickableIds.length) return null;
        let feats = [];
        try {
            feats = this.map.queryRenderedFeatures(point, { layers: this._pickableIds.filter((id) => !!this.map.getLayer(id)) });
        } catch (_) { return null; }
        if (!feats || !feats.length) return null;
        const f = feats[0];
        const props = f.properties || {};
        if (props.cluster) {
            return { cluster: true, clusterId: props.cluster_id, srcId: f.source, lngLat: (f.geometry && f.geometry.coordinates) || null };
        }
        const owner = this._pickables[f.layer && f.layer.id];
        const ent = owner && owner.entitiesById && owner.entitiesById[props._eid];
        if (ent) return { entity: ent, key: props._key };
        // Fallback: synthesize a minimal entity from feature properties.
        return {
            entity: {
                id: props._eid || (props.title + '-' + props.lat + '-' + props.lng),
                properties: props, show: true
            },
            key: props._key
        };
    },

    expandCluster(srcId, clusterId, lngLat) {
        try {
            const src = this.map && this.map.getSource(srcId);
            if (!src || !src.getClusterExpansionZoom) return;
            src.getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err || !this.map) return;
                this.map.easeTo({ center: lngLat || this.map.getCenter(), zoom: Math.min(zoom, 12), duration: 600 });
            });
        } catch (_) {}
    },

    // ── generic source/layer helpers ──
    ensureGeoSource(srcId, data, opts) {
        this._whenReady(() => {
            if (!this.map.getSource(srcId)) {
                this.map.addSource(srcId, Object.assign({ type: 'geojson', data: data || { type: 'FeatureCollection', features: [] } }, opts || {}));
            }
        });
    },
    setGeoData(srcId, data) {
        this._whenReady(() => {
            const src = this.map.getSource(srcId);
            if (src && src.setData) src.setData(data || { type: 'FeatureCollection', features: [] });
        });
    },
    addLayerOnce(def) {
        this._whenReady(() => {
            if (!this.map.getLayer(def.id)) { try { this.map.addLayer(def); } catch (e) { console.warn('[Globe] addLayer failed:', def.id, e.message); } }
        });
    },
    setLayerVisible(layerId, show) {
        this._whenReady(() => {
            if (!this.map.getLayer(layerId)) return;
            try { this.map.setLayoutProperty(layerId, 'visibility', show ? 'visible' : 'none'); } catch (_) {}
        });
    },
    addRasterLayer(id, tiles, attribution, opacity) {
        this._whenReady(() => {
            const srcId = 'src-' + id;
            if (!this.map.getSource(srcId)) {
                this.map.addSource(srcId, { type: 'raster', tiles: [tiles], tileSize: 256, attribution: attribution || '', maxzoom: 19 });
            }
            if (!this.map.getLayer(id)) {
                this.map.addLayer({ id, type: 'raster', source: srcId, paint: { 'raster-opacity': (typeof opacity === 'number') ? opacity : 0.9 } });
            }
            this.lowerRaster(id);
        });
    },
    removeRasterLayer(id) {
        this._whenReady(() => {
            try { if (this.map.getLayer(id)) this.map.removeLayer(id); } catch (_) {}
            try { if (this.map.getSource('src-' + id)) this.map.removeSource('src-' + id); } catch (_) {}
        });
    },

    async addGIBSLayer(type) {
        if (!this.map) return null;
        try {
            const d = new Date(Date.now() - 86400000);
            const datestr = d.toISOString().slice(0, 10);
            const tiles = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/' + type + '/default/' + datestr + '/250m/{z}/{y}/{x}.png';
            this.addRasterLayer('gibs-overlay', tiles, 'NASA GIBS', 0.5);
            return 'gibs-overlay';
        } catch (e) {
            console.warn('GIBS layer failed:', e.message);
            return null;
        }
    },

    showFatal(containerId, title, detail) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML =
            '<div class="glass-panel globe-fatal">' +
            '<i class="fas fa-exclamation-triangle globe-fatal-icon"></i>' +
            '<h3>' + title + '</h3>' +
            '<p class="globe-fatal-detail">' + detail + '</p>' +
            '<div class="globe-fatal-actions">' +
            '<button class="fatal-retry-btn" onclick="location.reload()">' +
            '<i class="fas fa-rotate-right"></i> Retry</button></div></div>';
    },

    // Compat no-ops (Cesium frustum culling is gone — MapLibre culls natively).
    initFrustumCulling() {},
    destroyCulling() {},
    setupLocalImagery() {},
    setupFallbackImagery() {},
    _cullingReset() {}
};
