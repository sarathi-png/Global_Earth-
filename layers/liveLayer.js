const LiveLayer = {
    entities: [],
    visible: false,
    refreshTimer: null,
    lastRefresh: 0,
    status: 'offline',
    REFRESH_INTERVAL: 5 * 60 * 1000,
    CATEGORY_COLORS: {
        'Wildfires': '#ff6b00',
        'Volcanoes': '#ff3b30',
        'Severe Storms': '#ffea00',
        'Floods': '#00b4ff',
        'Drought': '#c9a227',
        'Sea and Lake Ice': '#7fd4ff',
        'Dust and Haze': '#d4a373',
        'Landslides': '#a0522d',
        'Manmade': '#ff9500',
        'Snow': '#ffffff',
        'Water Color': '#00f2ff',
        'Earthquake': '#ff3b30',
        'Unknown': '#ffb400'
    },

    async init() {
        this.setStatus(navigator.onLine ? 'loading' : 'offline');
        await this.refresh();

        window.addEventListener('online', () => {
            this.setStatus('loading');
            this.refresh();
        });
        window.addEventListener('offline', () => {
            this.setStatus('offline');
        });

        this.startAutoRefresh();
    },

    startAutoRefresh() {
        if (this.refreshTimer) return;
        this.refreshTimer = setInterval(() => {
            if (document.hidden) return;
            if (!navigator.onLine) return;
            this.refresh();
        }, this.REFRESH_INTERVAL);
    },

    async refresh() {
        if (!navigator.onLine) {
            this.setStatus('offline');
            return;
        }

        try {
            const { events, errors } = await LiveApi.fetchAll();
            this.renderMarkers(events);

            const failed = errors.filter(s => s !== 'fulfilled').length;
            this.setStatus(failed === 2 ? 'error' : 'online');
            this.lastRefresh = Date.now();
        } catch (e) {
            console.warn("LiveLayer refresh failed:", e);
            this.setStatus('error');
        }
    },

    renderMarkers(data) {
        this.clearEntities();

        if (!GlobeManager.viewer) return;

        data.forEach(item => {
            try {
                const color = this.CATEGORY_COLORS[item.category] || this.CATEGORY_COLORS['Unknown'];
                const entity = MarkerFactory.createPoint(item, color);
                entity.show = this.visible;
                this.entities.push(entity);
            } catch (e) {
                console.warn("LiveLayer marker failed:", item.id, e);
            }
        });

        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    clearEntities() {
        if (GlobeManager.viewer) {
            this.entities.forEach(entity => {
                if (entity && entity.id) MarkerPulse.remove(entity.id);
                GlobeManager.viewer.entities.remove(entity);
            });
        }
        this.entities = [];
    },

    toggleVisibility(show) {
        this.visible = show;
        this.entities.forEach(entity => {
            entity.show = show;
        });
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    },

    setStatus(status) {
        this.status = status;
        const badge = document.getElementById('liveDataStatus');
        if (!badge) return;
        const labels = { online: 'Live', loading: 'Loading', offline: 'Offline', error: 'Error' };
        badge.innerText = labels[status] || status;
        badge.className = 'value ' + status;
    }
};

window.LiveLayer = LiveLayer;