const MarkerFactory = {
    createPoint(item, colorHex) {
        if (!GlobeManager.viewer) return null;

        const markerColor = Cesium.Color.fromCssColorString(colorHex);
        const sizeMap = { 'Extreme': 8, 'High': 7, 'Medium': 6, 'Low': 5 };
        const pixelSize = sizeMap[item.severity] || 6;

        const entity = GlobeManager.viewer.entities.add({
            name: item.title,
            position: Cesium.Cartesian3.fromDegrees(item.lng, item.lat, 1000),
            point: {
                pixelSize: pixelSize,
                color: markerColor,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2
            },
            label: {
                text: item.title,
                font: '11px "Inter", sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -25),
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                translucencyByDistance: new Cesium.NearFarScalar(2000000, 1.0, 15000000, 0.0),
                show: true
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
                source: item.source || 'Intelligence Report',
                wikiQuery: item.wikiQuery || null
            }
        });

        if (typeof MarkerPulse !== 'undefined' && MarkerPulse) {
            MarkerPulse.create(entity, item.type);
        }

        return entity;
    }
};

window.MarkerFactory = MarkerFactory;
