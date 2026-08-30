const LiveApi = {
    EONET_URL: 'https://eonet.gsfc.nasa.gov/api/v3/events',
    USGS_URL: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',

    async fetchJson(url, timeoutMs = 10000) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } finally {
            clearTimeout(timeout);
        }
    },

    async fetchEonetEvents() {
        const data = await this.fetchJson(this.EONET_URL);
        const events = data && data.events ? data.events : [];
        const now = new Date();

        return events.map(evt => {
            const geometry = evt.geometry && evt.geometry.length ? evt.geometry[evt.geometry.length - 1] : null;
            if (!geometry || !geometry.coordinates || geometry.coordinates.length < 2) return null;
            const [lng, lat] = geometry.coordinates;
            if (typeof lat !== 'number' || typeof lng !== 'number') return null;
            const category = evt.categories && evt.categories.length ? evt.categories[0].title : 'Unknown';
            const date = geometry.date ? new Date(geometry.date) : now;

            return {
                id: `eonet-${evt.id}`,
                title: evt.title,
                type: 'live',
                category: category,
                lat: lat,
                lng: lng,
                year: date.getFullYear(),
                severity: 'Medium',
                description: `${category} event reported by NASA EONET. Source: ${evt.sources && evt.sources.length ? evt.sources[0].id : 'EONET'}.`,
                source: 'NASA EONET'
            };
        }).filter(Boolean);
    },

    async fetchUsgsQuakes() {
        const data = await this.fetchJson(this.USGS_URL);
        const features = data && data.features ? data.features : [];

        return features.map(f => {
            const coords = f.geometry && f.geometry.coordinates;
            if (!coords || coords.length < 2) return null;
            const [lng, lat] = coords;
            const props = f.properties || {};
            const mag = typeof props.mag === 'number' ? props.mag : 0;
            const time = props.time ? new Date(props.time) : new Date();
            const severity = mag >= 6 ? 'Extreme' : mag >= 5 ? 'High' : mag >= 4 ? 'Medium' : 'Low';

            return {
                id: `usgs-${f.id || props.net + props.code}`,
                title: props.place || 'Earthquake',
                type: 'live',
                category: 'Earthquake',
                lat: lat,
                lng: lng,
                year: time.getFullYear(),
                severity: severity,
                description: `Magnitude ${mag.toFixed(1)} earthquake. ${props.place || ''} (depth ${Math.round(coords[2] || 0)} km).`,
                source: 'USGS',
                magnitude: mag
            };
        }).filter(Boolean);
    },

    async fetchAll() {
        const [eonet, usgs] = await Promise.allSettled([
            this.fetchEonetEvents(),
            this.fetchUsgsQuakes()
        ]);
        const events = [];
        if (eonet.status === 'fulfilled') events.push(...eonet.value);
        if (usgs.status === 'fulfilled') events.push(...usgs.value);
        return { events, errors: [eonet.status, usgs.status] };
    }
};

window.LiveApi = LiveApi;