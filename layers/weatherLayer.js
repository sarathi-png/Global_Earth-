const WeatherLayer = {
    entities: [],
    visible: false,
    gibsLayer: null,

    init() {
        if (!this.visible) return;
        console.log("Weather Layer Initialized (Open-Meteo + GIBS)");
        this.fetchWeatherAlerts();
    },

    async fetchWeatherAlerts() {
        if (!navigator.onLine) return;
        const watchPoints = [
            { name: "Global Hub 1", lat: 40.7, lng: -74.0 },
            { name: "Global Hub 2", lat: 51.5, lng: -0.1 },
            { name: "Global Hub 3", lat: 35.7, lng: 139.7 },
            { name: "Global Hub 4", lat: -33.9, lng: 151.2 },
            { name: "Global Hub 5", lat: 1.3, lng: 103.8 },
            { name: "Global Hub 6", lat: 55.8, lng: 37.6 },
            { name: "Global Hub 7", lat: -22.9, lng: -43.2 },
            { name: "Global Hub 8", lat: 28.6, lng: 77.2 }
        ];

        const results = await Promise.allSettled(
            watchPoints.map(async pt => {
                const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + pt.lat + '&longitude=' + pt.lng + '&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=1';
                const res = await fetch(url);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                return { ...pt, data };
            })
        );

        results.forEach((r, i) => {
            if (r.status === 'fulfilled') this.createWeatherMarker(watchPoints[i], r.value.data);
        });
    },

    getWeatherInfo(code) {
        const weatherMap = {
            0: { type: 'Clear Sky', icon: '☀', color: '#ffd700', severity: 'Low' },
            1: { type: 'Mainly Clear', icon: '🌤', color: '#ffd700', severity: 'Low' },
            2: { type: 'Partly Cloudy', icon: '⛅', color: '#aaaaff', severity: 'Low' },
            3: { type: 'Overcast', icon: '☁', color: '#888888', severity: 'Low' },
            45: { type: 'Fog', icon: '🌫', color: '#cccccc', severity: 'Moderate' },
            48: { type: 'Rime Fog', icon: '🌫', color: '#cccccc', severity: 'Moderate' },
            51: { type: 'Light Drizzle', icon: '🌦', color: '#4488ff', severity: 'Low' },
            53: { type: 'Moderate Drizzle', icon: '🌦', color: '#4488ff', severity: 'Moderate' },
            55: { type: 'Dense Drizzle', icon: '🌧', color: '#4488ff', severity: 'Moderate' },
            61: { type: 'Slight Rain', icon: '🌧', color: '#4488ff', severity: 'Low' },
            63: { type: 'Moderate Rain', icon: '🌧', color: '#4488ff', severity: 'Moderate' },
            65: { type: 'Heavy Rain', icon: '🌧', color: '#0044ff', severity: 'High' },
            71: { type: 'Slight Snow', icon: '❄', color: '#ffffff', severity: 'Low' },
            73: { type: 'Moderate Snow', icon: '❄', color: '#ffffff', severity: 'Moderate' },
            75: { type: 'Heavy Snow', icon: '❄', color: '#ffffff', severity: 'High' },
            77: { type: 'Snow Grains', icon: '❄', color: '#ffffff', severity: 'Low' },
            80: { type: 'Slight Showers', icon: '🌦', color: '#4488ff', severity: 'Low' },
            81: { type: 'Moderate Showers', icon: '🌧', color: '#4488ff', severity: 'Moderate' },
            82: { type: 'Violent Showers', icon: '⛈', color: '#ff4444', severity: 'Extreme' },
            85: { type: 'Slight Snow Showers', icon: '🌨', color: '#ffffff', severity: 'Low' },
            86: { type: 'Heavy Snow Showers', icon: '🌨', color: '#ffffff', severity: 'High' },
            95: { type: 'Thunderstorm', icon: '⛈', color: '#ff4444', severity: 'High' },
            96: { type: 'Thunderstorm + Hail', icon: '⛈', color: '#ff4444', severity: 'Extreme' },
            99: { type: 'Thunderstorm + Heavy Hail', icon: '⛈', color: '#ff0000', severity: 'Extreme' }
        };
        return weatherMap[code] || { type: 'Unknown', icon: '❓', color: '#888888', severity: 'Moderate' };
    },

    createWeatherMarker(point, data) {
        if (!data || !data.current || !GlobeManager.viewer) return;
        const current = data.current;
        const daily = data.daily || {};
        const weatherInfo = this.getWeatherInfo(current.weather_code || 0);
        const temp = current.temperature_2m;
        const wind = current.wind_speed_10m;
        const humidity = current.relative_humidity_2m;
        const maxTemp = daily.temperature_2m_max ? daily.temperature_2m_max[0] : null;
        const precip = daily.precipitation_sum ? daily.precipitation_sum[0] : 0;

        const entity = GlobeManager.viewer.entities.add({
            name: 'Weather: ' + point.name,
            position: Cesium.Cartesian3.fromDegrees(point.lng, point.lat, 15000),
            show: this.visible,
            billboard: {
                image: this.createWeatherCanvas(weatherInfo.icon, weatherInfo.color, temp),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10)
            },
            properties: {
                id: new Cesium.ConstantProperty('weather-' + point.name),
                title: new Cesium.ConstantProperty(weatherInfo.type + ' - ' + point.name),
                type: new Cesium.ConstantProperty('weather'),
                description: new Cesium.ConstantProperty(
                    weatherInfo.type + '\n' +
                    'Temperature: ' + temp + '°C' + (maxTemp ? ' (max ' + maxTemp + '°C)' : '') + '\n' +
                    'Wind: ' + wind + ' km/h\n' +
                    'Humidity: ' + humidity + '%\n' +
                    'Precipitation: ' + precip + 'mm\n' +
                    'Source: Open-Meteo'
                ),
                year: new Cesium.ConstantProperty(new Date().getFullYear()),
                severity: new Cesium.ConstantProperty(weatherInfo.severity),
                source: new Cesium.ConstantProperty('Open-Meteo'),
                lat: new Cesium.ConstantProperty(point.lat),
                lng: new Cesium.ConstantProperty(point.lng)
            }
        });
        this.entities.push(entity);
    },

    createWeatherCanvas(icon, color, temp) {
        const canvas = document.createElement('canvas');
        canvas.width = 56;
        canvas.height = 56;
        const ctx = canvas.getContext('2d');
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.arc(28, 28, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, 28, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(Math.round(temp) + '°', 28, 42);
        return canvas;
    },

    toggleVisibility(show) {
        this.visible = show;
        if (show && this.entities.length === 0 && !this._initialized) {
            this._initialized = true;
            this.init();
        }
        this.entities.forEach(e => e.show = show);
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    }
};

window.WeatherLayer = WeatherLayer;
