const MarkerFactory = {
    createPoint(item, colorHex) {
        const entity = GlobeManager.viewer.entities.add({
            name: item.title,
            position: Cesium.Cartesian3.fromDegrees(item.lng, item.lat, 1000),
            point: {
                pixelSize: 12,
                color: Cesium.Color.fromCssColorString(colorHex),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY // Keep visible through buildings
            },
            properties: {
                id: item.id,
                title: item.title,
                description: item.description,
                type: item.type,
                year: item.year,
                severity: item.severity,
                lat: item.lat,
                lng: item.lng,
                source: item.source || 'Intelligence Report'
            }
        });

        // Add pulse animation
        if (typeof MarkerPulse !== 'undefined') {
            MarkerPulse.create(entity, item.type);
        }

        return entity;
    }
};
