/**
 * OsirisLayer — merged Global Earth + OSIRIS intelligence
 * Native endpoints (single server): /api/osiris/maritime, /api/osiris/conflicts, /api/osiris/cctv, /api/osiris/flights, /api/osiris/satellites
 * Proxy fallback: via OSIRIS_URL if native returns empty (when sibling Next.js runs on :4000)
 * Sources vendored in /osiris/ (see osiris-README.md, LICENSE)
 */
const OsirisLayer = {
    entities: [],
    visible: false,
    _initialized: false,
    _fetching: false,
    cctvEntities: [],
    maritimeEntities: [],
    chokepointEntities: [],
    conflictEntities: [],
    flightEntities: [],
    satelliteEntities: [],
    shipEntities: [],

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('OsirisLayer (merged) init — native /api/osiris/* + proxy fallback');
        if (this.visible) await this.fetchAll();
    },

    async fetchAll() {
        if (this._fetching) return;
        this._fetching = true;
        try {
            await Promise.allSettled([
                this.fetchCCTV(),
                this.fetchMaritime(),
                this.fetchConflicts(),
                this.fetchFlights(),
                this.fetchSatellites()
            ]);
            if (typeof updateGlobalStats === 'function') updateGlobalStats();
            if (typeof updateLegendVisibility === 'function') updateLegendVisibility();
        } finally { this._fetching = false; }
    },

    async _fetchJsonWithFallback(nativePath, proxyPath, timeout=12000){
        const tryFetch = async (u)=>{
            const r = await fetch(u, { signal: AbortSignal.timeout(timeout) });
            if(!r.ok) throw new Error('HTTP '+r.status);
            return r.json();
        };
        try{
            return await tryFetch(nativePath);
        }catch(e){
            console.warn('Osiris native failed', nativePath, e.message, '→ proxy', proxyPath);
            try{ return await tryFetch(proxyPath); }catch(e2){ throw e2; }
        }
    },

    async fetchCCTV() {
        try {
            // native merged supports ?region=uk etc; proxy supports more regions. Start with uk for speed, fallback adds curated.
            const data = await this._fetchJsonWithFallback('/api/osiris/cctv?region=uk', '/api/osiris/cctv?region=uk');
            const cams = (data.cameras || []).slice(0, 250);
            console.log('Osiris CCTV (merged):', cams.length, data.sources);
            cams.forEach(cam => {
                try {
                    const lat = cam.lat, lng = cam.lng;
                    if(lat==null||lng==null) return;
                    const safeFeedUrl = (typeof cam.feed_url === 'string' && /^https?:\/\//i.test(cam.feed_url)) ? cam.feed_url : '';
                    const entity = GlobeManager.viewer.entities.add({
                        name: cam.name || 'CCTV',
                        position: Cesium.Cartesian3.fromDegrees(lng, lat, 600),
                        point: { pixelSize: 7, color: Cesium.Color.fromCssColorString('#a78bfa'), outlineColor: Cesium.Color.WHITE, outlineWidth: 1.2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                        label: { text: cam.name ? cam.name.slice(0,22) : 'CCTV', font: '10px Inter, sans-serif', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0,-18), show: false, translucencyByDistance: new Cesium.NearFarScalar(1e3,1,6e6,0) },
                        properties: { id: cam.id, title: cam.name, description: `${cam.city||''} ${cam.country||''} • ${cam.source||'CCTV'} • OSIRIS-merged`, type: 'osiris-cctv', category: 'CCTV', year: new Date().getFullYear(), severity: 'Low', lat, lng, source: cam.source, wikiQuery: cam.city || cam.name, feed_url: safeFeedUrl }
                    });
                    entity.show = this.visible;
                    this.entities.push(entity); this.cctvEntities.push(entity);
                } catch(e){}
            });
        } catch(e){ console.warn('Osiris CCTV fetch failed (both native+proxy):', e.message); }
    },

    async fetchMaritime() {
        try {
            const data = await this._fetchJsonWithFallback('/api/osiris/maritime', '/api/osiris/maritime');
            const ports = (data.ports || []).slice(0, 90);
            const chokes = (data.chokepoints || []).slice(0, 12);
            const ships = (data.ships || []).slice(0, 200);
            console.log('Osiris Maritime (merged):', ports.length, 'ports', chokes.length, 'chokes', ships.length, 'ships');
            ports.forEach(p => {
                try {
                    const lat = p.lat, lng = p.lng; if(lat==null||lng==null) return;
                    const color = p.type==='naval'? '#ef4444' : p.type==='energy'? '#f59e0b' : '#38bdf8';
                    const char = p.type==='naval'? '⚓' : p.type==='energy'? '⛽' : '🚢';
                    const entity = GlobeManager.viewer.entities.add({
                        name: p.name || 'Port',
                        position: Cesium.Cartesian3.fromDegrees(lng, lat, 700),
                        billboard: { image: this.createIcon(color, char), verticalOrigin: Cesium.VerticalOrigin.BOTTOM, disableDepthTestDistance: Number.POSITIVE_INFINITY, scale: 0.95 },
                        properties: { id: 'osiris-port-'+(p.id||p.name), title: p.name, description: `${p.type||'port'} • ${p.country||''} • ${p.volume||p.fleet||''} • ${p.congestion? 'Congestion: '+p.congestion+' dwell '+p.dwell_time:''} • OSIRIS-merged`, type: 'osiris-maritime', category: p.type, year: new Date().getFullYear(), severity: p.type==='naval'?'Medium':'Low', lat, lng, source: 'OSIRIS Maritime (merged)', wikiQuery: p.name }
                    });
                    entity.show = this.visible;
                    this.entities.push(entity); this.maritimeEntities.push(entity);
                } catch(e){}
            });
            chokes.forEach(c=>{
                try{
                    const entity = GlobeManager.viewer.entities.add({
                        name: c.name,
                        position: Cesium.Cartesian3.fromDegrees(c.lng, c.lat, 900),
                        point: { pixelSize: 10, color: Cesium.Color.fromCssColorString(c.risk==='CRITICAL'?'#ef4444':c.risk==='HIGH'?'#f97316':'#f59e0b'), outlineColor: Cesium.Color.WHITE, outlineWidth: 1.5, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                        label: { text: c.name, font: '11px Inter', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth:2, style:Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new Cesium.Cartesian2(0,-16), translucencyByDistance: new Cesium.NearFarScalar(5e4,1,4e6,0) },
                        properties: { id:'choke-'+c.name, title: c.name, description: `Chokepoint • ${c.traffic} • Risk: ${c.risk} • OSIRIS-merged`, type:'osiris-chokepoint', category:'chokepoint', year:new Date().getFullYear(), severity: c.risk, lat:c.lat, lng:c.lng, source:'OSIRIS Maritime', wikiQuery: c.name }
                    });
                    entity.show=this.visible; this.entities.push(entity); this.chokepointEntities.push(entity);
                }catch{}
            });
            ships.forEach(s=>{
                try{
                    if(s.lat==null||s.lng==null) return;
                    const entity = GlobeManager.viewer.entities.add({
                        name: s.name||`Ship ${s.mmsi}`,
                        position: Cesium.Cartesian3.fromDegrees(s.lng, s.lat, 400),
                        point: { pixelSize: 5, color: Cesium.Color.fromCssColorString('#60a5fa'), outlineColor: Cesium.Color.WHITE, outlineWidth:0.8, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                        billboard: { image: this.createIcon('#60a5fa','▸'), verticalOrigin: Cesium.VerticalOrigin.CENTER, rotation: Cesium.Math.toRadians(s.heading||0), disableDepthTestDistance: Number.POSITIVE_INFINITY, show: false },
                        properties: { id:'ship-'+s.mmsi, title: s.name||'Vessel', description: `MMSI ${s.mmsi} • ${s.type||''} ${s.destination? '→ '+s.destination:''} • ${(s.speed||0).toFixed(1)} kn • OSIRIS AIS`, type:'osiris-ship', year:new Date().getFullYear(), severity:'Low', lat:s.lat, lng:s.lng, source:'AISstream via OSIRIS' }
                    });
                    entity.show=this.visible; this.entities.push(entity); this.shipEntities.push(entity);
                }catch{}
            });
        } catch(e){ console.warn('Osiris maritime failed (both):', e.message); }
    },

    async fetchConflicts() {
        try {
            const data = await this._fetchJsonWithFallback('/api/osiris/conflicts', '/api/osiris/conflicts');
            const zones = (data.zones || data.conflicts || []).slice(0, 18);
            const liveEvents = (data.liveEvents || data.events || []).slice(0, 120);
            console.log('Osiris Conflicts (merged):', zones.length, 'zones', liveEvents.length, 'liveEvents');
            zones.forEach(z => {
                try {
                    const lat = z.lat, lng = z.lng; if(lat==null||lng==null) return;
                    const sevColor = z.severity==='war'?'#ef4444': z.severity==='high'?'#f97316':'#f59e0b';
                    const safeSourceUrl = (typeof z.sourceUrl === 'string' && /^https?:\/\//i.test(z.sourceUrl)) ? z.sourceUrl : '';
                    const entity = MarkerFactory ? MarkerFactory.createPoint({ id: 'osiris-conflict-'+z.id, title: z.label||z.name, type:'war', lat, lng, year: new Date().getFullYear(), severity: z.severity==='war'?'Critical':z.severity, description: (z.description||'')+` • ${z.eventCount||0} recent events • OSIRIS-merged`, source: 'OSIRIS Conflicts (merged)', wikiQuery: z.label, sourceUrl: safeSourceUrl }, sevColor) : GlobeManager.viewer.entities.add({
                        position: Cesium.Cartesian3.fromDegrees(lng, lat, 800),
                        point: { pixelSize: 12, color: Cesium.Color.fromCssColorString(sevColor), outlineColor:Cesium.Color.WHITE, outlineWidth:1.5, disableDepthTestDistance:Number.POSITIVE_INFINITY },
                        properties: { id:'osiris-conflict-'+z.id, title: z.label, description: z.description, type:'war', lat, lng, sourceUrl: safeSourceUrl }
                    });
                    entity.show = this.visible;
                    this.entities.push(entity); this.conflictEntities.push(entity);
                    // add small live event dots around zone
                    (z.events||[]).slice(0,6).forEach(ev=>{
                        try{
                            const safeUrl = (typeof ev.url === 'string' && /^https?:\/\//i.test(ev.url)) ? ev.url : '';
                            const e2 = GlobeManager.viewer.entities.add({
                                position: Cesium.Cartesian3.fromDegrees(ev.lng, ev.lat, 500),
                                point:{ pixelSize:6, color: Cesium.Color.fromCssColorString('#f87171').withAlpha(0.85), outlineColor:Cesium.Color.WHITE.withAlpha(0.6), outlineWidth:1, disableDepthTestDistance:Number.POSITIVE_INFINITY },
                                properties:{ id: ev.id, title: typeof ev.title === 'string' ? ev.title : '', description: `${ev.title} • OSIRIS live`, type:'osiris-conflict-event', year:new Date().getFullYear(), severity:'High', lat: ev.lat, lng: ev.lng, source:'OSIRIS RSS', url: safeUrl }
                            });
                            e2.show=this.visible; this.entities.push(e2); this.conflictEntities.push(e2);
                        }catch{}
                    });
                } catch(e){}
            });
            // standalone liveEvents not tied to zone
            liveEvents.slice(0,40).forEach(ev=>{
                if(zones.some(z=> Math.abs(z.lat-ev.lat)<0.5 && Math.abs(z.lng-ev.lng)<0.5)) return; // already clustered
                try{
                    const e2 = GlobeManager.viewer.entities.add({
                        position: Cesium.Cartesian3.fromDegrees(ev.lng, ev.lat, 500),
                        point:{ pixelSize:5, color:Cesium.Color.fromCssColorString('#f87171'), outlineColor:Cesium.Color.WHITE, outlineWidth:1, disableDepthTestDistance:Number.POSITIVE_INFINITY },
                        properties:{ id: ev.id||'live-'+ev.lat+'-'+ev.lng, title: typeof ev.title === 'string' ? ev.title : 'Conflict event', description: typeof ev.title === 'string' ? ev.title : '', type:'osiris-conflict-event', lat: ev.lat, lng: ev.lng, source:'OSIRIS' }
                    });
                    e2.show=this.visible; this.entities.push(e2); this.conflictEntities.push(e2);
                }catch{}
            });
        } catch(e){ console.warn('Osiris conflicts failed (both):', e.message); }
    },

    async fetchFlights() {
        try{
            let data;
            try{
                const r = await fetch('/api/osiris/flights', { signal: AbortSignal.timeout(10000) });
                if(!r.ok) throw new Error('flights '+r.status);
                data = await r.json();
            } catch{
                // fallback to airplanes.live via Global Earth existing layer — just reuse AircraftLayer if visible
                const r2 = await fetch('https://api.airplanes.live/v2/point/0/0/250', { signal: AbortSignal.timeout(8000) }).then(r=>r.json()).catch(()=>null);
                if(!r2 || !r2.ac) throw new Error('no flights');
                data = r2;
            }
            const flights = (data.ac || data.flights || data.data || []).slice(0, 120);
            console.log('Osiris Flights (merged):', flights.length);
            flights.forEach(a=>{
                try{
                    const lat = a.lat || a.latitude, lng = a.lon || a.lng || a.longitude;
                    if(lat==null||lng==null) return;
                    const callsign = a.flight || a.callsign || a.hex || 'Flight';
                    const alt = a.alt_geom || a.alt_baro || 10000;
                    const entity = GlobeManager.viewer.entities.add({
                        name: callsign,
                        position: Cesium.Cartesian3.fromDegrees(lng, lat, alt*0.3048 + 500),
                        model: undefined,
                        billboard: { image: this.createIcon('#22c55e','✈'), verticalOrigin: Cesium.VerticalOrigin.CENTER, rotation: Cesium.Math.toRadians(a.track||a.heading||0), disableDepthTestDistance: Number.POSITIVE_INFINITY, scale: 0.9 },
                        label: { text: callsign, font: '10px Inter', show: false, fillColor:Cesium.Color.WHITE, outlineColor:Cesium.Color.BLACK, outlineWidth:2, style:Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new Cesium.Cartesian2(0,-14), translucencyByDistance: new Cesium.NearFarScalar(2e4,1,5e5,0) },
                        properties: { id: 'flight-'+(a.hex||callsign), title: callsign, description: `${a.t||a.type||''} • ${a.reg||''} • ${alt} ft • ${a.gs||a.speed||''} kts • OSIRIS-merged Flights`, type:'osiris-flight', category:'flight', year:new Date().getFullYear(), severity:'Low', lat, lng, source:'ADS-B via OSIRIS' }
                    });
                    entity.show=this.visible; this.entities.push(entity); this.flightEntities.push(entity);
                }catch{}
            });
        }catch(e){ console.warn('Osiris flights failed:', e.message); }
    },

    async fetchSatellites(){
        try{
            const r = await fetch('/api/osiris/satellites', { signal: AbortSignal.timeout(12000) });
            if(!r.ok) throw new Error('sat '+r.status);
            const data = await r.json();
            const sats = (data.satellites || data.data || []).slice(0, 400);
            console.log('Osiris Satellites (merged):', sats.length, data.source);
            sats.forEach(s=>{
                try{
                    const lat = s.lat, lng = s.lng, alt = s.alt||550;
                    if(lat==null||lng==null) return;
                    const color = s.color || '#f97316';
                    const entity = GlobeManager.viewer.entities.add({
                        name: s.name,
                        position: Cesium.Cartesian3.fromDegrees(lng, lat, alt*1000),
                        point:{ pixelSize: 4, color: Cesium.Color.fromCssColorString(color).withAlpha(0.9), outlineColor:Cesium.Color.WHITE.withAlpha(0.5), outlineWidth:0.8, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                        label:{ text: s.name, font:'9px Inter', show:false, fillColor:Cesium.Color.WHITE, outlineColor:Cesium.Color.BLACK, outlineWidth:2, style:Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new Cesium.Cartesian2(0,-12), translucencyByDistance: new Cesium.NearFarScalar(1e5,1,2e6,0) },
                        properties:{ id:'sat-'+(s.noradId||s.name), title: s.name, description:`${s.mission||''} • alt ${alt} km • ${s.category||''} • OSIRIS-merged`, type:'osiris-satellite', category: s.category||'sat', year:new Date().getFullYear(), severity:'Low', lat, lng, source:'OSIRIS Satellites' }
                    });
                    entity.show=this.visible; this.entities.push(entity); this.satelliteEntities.push(entity);
                }catch{}
            });
        }catch(e){ console.warn('Osiris satellites failed:', e.message); }
    },

    createIcon(color, char) {
        const c = document.createElement('canvas'); c.width=32; c.height=32;
        const ctx=c.getContext('2d'); ctx.fillStyle=color; ctx.beginPath(); ctx.arc(16,16,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#0b0f14'; ctx.font='bold 13px Inter, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(char,16,17);
        // white ring
        ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=1.2; ctx.stroke();
        return c;
    },

    clear() {
        if (GlobeManager.viewer) this.entities.forEach(e=>{ try{ GlobeManager.viewer.entities.remove(e);}catch(_){} });
        this.entities=[]; this.cctvEntities=[]; this.maritimeEntities=[]; this.chokepointEntities=[]; this.conflictEntities=[]; this.flightEntities=[]; this.satelliteEntities=[]; this.shipEntities=[];
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
    },

    destroy() {
        this.clear();
        this.entities = []; this.cctvEntities = []; this.maritimeEntities = []; this.chokepointEntities = []; this.conflictEntities = []; this.flightEntities = []; this.satelliteEntities = []; this.shipEntities = [];
    }
};
window.OsirisLayer = OsirisLayer;
