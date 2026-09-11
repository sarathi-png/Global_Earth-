// FeatureFactory — plain-object entities + GeoJSON features (MapLibre).
// Keeps the old MarkerFactory.createPoint(item, color) signature so every
// layer module works unchanged; the engine resolves clicks back to these
// entities via GlobeManager.syncLayer's index.
const FeatureFactory = {
    createPoint(item, colorHex, key) {
        const lat = Number(item.lat);
        const lng = Number(item.lng);
        const rawId = item.id || ((item.title || 'pt') + '-' + lat + '-' + lng);
        const id = (key ? key + ':' : '') + rawId;
        const sev = item.severity || 'Low';
        const sizeMap = { 'Critical': 9, 'Extreme': 8, 'High': 7, 'Moderate': 6, 'Medium': 6, 'Minor': 5, 'Low': 5 };
        return {
            id: id,
            _size: sizeMap[sev] || 6,
            show: true,
            properties: {
                id: rawId,
                title: item.title || 'Unknown',
                description: item.description || 'No description available.',
                type: item.type || 'info',
                category: item.category || null,
                year: (item.year !== undefined && item.year !== null) ? item.year : '-',
                severity: sev,
                lat: isFinite(lat) ? lat : 0,
                lng: isFinite(lng) ? lng : 0,
                source: item.source || 'Intelligence Report',
                country: item.country || null,
                wikiQuery: item.wikiQuery || null,
                feed_url: item.feed_url || null,
                color: colorHex || '#ffb400',
                heading: (item.heading !== undefined) ? item.heading : null,
                icon: item.icon || null
            }
        };
    }
};

// Legacy alias — all existing layer code calls MarkerFactory.createPoint.
const MarkerFactory = FeatureFactory;
window.MarkerFactory = MarkerFactory;
window.FeatureFactory = FeatureFactory;
