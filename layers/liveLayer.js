const LiveLayer = {
    entities: [],
    visible: false,
    refreshTimer: null,
    sseSource: null,
    lastRefresh: 0,
    status: 'offline',
    CATEGORY_COLORS: {
        'Wildfires': '#ff6b00', 'Volcanoes': '#ff3b30', 'Severe Storms': '#ffea00',
        'Floods': '#00b4ff', 'Drought': '#c9a227', 'Sea and Lake Ice': '#7fd4ff',
        'Dust and Haze': '#d4a373', 'Landslides': '#a0522d', 'Manmade': '#ff9500',
        'Snow': '#ffffff', 'Water Color': '#9cdef2', 'Earthquake': '#ffa3a3',
        'Earthquakes': '#ff3b30', 'Wildfire': '#ff6b00', 'Wildfires': '#ff6b00',
        'Flood': '#00b4ff', 'Floods': '#00b4ff', 'Storm': '#ffea00', 'Storms': '#ffea00',
        'Volcano': '#ff3b30', 'Volcanoes': '#ff3b30',
        'Severe Weather': '#ffea00', 'Weather Alert': '#ffea00',
        'Disaster': '#ffb400', 'GDACS Alert': '#ff3b30',
        'Active Fire': '#ff6b00', 'Active Fire (VIIRS)': '#ff6b00',
        'Snow': '#ffffff', 'Fog': '#cccccc', 'Unknown': '#ffb400'
    },

    async init() {
        this.setStatus(navigator.onLine ? 'loading' : 'offline');
        if (this.visible) await this.refresh();
        window.addEventListener('online', () => { this.setStatus('loading'); this.refresh(); this.connectSSE(); });
        window.addEventListener('offline', () => { this.setStatus('offline'); this.disconnectSSE(); });
        this.startAutoRefresh();
        this.connectSSE();
    },

    startAutoRefresh() {
        if (this.refreshTimer) return;
        this.refreshTimer = setInterval(() => {
            if (document.hidden || !navigator.onLine) return;
            this.refresh();
        }, 2 * 60 * 1000);
    },

    connectSSE() {
        if (this.sseSource || !navigator.onLine) return;
        try {
            this.sseSource = new EventSource('/api/stream');
            this.sseSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'connected') { console.log('SSE connected'); return; }
                    if (data.events) this.renderMarkers(data.events);
                } catch (e) { /* ignore parse errors */ }
            };
            this.sseSource.onerror = () => {
                this.sseSource.close();
                this.sseSource = null;
            };
        } catch (e) { console.warn('SSE connection failed:', e.message); }
    },

    disconnectSSE() {
        if (this.sseSource) { this.sseSource.close(); this.sseSource = null; }
    },

    async refresh() {
        if (!navigator.onLine || !this.visible) { if (!navigator.onLine) this.setStatus('offline'); return; }
        try {
            const { events, sourceStatus, total } = await LiveApi.fetchAll();
            this._lastEvents = events;
            this.renderMarkers(events);
            if (typeof NotificationSystem !== 'undefined') { NotificationSystem.processEvents(events); }
            const failedSources = Object.values(sourceStatus).filter(s => s.status === 'error').length;
            const totalSources = Object.keys(sourceStatus).length;
            if (failedSources === totalSources) this.setStatus('error');
            else if (failedSources > 0) this.setStatus('partial');
            else this.setStatus('online');
            this.lastRefresh = Date.now();
            this.updateSourceBadge(sourceStatus, total);
        } catch (e) {
            console.warn("LiveLayer refresh failed:", e);
            this.setStatus('error');
        }
    },

    updateSourceBadge(sourceStatus, total) {
        const badge = document.getElementById('liveDataStatus');
        if (!badge) return;
        const online = Object.values(sourceStatus).filter(s => s.status === 'ok').length;
        badge.innerText = 'Live (' + online + '/' + Object.keys(sourceStatus).length + ' | ' + total + ')';
    },

    renderMarkers(data) {
        this.clearEntities();
        if (!GlobeManager.viewer) return;
        data.forEach(item => {
            try {
                const color = this.CATEGORY_COLORS[item.category] || this.CATEGORY_COLORS[item.source] || '#ffb400';
                const entity = MarkerFactory.createPoint(item, color);
                entity.show = this.visible;
                this.entities.push(entity);
            } catch (e) { console.warn("LiveLayer marker failed:", item.id, e); }
        });
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    clearEntities() {
        if (GlobeManager.viewer) {
            this.entities.forEach(entity => {
                if (entity && entity.id) { try { MarkerPulse.remove(entity.id); } catch(e) {} }
                GlobeManager.viewer.entities.remove(entity);
            });
        }
        this.entities = [];
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show && this.entities.length === 0 && !this._initialized) {
            this._initialized = true;
            this.init();
        }
        this.entities.forEach(entity => { entity.show = show; });
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    setStatus(status) {
        this.status = status;
        const badge = document.getElementById('liveDataStatus');
        if (!badge) return;
        const labels = { online: 'Live', loading: 'Loading...', offline: 'Offline', error: 'Error', partial: 'Partial' };
        badge.innerText = labels[status] || status;
        badge.className = 'value ' + status;
    }
};

window.LiveLayer = LiveLayer;
