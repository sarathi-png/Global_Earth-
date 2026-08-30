const BordersLayer = {
    dataSource: null,
    visible: false,
    entities: [],

    async init() {
        if (!this.visible) return;
        try {
            const url = 'data/countries.geo.json';
            this.dataSource = await Cesium.GeoJsonDataSource.load(url, {
                stroke: Cesium.Color.fromCssColorString(CONFIG.LAYERS.borders.color).withAlpha(0.8),
                fill: Cesium.Color.fromCssColorString(CONFIG.LAYERS.borders.color).withAlpha(0.05),
                strokeWidth: 2
            });
            GlobeManager.viewer.dataSources.add(this.dataSource);
            this.dataSource.show = this.visible;
            this.entities = this.dataSource.entities.values;
            this.assignRiskStyling();
            console.log("Balance of Power (Borders) Layer Initialized");
        } catch (error) {
            console.error("Error loading borders GeoJSON:", error);
        }
    },

    assignRiskStyling() {
        if (!this.dataSource) return;
        const riskCountries = {
            'AF': 0.9, 'SY': 0.85, 'YE': 0.85, 'SO': 0.8, 'IQ': 0.7,
            'LY': 0.7, 'SD': 0.7, 'SS': 0.75, 'MM': 0.65, 'UA': 0.6,
            'PK': 0.55, 'IN': 0.4, 'CN': 0.35, 'RU': 0.5, 'IR': 0.6,
            'KP': 0.7, 'VE': 0.55, 'HT': 0.5, 'ET': 0.5, 'NG': 0.45,
            'CD': 0.6, 'ML': 0.55, 'BF': 0.5, 'NE': 0.55, 'TG': 0.35,
            'BD': 0.4, 'PH': 0.4, 'MX': 0.35, 'BR': 0.3, 'CO': 0.4,
            'US': 0.15, 'CA': 0.1, 'GB': 0.1, 'DE': 0.1, 'FR': 0.15,
            'JP': 0.1, 'AU': 0.1, 'NZ': 0.1, 'NO': 0.05, 'SE': 0.1,
            'CH': 0.05, 'IS': 0.05, 'FI': 0.1, 'DK': 0.1, 'NL': 0.1
        };

        this.dataSource.entities.values.forEach(entity => {
            let stability = 0.5;
            const id = entity.properties.getValue('ISO_A2') || entity.properties.getValue('ISO_A3');
            if (id && riskCountries[id] !== undefined) {
                stability = 1 - riskCountries[id];
            } else {
                const name = entity.properties.getValue('NAME') || entity.properties.getValue('name') || '';
                for (const [code, risk] of Object.entries(riskCountries)) {
                    if (name.toLowerCase().includes(code.toLowerCase())) { stability = 1 - risk; break; }
                }
            }
            entity.properties.addProperty('stability', stability);

            if (entity.polygon) {
                if (stability < 0.3) {
                    entity.polygon.material = Cesium.Color.RED.withAlpha(0.2);
                    entity.polygon.outlineColor = Cesium.Color.RED.withAlpha(0.7);
                } else if (stability < 0.5) {
                    entity.polygon.material = Cesium.Color.ORANGE.withAlpha(0.15);
                    entity.polygon.outlineColor = Cesium.Color.ORANGE.withAlpha(0.6);
                } else if (stability < 0.7) {
                    entity.polygon.material = Cesium.Color.YELLOW.withAlpha(0.1);
                    entity.polygon.outlineColor = Cesium.Color.YELLOW.withAlpha(0.5);
                } else {
                    entity.polygon.material = Cesium.Color.SPRINGGREEN.withAlpha(0.08);
                    entity.polygon.outlineColor = Cesium.Color.SPRINGGREEN.withAlpha(0.5);
                }
            }
        });
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show && !this.dataSource && !this._initialized) {
            this._initialized = true;
            this.init();
        }
        if (this.dataSource) this.dataSource.show = show;
    }
};
