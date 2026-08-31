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
            await this.enable();
            if (this.layer) this.layer.show = true;
        } else {
            if (this.layer) this.layer.show = false;
        }
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
        if (typeof updateLegendVisibility === 'function') updateLegendVisibility();
    },

    // Open Google Street View panorama for a lat/lng in the drawer/modal
    openPanorama(lat, lng, title) {
        const url = `https://www.google.com/maps/embed/v1/streetview?key=&location=${lat},${lng}&heading=0&pitch=0&fov=90`;
        // Use Google Street View via iframe without API key - fallback to maps.google.com
        const panoUrl = `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0`;
        const embedHtml = `
            <div style="width:100%;height:400px;border-radius:8px;overflow:hidden;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#aaa;">
                <iframe src="https://maps.google.com/maps?q=${lat},${lng}&z=15&layer=c&output=embed" width="100%" height="360" style="border:0;border-radius:8px;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                <a href="https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s!2e0!7i13312!8i6656" target="_blank" style="color:#4ade80;margin-top:8px;font-size:13px;">Open in Google Street View &rarr;</a>
                <div style="font-size:11px;color:#666;margin-top:4px;">${title || lat.toFixed(4)+', '+lng.toFixed(4)} &mdash; Street View requires Google Maps</div>
            </div>`;
        return embedHtml;
    }
};
window.StreetViewLayer = StreetViewLayer;
