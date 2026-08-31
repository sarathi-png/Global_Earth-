const OsirisLayer = {
    entities: [],
    visible: false,
    _initialized: false,
    _fetching: false,
    // Sub-layers
    cctvEntities: [],
    maritimeEntities: [],
    conflictEntities: [],

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('OsirisLayer init - proxy via /api/osiris/*');
        if (this.visible) await this.fetchAll();
    },

    async fetchAll() {
        if (this._fetching) return;
        this._fetching = true;
        try {
            await Promise.allSettled([
                this.fetchCCTV(),
                this.fetchMaritime(),
                this.fetchConflicts()
            ]);
            if (typeof updateGlobalStats === 'function') updateGlobalStats();
        } finally { this._fetching = false; }
    },

    async fetchCCTV() {
        try {
            const res = await fetch('/api/osiris/cctv?region=uk', { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error('CCTV HTTP ' + res.status);
            const data = await res.json();
            const cams = (data.cameras || []).slice(0, 200);
            console.log('Osiris CCTV:', cams.length);
            cams.forEach(cam => {
                try {
                    const entity = GlobeManager.viewer.entities.add({
                        name: cam.name || 'CCTV',
                        position: Cesium.Cartesian3.fromDegrees(cam.lng, cam.lat, 500),
                        point: { pixelSize: 6, color: Cesium.Color.fromCssColorString('#a78bfa'), outlineColor: Cesium.Color.WHITE, outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                        label: { text: cam.name ? cam.name.slice(0,22) : 'CCTV', font: '10px Inter', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0,-18), show: false, translucencyByDistance: new Cesium.NearFarScalar(1e3,1,5e6,0) },
                        properties: { id: cam.id, title: cam.name, description: `${cam.city||''} ${cam.country||''} • ${cam.source||'CCTV'}${cam.feed_url? ' • <a href="'+cam.feed_url+'" target="_blank">View feed</a>':''}`, type: 'osiris-cctv', category: 'CCTV', year: new Date().getFullYear(), severity: 'Low', lat: cam.lat, lng: cam.lng, source: cam.source, wikiQuery: cam.city || cam.name }
                    });
                    entity.show = this.visible;
                    this.entities.push(entity);
                    this.cctvEntities.push(entity);
                } catch(e){}
            });
        } catch(e){ console.warn('Osiris CCTV fetch failed:', e.message); }
    },

    async fetchMaritime() {
        try {
            const res = await fetch('/api/osiris/maritime', { signal: AbortSignal.timeout(12000) });
            if (!res.ok) return;
            const data = await res.json();
            const ports = (data.ports || data.data || []).slice(0, 80);
            ports.forEach(p => {
                try {
                    const lat = p.lat || p.latitude, lng = p.lng || p.lon || p.longitude;
                    if (lat==null||lng==null) return;
                    const entity = GlobeManager.viewer.entities.add({
                        name: p.name || 'Port',
                        position: Cesium.Cartesian3.fromDegrees(lng, lat, 500),
                        billboard: { image: this.createIcon('#38bdf8','⚓'), verticalOrigin: Cesium.VerticalOrigin.BOTTOM, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                        properties: { id: 'osiris-port-'+(p.id||p.name), title: p.name, description: `Port • ${p.country||''} ${p.region||''}`, type: 'osiris-maritime', year: new Date().getFullYear(), severity: 'Low', lat, lng, source: 'OSIRIS Maritime', wikiQuery: p.name }
                    });
                    entity.show = this.visible;
                    this.entities.push(entity);
                    this.maritimeEntities.push(entity);
                } catch(e){}
            });
        } catch(e){ console.warn('Osiris maritime failed:', e.message); }
    },

    async fetchConflicts() {
        try {
            const res = await fetch('/api/osiris/conflicts', { signal: AbortSignal.timeout(12000) });
            if (!res.ok) return;
            const data = await res.json();
            const items = (data.conflicts || data.zones || data.data || []).slice(0, 40);
            items.forEach(c => {
                try {
                    const lat = c.lat || c.latitude, lng = c.lng || c.lon || c.longitude;
                    if (lat==null||lng==null) return;
                    const entity = MarkerFactory.createPoint({ id: 'osiris-conflict-'+(c.id||c.name), title: c.name||c.title, type:'war', lat, lng, year: new Date().getFullYear(), severity: c.severity||'High', description: c.description||c.summary||'Conflict zone', source: 'OSIRIS', wikiQuery: c.name }, '#ef4444');
                    entity.show = this.visible;
                    this.entities.push(entity);
                    this.conflictEntities.push(entity);
                } catch(e){}
            });
        } catch(e){ console.warn('Osiris conflicts failed:', e.message); }
    },

    createIcon(color, char) {
        const c = document.createElement('canvas'); c.width=32; c.height=32;
        const ctx=c.getContext('2d'); ctx.fillStyle=color; ctx.beginPath(); ctx.arc(16,16,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(char,16,16);
        return c;
    },

    clear() {
        if (GlobeManager.viewer) this.entities.forEach(e=>{ try{ GlobeManager.viewer.entities.remove(e);}catch(_){} });
        this.entities=[]; this.cctvEntities=[]; this.maritimeEntities=[]; this.conflictEntities=[];
    },

    async toggleVisibility(show){
        this.visible = show;
        if (show) {
            if (!this._initialized) await this.init();
            if (this.entities.length===0) await this.fetchAll();
            this.entities.forEach(e=> e.show=true);
        } else {
            this.entities.forEach(e=> e.show=false);
        }
        if (typeof updateGlobalStats==='function') updateGlobalStats();
        if (typeof updateLegendVisibility==='function') updateLegendVisibility();
    }
};
window.OsirisLayer = OsirisLayer;
