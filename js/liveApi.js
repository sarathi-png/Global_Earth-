const LiveApi = {
    SOURCES: {
        EONET: CONFIG.SOURCES.EONET,
        USGS: CONFIG.SOURCES.USGS,
        GDACS: (CONFIG.API.PROXY_BASE || '') + '/api/gdacs',
        NOAA: CONFIG.SOURCES.NOAA_NWS,
        FIRMS: CONFIG.SOURCES.FIRMS,
        OPEN_METEO: CONFIG.SOURCES.OPEN_METEO,
        FEMA: CONFIG.SOURCES.FEMA
    },

    cache: new Map(),
    CACHE_TTL: CONFIG.API ? CONFIG.API.CACHE_TTL : 60000,

    async fetchJson(url, timeoutMs = 15000) {
        const cacheKey = url;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.time < this.CACHE_TTL) return cached.data;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.cache.set(cacheKey, { data, time: Date.now() });
            return data;
        } finally {
            clearTimeout(timeout);
        }
    },

    async fetchXml(url, timeoutMs) {
        timeoutMs = timeoutMs || 15000;
        var cacheKey = url + '_xml';
        var cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.time < this.CACHE_TTL) return cached.data;
        var controller = new AbortController();
        var timeout = setTimeout(function() { controller.abort(); }, timeoutMs);
        try {
            var res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var text = await res.text();
            var parser = new DOMParser();
            var doc = parser.parseFromString(text, 'text/xml');
            this.cache.set(cacheKey, { data: doc, time: Date.now() });
            return doc;
        } finally {
            clearTimeout(timeout);
        }
    },

    normalizeSeverity(level, type) {
        const maps = {
            earthquake: { critical: [7, Infinity], major: [5, 7], moderate: [3, 5], minor: [0, 3] },
            weather: { critical: ['Extreme'], major: ['Severe'], moderate: ['Moderate'], minor: ['Minor'] },
            gdacs: { critical: ['Red'], major: ['Orange'], moderate: ['Yellow'], minor: ['Green'] },
            fire: { critical: [100, Infinity], major: [50, 100], moderate: [10, 50], minor: [0, 10] }
        };
        const m = maps[type] || maps.earthquake;
        for (const [sev, range] of Object.entries(m)) {
            if (Array.isArray(range)) {
                if (level >= range[0] && level < range[1]) return sev.charAt(0).toUpperCase() + sev.slice(1);
            } else if (range.includes(level)) return sev.charAt(0).toUpperCase() + sev.slice(1);
        }
        return 'Moderate';
    },

    buildWikiQuery(item) {
        if (!item) return null;
        if (item.source === 'NASA EONET') return item.title;
        if (item.source === 'USGS') return item.title;
        if (item.source === 'GDACS') return item.title + ', ' + (item.description.match(/Country: ([^.]+)/) || [,''])[1];
        if (item.source === 'NOAA NWS') return item.title;
        if (item.source === 'NASA FIRMS') {
            var regions = {
                '-10,30': 'Africa', '10,30': 'Africa', '30,30': 'Middle East', '60,20': 'India',
                '90,20': 'Southeast Asia', '110,20': 'China', '120,30': 'Japan',
                '130,30': 'Japan', '-120,35': 'California', '-100,35': 'Texas',
                '-80,35': 'Southeast US', '-60,40': 'Northeast US',
                '50,50': 'Russia', '100,55': 'Siberia', '140,60': 'Siberia',
                '-80,-10': 'Amazon', '-60,-15': 'Brazil', '25,-25': 'Southern Africa',
                '-120,55': 'Canada', '-100,55': 'Canada', '10,55': 'Europe',
                '-40,15': 'Atlantic Ocean', '80,10': 'Indian Ocean'
            };
            var bLat = Math.round(item.lat / 10) * 10;
            var bLng = Math.round(item.lng / 10) * 10;
            var key = bLng + ',' + bLat;
            var region = regions[key] || 'Earth';
            return 'Wildfire near ' + region + ' ' + item.year;
        }
        if (item.source === 'FEMA') return item.title;
        return item.title;
    },

    async fetchEonetEvents() {
        try {
            const data = await this.fetchJson(this.SOURCES.EONET + '?limit=200&days=30');
            const events = data && data.events ? data.events : [];
            return events.map(evt => {
                const geometry = evt.geometry && evt.geometry.length ? evt.geometry[evt.geometry.length - 1] : null;
                if (!geometry || !geometry.coordinates || geometry.coordinates.length < 2) return null;
                const [lng, lat] = geometry.coordinates;
                if (typeof lat !== 'number' || typeof lng !== 'number') return null;
                const category = evt.categories && evt.categories.length ? evt.categories[0].title : 'Unknown';
                const date = geometry.date ? new Date(geometry.date) : new Date();
                return {
                    id: 'eonet-' + evt.id, title: evt.title, type: 'live', category,
                    lat, lng, year: date.getFullYear(), severity: 'Moderate',
                    description: category + ' event (NASA EONET). Source: ' + (evt.sources && evt.sources.length ? evt.sources[0].id : 'EONET') + '.',
                    source: 'NASA EONET', wikiQuery: evt.title
                };
            }).filter(Boolean);
        } catch (e) { console.warn('EONET fetch failed:', e.message); return []; }
    },

    async fetchUsgsQuakes() {
        try {
            const data = await this.fetchJson(this.SOURCES.USGS);
            const features = data && data.features ? data.features : [];
            return features.map(f => {
                const coords = f.geometry && f.geometry.coordinates;
                if (!coords || coords.length < 2) return null;
                const [lng, lat] = coords;
                const props = f.properties || {};
                const mag = typeof props.mag === 'number' ? props.mag : 0;
                const time = props.time ? new Date(props.time) : new Date();
                return {
                    id: 'usgs-' + (f.id || props.net + props.code), title: props.place || 'Earthquake',
                    type: 'live', category: 'Earthquake', lat, lng, year: time.getFullYear(),
                    severity: this.normalizeSeverity(mag, 'earthquake'),
                    description: 'Magnitude ' + mag.toFixed(1) + ' earthquake. ' + (props.place || '') + ' (depth ' + Math.round(coords[2] || 0) + ' km).',
                    source: 'USGS', magnitude: mag, wikiQuery: (props.place || 'Earthquake ' + (f.id || ''))
                };
            }).filter(Boolean);
        } catch (e) { console.warn('USGS fetch failed:', e.message); return []; }
    },

    async fetchGdacsAlerts() {
        try {
            const doc = await this.fetchXml(this.SOURCES.GDACS);
            const items = doc.querySelectorAll('item');
            var self = this;
            var eventTypeMap = {
                'EQ': 'Earthquake', 'FL': 'Flood', 'TC': 'Tropical Cyclone',
                'WF': 'Wildfire', 'DR': 'Drought', 'VO': 'Volcano',
                'LS': 'Landslide', 'EP': 'Epidemic', 'FI': 'Flood'
            };
            return Array.from(items).map(function(item) {
                var titleEl = item.querySelector('title');
                var title = titleEl ? titleEl.textContent.trim() : 'GDACS Alert';
                var descEl = item.querySelector('description');
                var description = descEl ? descEl.textContent.trim() : '';
                var latEl = item.querySelector('lat');
                var lngEl = item.querySelector('long');
                if (!latEl || !lngEl) return null;
                var lat = parseFloat(latEl.textContent);
                var lng = parseFloat(lngEl.textContent);
                if (isNaN(lat) || isNaN(lng)) return null;
                var alertLevelEl = item.querySelector('alertlevel');
                var alertLevel = alertLevelEl ? alertLevelEl.textContent.trim() : 'Green';
                var eventTypeEl = item.querySelector('eventtype');
                var eventTypeCode = eventTypeEl ? eventTypeEl.textContent.trim() : '';
                var category = eventTypeMap[eventTypeCode] || eventTypeCode || 'Disaster';
                var countryEl = item.querySelector('country');
                var country = countryEl ? countryEl.textContent.trim() : '';
                var popEl = item.querySelector('population');
                var population = popEl ? popEl.textContent.trim() : '';
                var eventidEl = item.querySelector('eventid');
                var eventId = eventidEl ? eventidEl.textContent.trim() : '';
                var severityEl = item.querySelector('severity');
                var severityText = severityEl ? severityEl.textContent.trim() : '';
                var desc = description || ('GDACS ' + alertLevel + ' ' + category + ' alert. Country: ' + (country || 'Unknown') + '.');
                if (population) desc += ' Population affected: ' + population + '.';
                if (severityText) desc += ' Severity: ' + severityText + '.';
                var qTitle = category;
                if (country) qTitle += ' in ' + country;
                return {
                    id: 'gdacs-' + (eventId || Math.random().toString(36).slice(2)),
                    title: title, type: 'live', category: category,
                    lat: lat, lng: lng, year: new Date().getFullYear(),
                    severity: self.normalizeSeverity(alertLevel, 'gdacs'),
                    description: desc, source: 'GDACS',
                    alertLevel: alertLevel, wikiQuery: qTitle
                };
            }).filter(Boolean);
        } catch (e) { console.warn('GDACS RSS fetch failed:', e.message); return []; }
    },

    async fetchNoaaAlerts() {
        try {
            const data = await this.fetchJson(this.SOURCES.NOAA);
            const alerts = data && data.features ? data.features : [];
            return alerts.slice(0, 100).map(f => {
                const props = f.properties || {};
                const areaDesc = props.areaDesc || '';
                const latMatch = areaDesc.match(/(\d+\.\d+)N/);
                const lonMatch = areaDesc.match(/(\d+\.\d+)W/) || areaDesc.match(/(\d+\.\d+)E/);
                let lat = latMatch ? parseFloat(latMatch[1]) : 39.0;
                let lng = lonMatch ? -parseFloat(lonMatch[1]) : -98.0;
                if (lonMatch && areaDesc.includes('E')) lng = parseFloat(lonMatch[1]);
                return {
                    id: 'noaa-' + (f.id || Math.random().toString(36).slice(2)),
                    title: props.headline || props.event || 'Weather Alert',
                    type: 'live', category: props.event || 'Severe Weather',
                    lat, lng, year: new Date().getFullYear(),
                    severity: this.normalizeSeverity(props.severity || 'Moderate', 'weather'),
                    description: (props.description || props.headline || 'NOAA weather alert.') + ' Area: ' + areaDesc + '.',
                    source: 'NOAA NWS', event: props.event, wikiQuery: (props.headline || props.event || 'Weather alert')
                };
            });
        } catch (e) { console.warn('NOAA fetch failed:', e.message); return []; }
    },

    async fetchFirmsFires() {
        try {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
            let text = '';
            // Preferred: server-side proxy (FIRMS_MAP_KEY stays secret on server)
            try {
                const proxyRes = await fetch('api/firms?date=' + dateStr);
                if (proxyRes.ok) {
                    const payload = await proxyRes.json();
                    text = payload.data || '';
                }
            } catch (_) { /* fall through to direct */ }
            // Fallback: direct FIRMS call when key supplied via ?firms_key=
            if (!text && CONFIG.FIRMS_MAP_KEY) {
                const url = this.SOURCES.FIRMS + '/' + CONFIG.FIRMS_MAP_KEY + '/VIIRS_SNPP_NRT/world/1/1/' + dateStr + '.csv';
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);
                try {
                    const res = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeout);
                    if (res.ok) text = await res.text();
                } catch (_) { clearTimeout(timeout); }
            }
            if (!text) return [];
            const lines = text.split('\n').slice(1, 60);
            return lines.map(line => {
                const cols = line.split(',');
                if (cols.length < 8) return null;
                const lat = parseFloat(cols[0]);
                const lng = parseFloat(cols[1]);
                const frp = parseFloat(cols[8]) || 0;
                if (isNaN(lat) || isNaN(lng)) return null;
                return {
                    id: 'firms-' + cols[5] + '-' + cols[0] + '-' + cols[1],
                    title: 'Active Fire (VIIRS)',
                    type: 'live', category: 'Wildfires',
                    lat, lng, year: today.getFullYear(),
                    severity: this.normalizeSeverity(frp, 'fire'),
                    description: 'VIIRS fire detection. FRP: ' + frp.toFixed(0) + ' MW. Confidence: ' + (cols[11] || 'N/A') + '%.',
                    source: 'NASA FIRMS', frp, wikiQuery: 'Wildfire ' + today.getFullYear()
                };
            }).filter(Boolean);
        } catch (e) { console.warn('FIRMS fetch failed:', e.message); return []; }
    },

    async fetchFemaDisasters() {
        try {
            const data = await this.fetchJson(this.SOURCES.FEMA + '?$top=50&$orderby=declarationDate%20desc');
            const records = data && data.FemaDisasterSummaries ? data.FemaDisasterSummaries : [];
            return records.map(r => {
                const lat = r.latitude || (39.0 + Math.random() * 6);
                const lng = r.longitude || (-98.0 + Math.random() * 6);
                const declDate = r.declarationDate ? new Date(r.declarationDate) : new Date();
                return {
                    id: 'fema-' + r.disasterNumber,
                    title: (r.incidentType || 'Disaster') + ' - ' + (r.state || 'US'),
                    type: 'live', category: r.incidentType || 'Disaster',
                    lat, lng, year: declDate.getFullYear(),
                    severity: r.incidentType && r.incidentType.toLowerCase().includes('major') ? 'High' : 'Moderate',
                    description: 'FEMA Disaster #' + r.disasterNumber + '. ' + (r.incidentType || '') + ' in ' + (r.state || 'Unknown') + '.',
                    source: 'FEMA', disasterNumber: r.disasterNumber, wikiQuery: ((r.incidentType || '') + ' in ' + (r.state || 'USA'))
                };
            });
        } catch (e) { console.warn('FEMA fetch failed:', e.message); return []; }
    },

    async fetchReliefWeb() {
        try {
            var url = this.SOURCES.RELIEFWEB + '&fields[include][]=name&fields[include][]=type.name&fields[include][]=country.name&fields[include][]=status&fields[include][]=date.created&fields[include][]=url';
            var data = await this.fetchJson(url, 12000);
            var records = data && data.data ? data.data : [];
            var self = this;
            return records.map(function(r) {
                var fields = r.fields || {};
                var name = fields.name || 'ReliefWeb Event';
                var typeName = (fields.type && fields.type.name) ? fields.type.name : 'Disaster';
                var countryName = (fields.country && fields.country.length) ? fields.country[0].name : '';
                var status = fields.status || '';
                var created = fields.date && fields.date.created ? new Date(fields.date.created) : new Date();
                var rwUrl = fields.url || '';
                var lat = 0, lng = 0;
                var countryCoords = {
                    'Nepal': [27.7, 85.3], 'India': [22.5, 78.9], 'China': [34.0, 104.2],
                    'Pakistan': [30.4, 69.3], 'Bangladesh': [23.7, 90.4], 'Afghanaska': [33.9, 67.7],
                    'Myanmar': [19.8, 96.2], 'Indonesia': [-0.8, 113.9], 'Philippines': [12.9, 121.8],
                    'Japan': [36.2, 138.3], 'Turkey': [38.9, 35.2], 'Syria': [34.8, 39.0],
                    'Ukraine': [48.4, 31.2], 'Sudan': [12.9, 30.2], 'Ethiopia': [9.1, 40.5],
                    'Somalia': [5.2, 46.2], 'Yemen': [15.6, 48.5], 'South Sudan': [6.9, 31.3],
                    'DR Congo': [-4.0, 21.8], 'Mozambique': [-18.7, 35.5], 'Madagascar': [-18.8, 46.9],
                    'Haiti': [18.9, -72.3], 'Cuba': [21.5, -77.8], 'Mexico': [23.6, -102.6],
                    'Colombia': [4.6, -74.3], 'Peru': [-9.2, -75.0], 'Brazil': [-14.2, -51.9],
                    'Argentina': [-38.4, -63.6], 'Chile': [-35.7, -71.5], 'Venezuela': [6.4, -66.6],
                    'Guatemala': [15.8, -90.2], 'Honduras': [15.2, -86.2], 'Nicaragua': [12.9, -85.2],
                    'Costa Rica': [10.0, -84.0], 'Panama': [8.5, -80.8],
                    'Mongolia': [46.9, 103.8], 'Nepal': [27.7, 85.3], 'Sri Lanka': [7.9, 80.8],
                    'Thailand': [15.9, 100.9], 'Vietnam': [14.1, 108.3], 'Laos': [19.9, 102.5],
                    'Cambodia': [12.6, 105.0], 'Malaysia': [4.2, 101.9],
                    'Australia': [-25.3, 133.8], 'New Zealand': [-40.9, 174.9],
                    'Fiji': [-17.7, 178.1], 'Tonga': [-21.2, -175.2],
                    'Morocco': [31.8, -7.1], 'Algeria': [28.0, 1.7], 'Tunisia': [33.9, 9.5],
                    'Libya': [26.3, 17.2], 'Egypt': [26.8, 30.8],
                    'Nigeria': [9.1, 8.7], 'Ghana': [7.9, -1.0], 'Kenya': [-0.02, 37.9],
                    'Tanzania': [-6.4, 34.9], 'Uganda': [1.4, 32.3], 'Rwanda': [-1.9, 29.9],
                    'Zimbabwe': [-19.0, 29.2], 'Zambia': [-13.1, 27.8], 'Malawi': [-13.3, 34.3],
                    'Angola': [-11.2, 17.9], 'Congo': [-0.2, 15.8], 'Cameroon': [7.4, 12.4],
                    'Namibia': [-22.6, 17.1], 'Botswana': [-22.3, 24.7], 'South Africa': [-30.6, 22.9],
                    'Germany': [51.2, 10.4], 'France': [46.2, 2.2], 'Italy': [41.9, 12.6],
                    'Spain': [40.5, -3.7], 'UK': [55.4, -3.4], 'Romania': [45.9, 25.0],
                    'Greece': [39.1, 21.8], 'Poland': [51.9, 19.1], 'Norway': [60.5, 8.5],
                    'Sweden': [60.1, 18.6], 'Finland': [61.9, 25.7], 'Iceland': [64.9, -19.0],
                    'Ireland': [53.1, -7.7], 'Portugal': [39.4, -8.2],
                    'Russia': [61.5, 105.3], 'Kazakhstan': [48.0, 68.0],
                    'Uzbekistan': [41.4, 64.6], 'Iran': [32.4, 53.7], 'Iraq': [33.2, 43.7],
                    'Saudi Arabia': [23.9, 45.1], 'UAE': [23.4, 53.8], 'Oman': [21.5, 55.9],
                    'Jordan': [30.6, 36.2], 'Lebanon': [33.9, 35.9], 'Israel': [31.0, 34.9],
                    'Georgia': [42.3, 43.4], 'Armenia': [40.1, 45.0], 'Azerbaijan': [40.1, 47.6],
                    'Greenland': [71.7, -42.6], 'US': [37.1, -95.7], 'Canada': [56.1, -106.3]
                };
                if (countryName && countryCoords[countryName]) {
                    lat = countryCoords[countryName][0];
                    lng = countryCoords[countryName][1];
                    lat += (Math.random() - 0.5) * 2;
                    lng += (Math.random() - 0.5) * 2;
                } else {
                    lat = (Math.random() - 0.5) * 120;
                    lng = (Math.random() - 0.5) * 300;
                }
                var severityMap = {
                    'disaster': 'High', 'emergency': 'High', 'alert': 'Moderate',
                    'event': 'Moderate', 'preparedness': 'Minor', 'archive': 'Minor'
                };
                var severity = severityMap[(status || '').toLowerCase()] || 'Moderate';
                var wikiQ = typeName;
                if (countryName) wikiQ += ' in ' + countryName;
                return {
                    id: 'rw-' + r.id, title: name, type: 'live', category: typeName,
                    lat: lat, lng: lng, year: created.getFullYear(),
                    severity: severity, description: name + '. Status: ' + status + '. Country: ' + (countryName || 'Unknown') + '.',
                    source: 'ReliefWeb', wikiQuery: wikiQ
                };
            }).filter(Boolean);
        } catch (e) { console.warn('ReliefWeb fetch failed:', e.message); return []; }
    },

    async fetchWeatherForPoint(lat, lng) {
        try {
            const url = this.SOURCES.OPEN_METEO + '?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto';
            const data = await this.fetchJson(url, 8000);
            const current = data && data.current;
            if (!current) return null;
            return { temperature: current.temperature_2m, windSpeed: current.wind_speed_10m, weatherCode: current.weather_code };
        } catch (e) { return null; }
    },

    async fetchAll() {
        var results = await Promise.allSettled([
            this.fetchEonetEvents(),
            this.fetchUsgsQuakes(),
            this.fetchGdacsAlerts(),
            this.fetchNoaaAlerts(),
            this.fetchFirmsFires(),
            this.fetchFemaDisasters(),
            this.fetchReliefWeb()
        ]);
        var events = [];
        var sourceStatus = {};
        var sourceNames = ['EONET', 'USGS', 'GDACS', 'NOAA', 'FIRMS', 'FEMA', 'ReliefWeb'];
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                events.push(...r.value);
                sourceStatus[sourceNames[i]] = { status: 'ok', count: r.value.length };
            } else {
                sourceStatus[sourceNames[i]] = { status: 'error', message: r.reason ? r.reason.message : 'unknown' };
            }
        });
        return { events, sourceStatus, total: events.length };
    }
};

window.LiveApi = LiveApi;
