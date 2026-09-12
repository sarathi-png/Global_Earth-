// StreetViewLayer — aerial imagery overlay toggle (keyless ESRI World
// Imagery raster) + tabbed drawer panoramas (Google keyless embed,
// Mapillary via optional access key with graceful fallback, OSM map).
const StreetViewLayer = {
    visible: false,
    enabled: true,
    _aerialOn: false,
    _mapillaryCache: {},

    async init() {
        // Token-independent: the overlay is a public raster; the drawer
        // panoramas need no keys except optional ?mapillary_key=.
        console.log('StreetViewLayer init (MapLibre aerial overlay + drawer panoramas)');
    },

    toggleVisibility(show) {
        this.visible = show;
        if (typeof GlobeManager === 'undefined' || !GlobeManager.map) return;
        if (show) {
            const tiles = (CONFIG.MAP && CONFIG.MAP.AERIAL_TILES) ||
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            GlobeManager.addRasterLayer('street-aerial', tiles, (CONFIG.MAP && CONFIG.MAP.AERIAL_ATTR) || 'Esri World Imagery', 0.85);
            this._aerialOn = true;
        } else if (this._aerialOn) {
            GlobeManager.removeRasterLayer('street-aerial');
            this._aerialOn = false;
        }
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
        if (typeof updateLegendVisibility === 'function') updateLegendVisibility();
    },

    disable() {
        if (this._aerialOn && typeof GlobeManager !== 'undefined') {
            GlobeManager.removeRasterLayer('street-aerial');
            this._aerialOn = false;
        }
    },

    mapillaryKey() {
        try {
            return new URLSearchParams(window.location.search).get('mapillary_key') || '';
        } catch (_) { return ''; }
    },

    // Resolve nearest Mapillary photo to lat/lng via the Graph API.
    // Returns {imageKey, thumb} or null. Requires ?mapillary_key=.
    async resolveMapillaryImage(lat, lng) {
        const key = this.mapillaryKey();
        if (!key || !navigator.onLine) return null;
        const cacheKey = lat.toFixed(3) + ',' + lng.toFixed(3);
        if (this._mapillaryCache[cacheKey] !== undefined) return this._mapillaryCache[cacheKey];
        try {
            const d = 0.02;
            const bbox = [lng - d, lat - d, lng + d, lat + d].join(',');
            const url = 'https://graph.mapillary.com/images?fields=id,thumb_1024_url,computed_geometry&bbox=' +
                encodeURIComponent(bbox) + '&limit=5&access_token=' + encodeURIComponent(key);
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const imgs = (data && data.data) || [];
            let best = null, bestDist = Infinity;
            imgs.forEach((im) => {
                const g = im.computed_geometry && im.computed_geometry.coordinates;
                if (!g) return;
                const dist = Math.hypot(g[0] - lng, g[1] - lat);
                if (dist < bestDist) { bestDist = dist; best = im; }
            });
            const out = best ? { imageKey: best.id, thumb: best.thumb_1024_url } : null;
            this._mapillaryCache[cacheKey] = out;
            return out;
        } catch (e) {
            console.warn('Mapillary resolve failed:', e.message);
            this._mapillaryCache[cacheKey] = null;
            return null;
        }
    },

    // Wire tab buttons + lazy iframe loading for a rendered panorama card.
    // (innerHTML-injected <script> tags do not execute, so binding is explicit.)
    bindPanorama(root) {
        try {
            root = root || document;
            const card = root.querySelector('[data-svcard]') || root;
            if (!card || card.dataset.svbound) return;
            card.dataset.svbound = '1';
            const loadFrame = (name) => {
                const f = card.querySelector('[data-svframe="' + name + '"]');
                if (f && !f.src) {
                    f.src = f.getAttribute('data-src');
                    const spin = card.querySelector('[data-svpane="' + name + '"] [data-svspin]');
                    const done = () => { if (spin) spin.style.display = 'none'; };
                    f.addEventListener('load', done, { once: true });
                    setTimeout(done, 9000);
                }
            };
            const self = this;
            card.querySelectorAll('[data-svtab]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const name = btn.getAttribute('data-svtab');
                    card.querySelectorAll('[data-svpane]').forEach((p) => { p.style.display = (p.getAttribute('data-svpane') === name) ? 'block' : 'none'; });
                    card.querySelectorAll('[data-svtab]').forEach((b) => {
                        const active = b === btn;
                        b.style.background = active ? 'rgba(74,222,128,0.15)' : 'transparent';
                        b.style.color = active ? '#4ade80' : '#9fb3c8';
                        b.style.borderColor = active ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.15)';
                    });
                    if (name === 'mapillary') self.loadMapillaryPane(card);
                    else loadFrame(name);
                });
            });
            loadFrame('google');
        } catch (_) {}
    },

    // Mapillary pane: with a key, resolve + inject a valid image_key embed;
    // without a key (or on failure), keep the graceful app-link fallback.
    async loadMapillaryPane(card) {
        try {
            const pane = card.querySelector('[data-svpane="mapillary"]');
            if (!pane || pane.dataset.svresolved) return;
            const lat = parseFloat(pane.getAttribute('data-lat'));
            const lng = parseFloat(pane.getAttribute('data-lng'));
            const spin = pane.querySelector('[data-svspin]');
            const done = () => { if (spin) spin.style.display = 'none'; };
            if (!this.mapillaryKey()) { done(); return; } // fallback already rendered
            const hit = await this.resolveMapillaryImage(lat, lng);
            pane.dataset.svresolved = '1';
            if (hit && hit.imageKey) {
                const src = 'https://www.mapillary.com/embed?image_key=' + encodeURIComponent(hit.imageKey) + '&style=photo';
                const wrap = pane.querySelector('[data-svmapillary-slot]');
                if (wrap) {
                    wrap.innerHTML = '<iframe src="' + src + '" width="100%" height="300" style="border:0;" loading="lazy" title="Mapillary photo"></iframe>' +
                        (hit.thumb ? '<div style="padding:6px;text-align:center;"><a href="' + hit.thumb + '" target="_blank" rel="noopener" style="color:#4ade80;font-size:11px;">Open full photo ↗</a></div>' : '');
                }
            }
            done();
        } catch (_) {}
    },

    // Tabbed street-level preview: Google (keyless embed) + Mapillary (key
    // or graceful fallback) + OSM map (guaranteed render).
    openPanorama(lat, lng, title) {
        const safeTitle = (title || (lat.toFixed(4) + ', ' + lng.toFixed(4))).replace(/[<>"']/g, '');
        const uid = 'sv' + Math.random().toString(36).slice(2, 8);
        const googleSrc = `https://maps.google.com/maps?q=${lat},${lng}&z=15&layer=c&output=embed`;
        const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.012}%2C${lng + 0.02}%2C${lat + 0.012}&layer=mapnik&marker=${lat}%2C${lng}`;
        const googleExt = `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t`;
        const mapillaryExt = `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=14&focus=photo`;
        // The Mapillary *embed* API requires a resolved image_key (photo ID) —
        // lat/lng alone cannot render a photo. With ?mapillary_key= we resolve
        // the nearest photo at tab-open; otherwise show the app link.
        const mapillaryPane = this.mapillaryKey()
            ? `<div data-svspin style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888;font-size:13px;">Finding nearest Mapillary photo…</div>
               <div data-svmapillary-slot style="position:relative;min-height:300px;"></div>
               <div style="padding:8px;text-align:center;"><a href="${mapillaryExt}" target="_blank" rel="noopener" style="color:#4ade80;font-size:12px;">Open in Mapillary ↗</a></div>`
            : `<div style="padding:28px 18px;text-align:center;color:#9fb3c8;font-size:13px;line-height:1.7;">
                   Mapillary embeds need a free access key.<br>
                   <span style="opacity:0.7">Add <code style="color:#4ade80;">?mapillary_key=YOUR_KEY</code> to the URL<br>(from mapillary.com/dashboard/developers),<br>or open this spot in the Mapillary app:</span><br>
                   <a href="${mapillaryExt}" target="_blank" rel="noopener" style="color:#4ade80;font-size:13px;font-weight:600;">Open in Mapillary ↗</a>
               </div>`;
        return `
            <div id="${uid}" data-svcard style="width:100%;border-radius:8px;overflow:hidden;background:#0d1420;border:1px solid rgba(255,255,255,0.12);">
                <div style="display:flex;gap:6px;padding:8px;background:rgba(255,255,255,0.04);">
                    <button data-svtab="google" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(74,222,128,0.4);background:rgba(74,222,128,0.15);color:#4ade80;cursor:pointer;font-size:12px;font-weight:600;">Google</button>
                    <button data-svtab="mapillary" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#9fb3c8;cursor:pointer;font-size:12px;">Mapillary</button>
                    <button data-svtab="osm" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#9fb3c8;cursor:pointer;font-size:12px;">Map</button>
                </div>
                <div data-svpane="google" style="position:relative;height:360px;">
                    <div data-svspin style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888;font-size:13px;">Loading Google Street View…</div>
                    <iframe data-svframe="google" data-src="${googleSrc}" width="100%" height="360" style="border:0;position:relative;" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Google Street View near ${safeTitle}"></iframe>
                    <div style="padding:8px;text-align:center;"><a href="${googleExt}" target="_blank" rel="noopener" style="color:#4ade80;font-size:12px;">Open in Google Street View ↗</a></div>
                </div>
                <div data-svpane="mapillary" data-lat="${lat}" data-lng="${lng}" style="display:none;position:relative;min-height:360px;">
                    ${mapillaryPane}
                </div>
                <div data-svpane="osm" style="display:none;position:relative;height:360px;">
                    <iframe data-svframe="osm" data-src="${osmSrc}" width="100%" height="360" style="border:0;" loading="lazy" title="OpenStreetMap near ${safeTitle}"></iframe>
                    <div style="padding:8px;text-align:center;font-size:11px;color:#666;">${safeTitle} — street-level imagery varies by location; map always renders.</div>
                </div>
            </div>`;
    }
};
window.StreetViewLayer = StreetViewLayer;
