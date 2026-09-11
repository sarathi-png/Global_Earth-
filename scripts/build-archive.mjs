// Build a committed monthly archive snapshot (static-first data).
// Usage: node scripts/build-archive.mjs [--start=YYYY-MM-DD] [--end=YYYY-MM-DD]
// Defaults: start=2025-01-01, end=last day of previous month (UTC).
// Writes: data/archive-latest.json { meta, events[] } — app event shape.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a, true];
}));
function prevMonthEndISO(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);
}
const START = args.start || '2025-01-01';
const END = args.end || prevMonthEndISO();
const CAP = parseInt(args.cap || '400', 10);

async function getJSON(url, timeoutMs = 20000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    try {
        const r = await fetch(url, { signal: c.signal, headers: { 'Accept': 'application/json', 'User-Agent': 'GlobalEarth-archive-builder/2.1' } });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
        return await r.json();
    } finally { clearTimeout(t); }
}
const out = [];
const status = {};
async function step(name, fn) {
    try {
        const evts = await fn();
        out.push(...evts);
        status[name] = { status: 'ok', count: evts.length };
        console.log(`[archive] ${name}: ${evts.length}`);
    } catch (e) {
        status[name] = { status: 'error', message: String(e.message || e).slice(0, 160) };
        console.warn(`[archive] ${name} FAILED: ${e.message}`);
    }
}
const sevQuake = m => m >= 7 ? 'Critical' : m >= 5 ? 'High' : m >= 4 ? 'Moderate' : 'Minor';

await step('USGS', async () => {
    const u = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${START}&endtime=${END}&minmagnitude=4.5&limit=2000&orderby=time`;
    const d = await getJSON(u);
    return (d.features || []).slice(0, CAP).map(f => {
        const c = (f.geometry && f.geometry.coordinates) || [];
        const p = f.properties || {};
        if (c.length < 2) return null;
        return {
            id: 'usgs-' + (f.id || (p.net + p.code)), title: p.place || 'Earthquake',
            type: 'live', category: 'Earthquake', lat: c[1], lng: c[0],
            year: p.time ? new Date(p.time).getFullYear() : new Date(END).getFullYear(),
            severity: sevQuake(typeof p.mag === 'number' ? p.mag : 0),
            description: 'Magnitude ' + (p.mag ?? '?') + ' earthquake. ' + (p.place || ''),
            source: 'USGS (archive)', wikiQuery: p.place || 'Earthquake'
        };
    }).filter(Boolean);
});

await step('EONET', async () => {
    const u = `https://eonet.gsfc.nasa.gov/api/v3/events?status=all&limit=500&days=365`;
    const d = await getJSON(u);
    const evts = d.events || [];
    return evts.map(e => {
        const g = e.geometry && e.geometry.length ? e.geometry[e.geometry.length - 1] : null;
        if (!g || !g.coordinates || g.coordinates.length < 2) return null;
        const dt = g.date ? new Date(g.date) : null;
        if (dt && (dt.toISOString().slice(0, 10) < START || dt.toISOString().slice(0, 10) > END)) return null;
        const cat = (e.categories && e.categories[0] && e.categories[0].title) || 'Unknown';
        return {
            id: 'eonet-' + e.id, title: e.title, type: 'live', category: cat,
            lat: g.coordinates[1], lng: g.coordinates[0],
            year: dt ? dt.getFullYear() : new Date(END).getFullYear(), severity: 'Moderate',
            description: cat + ' event (NASA EONET).', source: 'NASA EONET (archive)', wikiQuery: e.title
        };
    }).filter(Boolean).slice(0, CAP);
});

await step('GDACS', async () => {
    const u = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;WF;DR&fromdate=${START}&todate=${END}`;
    const d = await getJSON(u);
    const recs = Array.isArray(d) ? d : (d.features || d.events || d.records || []);
    const typeMap = { EQ: 'Earthquake', TC: 'Tropical Cyclone', FL: 'Flood', VO: 'Volcano', WF: 'Wildfire', DR: 'Drought' };
    return (recs || []).slice(0, CAP).map((r, i) => {
        const p = (r && r.properties) || r || {};
        const g = r && r.geometry;
        let lat = p.lat ?? p.latitude, lng = p.lon ?? p.lng ?? p.longitude;
        if ((lat === undefined || lng === undefined) && g && g.coordinates) { lng = g.coordinates[0]; lat = g.coordinates[1]; }
        lat = parseFloat(lat); lng = parseFloat(lng);
        if (!isFinite(lat) || !isFinite(lng)) return null;
        const et = p.eventtype || p.eventType || '';
        const category = typeMap[et] || 'Disaster';
        return {
            id: 'gdacs-' + (p.eventid || p.eventId || p.id || i),
            title: p.title || category, type: 'live', category, lat, lng,
            year: new Date(END).getFullYear(), severity: 'Moderate',
            description: 'GDACS ' + category + ' alert (archive).', source: 'GDACS (archive)',
            wikiQuery: category
        };
    }).filter(Boolean);
});

await step('FEMA', async () => {
    const u = `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=declarationDate ge '${START}' and declarationDate le '${END}'&$top=200&$orderby=declarationDate desc`;
    const d = await getJSON(u);
    const recs = (d && d.DisasterDeclarationsSummaries) || d.FemaDisasterSummaries || [];
    return (recs || []).slice(0, 200).map(r => ({
        id: 'fema-' + r.disasterNumber,
        title: (r.incidentType || 'Disaster') + ' - ' + (r.state || 'US'),
        type: 'live', category: r.incidentType || 'Disaster',
        lat: r.latitude || 39.0, lng: r.longitude || -98.0,
        year: r.declarationDate ? new Date(r.declarationDate).getFullYear() : new Date(END).getFullYear(),
        severity: 'Moderate',
        description: 'FEMA Disaster #' + r.disasterNumber + ' (archive).',
        source: 'FEMA (archive)', wikiQuery: (r.incidentType || '') + ' in ' + (r.state || 'USA')
    }));
});

await step('GDELT', async () => {
    const compact = s => s.replace(/-/g, '') + '000000';
    const u = `https://api.gdeltproject.org/api/v2/doc/doc?query=(earthquake OR flood OR wildfire OR cyclone)&mode=artlist&maxrecords=100&format=json&startdatetime=${compact(START)}&enddatetime=${compact(END)}`;
    const d = await getJSON(u);
    const arts = (d && d.articles) || [];
    // GDELT artlist has no coords — keep as count-only meta, not map markers.
    return [];
});

// Dedupe + cap
const seen = new Set();
const events = out.filter(e => e && e.id && !seen.has(e.id) && seen.add(e.id)).slice(0, 1500);
const payload = {
    meta: { start: START, end: END, generated: new Date().toISOString(), sources: status, count: events.length },
    events
};
mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'archive-latest.json'), JSON.stringify(payload));
console.log(`[archive] wrote data/archive-latest.json: ${events.length} events (${START} → ${END})`);
