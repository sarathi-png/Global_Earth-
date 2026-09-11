// ClusteringManager — adapter over MapLibre native per-source clustering
// (cluster:true on each point source, OSIRIS pattern). Toggle switches the
// cluster/count layers and dot filters without rebuilding sources.
const ClusteringManager = {
    enabled: true,
    CLUSTERED_KEYS: ['disasters', 'wars', 'mysteries', 'history', 'live'],

    init() {
        if (!GlobeManager.map) return;
        console.log('Clustering System Initialized (MapLibre native)');
    },

    toggle(show) {
        this.enabled = !!show;
        if (typeof GlobeManager === 'undefined') return;
        this.CLUSTERED_KEYS.forEach((key) => {
            try { GlobeManager.setClustering(key, this.enabled); } catch (_) {}
        });
    }
};
