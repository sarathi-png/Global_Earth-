const StreetViewLayer = {
    provider: null,
    layer: null,
    visible: false,
    enabled: false,
    entities: [],

    async init() {
        // Street imagery is provided as an imagery layer on top of base
        // Uses Cesium Ion Bing Maps (requires CESIUM_TOKEN). Falls back gracefully.
        this.enabled = !!(CONFIG.CESIUM_TOKEN && typeof Cesium !== 'undefined');
        if (!this.enabled) {
            console.log('StreetView: disabled (no Ion token) - will show Google Street View panorama on drawer instead');
        }
        console.log('StreetViewLayer init, ion:', this.enabled);
    },

    async enable() {
        if (this.layer) return this.layer;
        if (!GlobeManager.viewer) return null;
        if (!CONFIG.CESIUM_TOKEN) {
            console.warn('StreetView requires CESIUM_TOKEN');
            return null;
        }
        try {
            // Add high-res Bing Maps via Ion as overlay - street-level detail appears when zoomed in
            const provider = await Cesium.IonImageryProvider.fromAssetId(3);
            const layer = GlobeManager.viewer.imageryLayers.addImageryProvider(provider);
            layer.alpha = CONFIG.STREETVIEW.alpha || 0.95;
            layer.show = this.visible;
            // Push street layer to top
            const idx = GlobeManager.viewer.imageryLayers.indexOf(layer);
            // Keep base at 0, street at top
            this.provider = provider;
            this.layer = layer;
            console.log('StreetView layer added, alpha', layer.alpha);
            return layer;
        } catch (e) {
            console.warn('StreetView layer failed:', e.message);
            return null;
        }
    },

    disable() {
        if (this.layer && GlobeManager.viewer) {
            try { GlobeManager.viewer.imageryLayers.remove(this.layer, true); } catch(e){}
        }
        this.layer = null;
        this.provider = null;
    },

    async toggleVisibility(show) {
        this.visible = show;
        if (show) {
            const layer = await this.enable();
            if (layer) {
                layer.show = true;
            } else if (typeof NotificationSystem !== 'undefined' && NotificationSystem.showToast) {
                // Token-independent fallback: guide to the tabbed drawer card.
                NotificationSystem.showToast({ title: 'Street detail: click any marker → Street View tabs (Google / Mapillary / Map)', category: 'Disaster', severity: 'Moderate', source: 'Global Earth' }, 'moderate');
            }
        } else {
            if (this.layer) this.layer.show = false;
        }
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
        if (typeof updateLegendVisibility === 'function') updateLegendVisibility();
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
                    loadFrame(name);
                });
            });
            loadFrame('google');
        } catch (_) {}
    },

    // Tabbed street-level preview: Google (keyless embed) + Mapillary (free)
    // + OSM map (guaranteed render). Iframes lazy-load on first tab open;
    // every tab has spinner, timeout fallback, and external links.
    openPanorama(lat, lng, title) {
        const safeTitle = (title || (lat.toFixed(4) + ', ' + lng.toFixed(4))).replace(/[<>"']/g, '');
        const uid = 'sv' + Math.random().toString(36).slice(2, 8);
        const googleSrc = `https://maps.google.com/maps?q=${lat},${lng}&z=15&layer=c&output=embed`;
        const mapillarySrc = `https://www.mapillary.com/embed?map_style=Mapillary%20light&x=0.5&y=0.5&style=photo&lat=${lat}&lng=${lng}&z=14`;
        const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.012}%2C${lng + 0.02}%2C${lat + 0.012}&layer=mapnik&marker=${lat}%2C${lng}`;
        const googleExt = `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t`;
        const mapillaryExt = `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=14`;
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
                <div data-svpane="mapillary" style="display:none;position:relative;height:360px;">
                    <div data-svspin style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888;font-size:13px;">Loading Mapillary…</div>
                    <iframe data-svframe="mapillary" data-src="${mapillarySrc}" width="100%" height="360" style="border:0;position:relative;" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapillary near ${safeTitle}"></iframe>
                    <div style="padding:8px;text-align:center;"><a href="${mapillaryExt}" target="_blank" rel="noopener" style="color:#4ade80;font-size:12px;">Open in Mapillary ↗</a></div>
                </div>
                <div data-svpane="osm" style="display:none;position:relative;height:360px;">
                    <iframe data-svframe="osm" data-src="${osmSrc}" width="100%" height="360" style="border:0;" loading="lazy" title="OpenStreetMap near ${safeTitle}"></iframe>
                    <div style="padding:8px;text-align:center;font-size:11px;color:#666;">${safeTitle} — street-level imagery varies by location; map always renders.</div>
                </div>
            </div>`;
    }
};
window.StreetViewLayer = StreetViewLayer;
