const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 8080;
const EMBED_PORT = parseInt(process.env.EMBED_PORT, 10) || 4000;
const EMBED_STARTED = { value: false };

// Load .env manually (no dotenv dependency)
(function loadDotEnv() {
  try {
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch (_) {}
})();


const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.cjs': 'application/javascript', '.mjs': 'application/javascript',
  '.json': 'application/json', '.xml': 'application/xml', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ktx2': 'image/ktx2', '.bin': 'application/octet-stream',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

const cache = new Map();
const CACHE_TTL = 60000;
const rateLimiter = new Map();
const RATE_LIMIT = 60;
const sseClients = new Set();

// ── Polite fetch helpers (OSIRIS port — no IP spoofing) ──
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
];
const _uaIdx = 0; // rotate gently
function politeHeaders(extra){
  const ua = USER_AGENTS[_uaIdx % USER_AGENTS.length];
  return { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9', ...(extra||{}) };
}
async function fetchPolite(targetUrl, opts={}){
  const headers = politeHeaders(opts.headers);
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), opts.timeout||12000);
  try{
    const res = await fetch(targetUrl, { ...opts, headers, signal: controller.signal });
    clearTimeout(t);
    const text = await res.text();
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: text, ok: res.ok, json: ()=>{ try{return JSON.parse(text);}catch{return null;} } };
  } catch(e){ clearTimeout(t); throw e; }
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
    'Access-Control-Max-Age': '86400'
  };
}
function getCacheKey(apiUrl) {
  let h = 0;
  for (let i = 0; i < apiUrl.length; i++) h = ((h << 5) - h + apiUrl.charCodeAt(i)) | 0;
  return 'api_' + Math.abs(h).toString(36);
}
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  if (!entry || now - entry.start > 60000) { rateLimiter.set(ip, { start: now, count: 1 }); return true; }
  entry.count++; return entry.count <= RATE_LIMIT;
}
const ALLOWED_UPSTREAM_HOSTS = new Set([
  'eonet.gsfc.nasa.gov', 'earthquake.usgs.gov', 'www.gdacs.org',
  'api.weather.gov', 'www.fema.gov', 'api.open-meteo.com',
  'api.airplanes.live', 'celestrak.org', 'api.unsplash.com',
  'api.tfl.gov.uk', 'data.wsdot.wa.gov', 'feeds.bbci.co.uk',
  'www.aljazeera.com', 'api.gdeltproject.org',
]);

function isSafeUpstreamHost(hostname) {
  const h = (hostname || '').toLowerCase();
  if (ALLOWED_UPSTREAM_HOSTS.has(h)) return true;
  if (h.endsWith('.nasa.gov') || h.endsWith('.usgs.gov') || h.endsWith('.noaa.gov')) return true;
  return false;
}

function fetchUrl(targetUrl, timeoutMs = 15000, extraHeaders) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try { parsedUrl = new URL(targetUrl); } catch (e) { return reject(new Error('Invalid URL')); }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return reject(new Error('Blocked protocol'));
    }
    if (!isSafeUpstreamHost(parsedUrl.hostname)) {
      return reject(new Error('Blocked host: ' + parsedUrl.hostname));
    }
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const headers = { 'User-Agent': 'GlobalEarth/2.0', ...(extraHeaders || {}) };
    const req = client.get(targetUrl, { timeout: timeoutMs, headers }, (res) => {
      let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const OSIRIS_URL = process.env.OSIRIS_URL || 'http://localhost:4000';

// ── OSIRIS vendored data (merged) ──
const MARITIME_PORTS = [
  { name: 'Shanghai', country: 'CN', lat: 31.23, lng: 121.47, type: 'container', volume: '47.3M TEU', rank: 1 },
  { name: 'Singapore', country: 'SG', lat: 1.26, lng: 103.84, type: 'container', volume: '37.2M TEU', rank: 2 },
  { name: 'Ningbo-Zhoushan', country: 'CN', lat: 29.87, lng: 121.55, type: 'container', volume: '33.3M TEU', rank: 3 },
  { name: 'Shenzhen', country: 'CN', lat: 22.54, lng: 114.05, type: 'container', volume: '30.0M TEU', rank: 4 },
  { name: 'Guangzhou', country: 'CN', lat: 23.08, lng: 113.32, type: 'container', volume: '24.2M TEU', rank: 5 },
  { name: 'Busan', country: 'KR', lat: 35.10, lng: 129.04, type: 'container', volume: '22.7M TEU', rank: 6 },
  { name: 'Qingdao', country: 'CN', lat: 36.07, lng: 120.38, type: 'container', volume: '22.0M TEU', rank: 7 },
  { name: 'Rotterdam', country: 'NL', lat: 51.90, lng: 4.50, type: 'container', volume: '14.5M TEU', rank: 8 },
  { name: 'Dubai (Jebel Ali)', country: 'AE', lat: 25.01, lng: 55.06, type: 'container', volume: '14.0M TEU', rank: 9 },
  { name: 'Port Klang', country: 'MY', lat: 2.99, lng: 101.39, type: 'container', volume: '13.2M TEU', rank: 10 },
  { name: 'Antwerp', country: 'BE', lat: 51.30, lng: 4.40, type: 'container', volume: '12.0M TEU', rank: 11 },
  { name: 'Hamburg', country: 'DE', lat: 53.55, lng: 9.97, type: 'container', volume: '8.7M TEU', rank: 14 },
  { name: 'Los Angeles', country: 'US', lat: 33.74, lng: -118.27, type: 'container', volume: '9.9M TEU', rank: 13 },
  { name: 'Long Beach', country: 'US', lat: 33.75, lng: -118.19, type: 'container', volume: '8.0M TEU', rank: 15 },
  { name: 'Felixstowe', country: 'GB', lat: 51.96, lng: 1.35, type: 'container', volume: '3.8M TEU' },
  { name: 'Santos', country: 'BR', lat: -23.95, lng: -46.31, type: 'container', volume: '4.2M TEU' },
  { name: 'Colombo', country: 'LK', lat: 6.94, lng: 79.84, type: 'container', volume: '7.2M TEU' },
  { name: 'Tokyo', country: 'JP', lat: 35.61, lng: 139.79, type: 'container', volume: '4.5M TEU' },
  { name: 'Yokohama', country: 'JP', lat: 35.45, lng: 139.66, type: 'container', volume: '2.9M TEU' },
  { name: 'Busan', country: 'KR', lat: 35.10, lng: 129.04, type: 'container', volume: '22.7M TEU' },
  { name: 'Ras Tanura', country: 'SA', lat: 26.64, lng: 50.16, type: 'energy', volume: '6.5M bpd' },
  { name: 'Fujairah', country: 'AE', lat: 25.14, lng: 56.35, type: 'energy', volume: '3.5M bpd' },
  { name: 'Novorossiysk', country: 'RU', lat: 44.72, lng: 37.77, type: 'energy', volume: '2.8M bpd' },
  { name: 'Houston Ship Channel', country: 'US', lat: 29.73, lng: -95.27, type: 'energy', volume: '2.5M bpd' },
  { name: 'Norfolk Naval Station', country: 'US', lat: 36.95, lng: -76.33, type: 'naval', fleet: 'US Atlantic Fleet' },
  { name: 'San Diego Naval Base', country: 'US', lat: 32.69, lng: -117.15, type: 'naval', fleet: 'US Pacific Fleet' },
  { name: 'Pearl Harbor', country: 'US', lat: 21.35, lng: -157.97, type: 'naval', fleet: 'US Pacific Fleet' },
  { name: 'Yokosuka', country: 'JP', lat: 35.28, lng: 139.67, type: 'naval', fleet: 'US 7th Fleet' },
  { name: 'Severomorsk', country: 'RU', lat: 69.07, lng: 33.42, type: 'naval', fleet: 'Russian Northern Fleet' },
  { name: 'Tartus', country: 'SY', lat: 34.89, lng: 35.89, type: 'naval', fleet: 'Russian Mediterranean' },
  { name: 'Portsmouth', country: 'GB', lat: 50.80, lng: -1.11, type: 'naval', fleet: 'Royal Navy' },
  { name: 'Toulon', country: 'FR', lat: 43.12, lng: 5.93, type: 'naval', fleet: 'French Navy Mediterranean' },
  { name: 'Visakhapatnam', country: 'IN', lat: 17.69, lng: 83.30, type: 'naval', fleet: 'Indian Navy Eastern Command' },
];
const MARITIME_CHOKEPOINTS = [
  { name: 'Strait of Hormuz', lat: 26.57, lng: 56.25, traffic: '21M bpd oil', risk: 'HIGH' },
  { name: 'Strait of Malacca', lat: 2.50, lng: 101.50, traffic: '16M bpd oil', risk: 'MODERATE' },
  { name: 'Suez Canal', lat: 30.43, lng: 32.34, traffic: '12% world trade', risk: 'ELEVATED' },
  { name: 'Bab el-Mandeb', lat: 12.58, lng: 43.33, traffic: '6.2M bpd oil', risk: 'CRITICAL' },
  { name: 'Panama Canal', lat: 9.08, lng: -79.68, traffic: '5% world trade', risk: 'LOW' },
  { name: 'Turkish Straits', lat: 41.12, lng: 29.07, traffic: '3M bpd oil', risk: 'MODERATE' },
  { name: 'Taiwan Strait', lat: 24.00, lng: 119.00, traffic: '88% large ships', risk: 'ELEVATED' },
];

const KNOWN_CONFLICTS = [
  { id: 'ukraine', label: 'UKRAINE WAR', severity: 'war', lat: 48.5, lng: 31.2, region: 'ukraine', description: 'Ongoing Russian invasion — active frontlines across eastern/southern regions.', sourceUrl: 'https://liveuamap.com/', queries: ['ukraine war','ukraine attack'], bounds: { minLat:44,maxLat:53,minLng:22,maxLng:40 } },
  { id: 'gaza', label: 'GAZA CONFLICT', severity: 'war', lat: 31.35, lng: 34.35, region: 'gaza', description: 'Active operations and humanitarian crisis in Gaza Strip.', sourceUrl: 'https://israelpalestine.liveuamap.com/', queries: ['gaza attack','gaza airstrike'], bounds:{minLat:31,maxLat:32,minLng:34,maxLng:34.8} },
  { id: 'sudan', label: 'SUDAN CIVIL WAR', severity: 'war', lat: 15.0, lng: 30.0, region: 'sudan', description: 'SAF vs RSF across Sudan.', sourceUrl: 'https://sudan.liveuamap.com/', queries:['sudan war'], bounds:{minLat:10,maxLat:22,minLng:22,maxLng:38} },
  { id: 'myanmar', label: 'MYANMAR CONFLICT', severity: 'war', lat: 19.5, lng: 96.5, region: 'myanmar', description:'Military junta vs opposition.', sourceUrl:'https://myanmar.liveuamap.com/', queries:['myanmar conflict'], bounds:{minLat:10,maxLat:28,minLng:92,maxLng:101} },
  { id: 'yemen', label: 'YEMEN WAR', severity: 'war', lat: 15.5, lng: 48.0, region:'yemen', description:'Houthi operations, Red Sea threats.', sourceUrl:'https://yemen.liveuamap.com/', queries:['yemen houthi'], bounds:{minLat:12,maxLat:20,minLng:42,maxLng:55} },
  { id: 'syria', label: 'SYRIA', severity: 'high', lat:35.0,lng:38.5, region:'syria', description:'Civil conflict.', sourceUrl:'https://syria.liveuamap.com/', queries:['syria attack'], bounds:{minLat:32,maxLat:37,minLng:35,maxLng:42} },
  { id: 'drc', label:'DRC EASTERN CONFLICT', severity:'war', lat:-1.0,lng:28.5, region:'drc', description:'M23 offensive.', sourceUrl:'https://drc.liveuamap.com/', queries:['congo conflict'], bounds:{minLat:-5,maxLat:5,minLng:25,maxLng:32} },
  { id: 'sahel', label:'SAHEL INSTABILITY', severity:'high', lat:14.0,lng:5.0, region:'sahel', description:'Insurgencies Mali/Burkina/Niger.', sourceUrl:'https://africa.liveuamap.com/', queries:['sahel insurgency'], bounds:{minLat:10,maxLat:20,minLng:-5,maxLng:15} },
  { id: 'taiwan-strait', label:'TAIWAN STRAIT', severity:'elevated', lat:24.0,lng:119.0, region:'taiwan', description:'Military drills & tension.', sourceUrl:'https://china.liveuamap.com/', queries:['taiwan strait'], bounds:{minLat:22,maxLat:26,minLng:117,maxLng:122} },
];

const proxyEndpoints = {
  '/api/eonet': 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=200&days=30',
  '/api/usgs': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
  '/api/gdacs': 'https://www.gdacs.org/xml/rss.xml',
  '/api/noaa': 'https://api.weather.gov/alerts/active?status=actual&message_type=alert&limit=200',
  '/api/fema': 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=200&$orderby=declarationDate%20desc',
  '/api/open-meteo': null,
  '/api/airplanes': null,
  '/api/celestrak': null
};

// ── Native OSIRIS handlers (merged, single-server) ──
async function handleOsirisMaritimeNative(req, res) {
  const payload = { ports: MARITIME_PORTS, chokepoints: MARITIME_CHOKEPOINTS, ships: [], total_ports: MARITIME_PORTS.length, total_chokepoints: MARITIME_CHOKEPOINTS.length, total_ships: 0, timestamp: new Date().toISOString(), source: 'osiris-merged (static)' };
  // Try live AIS if key present via cache-less ship fetch (optional)
  res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders(), 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' });
  res.end(JSON.stringify(payload));
}

async function handleOsirisConflictsNative(req, res) {
  const cacheKey = getCacheKey('osiris_conflicts_native');
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < 300000) { res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders() }); res.end(cached.data); return; }
  let liveEvents = [];
  let eventsByRegion = {};
  try {
    const feeds = ['http://feeds.bbci.co.uk/news/world/rss.xml','https://www.aljazeera.com/xml/rss/all.xml'];
    const results = await Promise.allSettled(feeds.map(u=> fetchPolite(u, { timeout: 7000 })));
    const items = [];
    for(const r of results){ if(r.status==='fulfilled' && r.value.ok){ const xml = r.value.body; const raw = xml.split(/<item>/i).slice(1); for(const chunk of raw){ const titleM = chunk.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i); const linkM = chunk.match(/<link>(.*?)<\/link>/i); if(!titleM) continue; const title = titleM[1].replace(/<[^>]*>/g,'').trim(); const link = linkM?linkM[1]:''; items.push({title, link}); } } }
    let eid=0;
    for(const item of items){
      const txt=(item.title).toLowerCase();
      for(const zone of KNOWN_CONFLICTS){
        const hit = zone.queries.some(q=> txt.includes(q.split(' ')[0]));
        if(hit){ eventsByRegion[zone.id]=(eventsByRegion[zone.id]||0)+1; const dup = liveEvents.some(e=>e.title===item.title); if(!dup){ liveEvents.push({ id:`osint-${eid++}`, lat: zone.lat + (eid%5 -2)*0.08, lng: zone.lng + ((eid*3)%5 -2)*0.08, title: item.title.substring(0,150), url: item.link, type:'conflict', timestamp: new Date().toISOString() }); } break; }
      }
    }
  } catch(e){ console.warn('conflicts native fetch failed', e.message); }
  const zones = KNOWN_CONFLICTS.map(z=>{
    const zoneEvents = liveEvents.filter(e=> e.lat>=z.bounds.minLat && e.lat<=z.bounds.maxLat && e.lng>=z.bounds.minLng && e.lng<=z.bounds.maxLng);
    return { id:z.id, label:z.label, severity:z.severity, lat:z.lat, lng:z.lng, description:z.description, sourceUrl:z.sourceUrl, region:z.region, events: zoneEvents.slice(0,20), eventCount: eventsByRegion[z.id]||zoneEvents.length, lastUpdated: new Date().toISOString() };
  });
  const body = JSON.stringify({ zones, liveEvents: liveEvents.slice(0,500), totalZones: zones.length, totalLiveEvents: liveEvents.length, activeWarzones: zones.filter(z=>z.severity==='war').length, timestamp: new Date().toISOString(), sources:['OSIRIS-merged RSS'], refreshInterval:300 });
  cache.set(cacheKey, { data: body, time: Date.now() });
  res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders(), 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' });
  res.end(body);
}

async function handleOsirisCctvNative(req, res, parsedUrl){
  // Simplified native: curated fallbacks + attempt live for uk/us
  const qRegion = (parsedUrl.query.region || '').toLowerCase();
  const lat = parseFloat(parsedUrl.query.lat || '0');
  const lng = parseFloat(parsedUrl.query.lng || '0');
  const cacheKey = getCacheKey('osiris_cctv_'+qRegion+'_'+lat+'_'+lng);
  const cached = cache.get(cacheKey);
  if(cached && Date.now()-cached.time < 120000){ res.writeHead(200, {'Content-Type':'application/json', ...getCorsHeaders()}); res.end(cached.data); return; }
  let cameras = [];
  let sources = {};
  let regions = [];
  // Try stealth fetch for a couple quick sources if region matches
  const wantUK = !qRegion || qRegion.includes('uk') || (lat>49 && lat<61 && lng>-8 && lng<2);
  const wantUS = !qRegion || qRegion.includes('us');
  const fetches = [];
  if(wantUK){
    fetches.push(fetchPolite('https://api.tfl.gov.uk/Place/Type/JamCam', { timeout: 8000 }).then(r=>{
      if(!r.ok) return []; const data = r.json(); if(!Array.isArray(data)) return [];
      return data.slice(0,80).map(cam=>{ const imgProp = cam.additionalProperties?.find(p=>p.key==='imageUrl'); const camId=cam.id?.replace('JamCams_','')||''; return { id:`tfl-${cam.id}`, lat: cam.lat, lng: cam.lon, name: cam.commonName||'London JamCam', city:'London', country:'UK', feed_url: imgProp?.value || `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${camId}.jpg`, source:'TfL' }; }).filter(c=>c.lat && c.lng);
    }).catch(()=>[]));
    regions.push('uk');
  }
  if(wantUS){
    fetches.push(fetchPolite('https://data.wsdot.wa.gov/log/public/cameras.json', { timeout: 8000 }).then(r=>{
      if(!r.ok) return []; const data = r.json(); if(!Array.isArray(data)) return []; return data.slice(0,60).map(cam=>({ id:`wsdot-${cam.CameraID}`, lat: cam.CameraLocation?.Latitude, lng: cam.CameraLocation?.Longitude, name: cam.Title||'WSDOT Camera', city:'Washington', country:'US', feed_url: cam.ImageURL||'', source:'WSDOT' })).filter(c=>c.lat&&c.lng&&c.feed_url);
    }).catch(()=>[]));
    regions.push('us-west');
  }
  try{
    const results = await Promise.allSettled(fetches);
    for(const r of results) if(r.status==='fulfilled') cameras.push(...r.value);
  }catch{}
  for(const c of cameras) sources[c.source]=(sources[c.source]||0)+1;
  // Fallback curated if too few
  if(cameras.length < 10){
    const curated = [
      { id:'cur-ldn-1', lat:51.5074,lng:-0.1278,name:'London Eye',city:'London',country:'UK', feed_url:'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.1.jpg', source:'TfL (curated)' },
      { id:'cur-nyc-1', lat:40.7128,lng:-74.0060,name:'NYC Times Square',city:'New York',country:'US', feed_url:'', source:'Curated' },
      { id:'cur-sg-1', lat:1.3521,lng:103.8198,name:'Singapore Orchard',city:'Singapore',country:'SG', feed_url:'', source:'Curated' },
      { id:'cur-tokyo-1', lat:35.6762,lng:139.6503,name:'Shibuya Crossing',city:'Tokyo',country:'JP', feed_url:'', source:'Curated' },
    ];
    cameras.push(...curated);
    curated.forEach(c=> sources[c.source]=(sources[c.source]||0)+1);
  }
  const body = JSON.stringify({ cameras, total: cameras.length, sources, regions: qRegion? qRegion.split(','):regions, timestamp: new Date().toISOString() });
  cache.set(cacheKey, { data: body, time: Date.now() });
  res.writeHead(200, { 'Content-Type':'application/json', ...getCorsHeaders(), 'Cache-Control':'public, s-maxage=60, stale-while-revalidate=120' });
  res.end(body);
}

async function handleOsirisFlightsNative(req,res){
  try{
    const r = await fetchUrl('https://api.airplanes.live/v2/point/0/0/250', 8000);
    if(r.status===200){ res.writeHead(200, {'Content-Type':'application/json', ...getCorsHeaders()}); res.end(r.body); return; }
  }catch(e){ console.warn('flights native error', e.message); }
  res.writeHead(200, {'Content-Type':'application/json', ...getCorsHeaders()});
  res.end(JSON.stringify({ ac: [], msg:'flight feed unavailable (handled native fallback)', timestamp: new Date().toISOString() }));
}
async function handleOsirisSatellitesNative(req,res){
  try{
    const r = await fetchUrl('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json', 10000);
    if(r.status===200 && r.body && r.body.length>100){ res.writeHead(200, {'Content-Type':'application/json', ...getCorsHeaders()}); res.end(r.body); return; }
  }catch(e){ console.warn('sat native error', e.message); }
  res.writeHead(200, {'Content-Type':'application/json', ...getCorsHeaders()});
  res.end(JSON.stringify({ satellites:[{ name:'ISS', lat: 51.0, lng: 0.0, alt: 420, mission:'Space Station', color:'#FFD700', category:'science', noradId:'25544' }], total:1, source:'fallback' }));
}

function handleOsirisNative(req,res,parsedUrl){
  const p = parsedUrl.pathname.replace(/^\/api\/osiris\//,'');
  if(p==='maritime' || p==='maritime/') return handleOsirisMaritimeNative(req,res);
  if(p==='conflicts' || p.startsWith('conflicts')) return handleOsirisConflictsNative(req,res);
  if(p==='cctv' || p.startsWith('cctv')) return handleOsirisCctvNative(req,res,parsedUrl);
  if(p==='flights' || p==='aircraft') return handleOsirisFlightsNative(req,res);
  if(p==='satellites' || p.startsWith('satellites')) return handleOsirisSatellitesNative(req,res);
  if(p==='earthquakes'){ return fetchUrl('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',10000).then(r=>{ res.writeHead(r.status, {'Content-Type':'application/json', ...getCorsHeaders()}); res.end(r.body); }).catch(e=>{ res.writeHead(502, {'Content-Type':'application/json', ...getCorsHeaders()}); res.end(JSON.stringify({error:e.message})); }); }
  if(p==='fires'){ return fetchUrl('https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&limit=100',10000).then(r=>{ res.writeHead(r.status, {'Content-Type':'application/json', ...getCorsHeaders()}); res.end(r.body); }).catch(e=>{ res.writeHead(502, {'Content-Type':'application/json', ...getCorsHeaders()}); res.end(JSON.stringify({error:e.message})); }); }
  if(p==='news' || p==='gdelt' || p==='gdelt-events'){ return fetchUrl('https://api.gdeltproject.org/api/v2/doc/doc?query=conflict&mode=ArtList&maxrecords=50&format=json',10000).then(r=>{ res.writeHead(r.status, {'Content-Type':'application/json', ...getCorsHeaders()}); res.end(r.body); }).catch(e=>{ res.writeHead(502, {'Content-Type':'application/json', ...getCorsHeaders()}); res.end(JSON.stringify({error:e.message})); }); }
  return null; // not handled natively
}

function handleFirms(req, res, parsedUrl) {
  const key = process.env.FIRMS_MAP_KEY || '';
  if (!key) {
    res.writeHead(503, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'FIRMS_MAP_KEY not configured', data: '' }));
    return;
  }
  const date = /^\d{8}$/.test(parsedUrl.query.date || '') ? parsedUrl.query.date
    : new Date(Date.now() - 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  const target = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1/1/${date}.csv`;
  const clientIp = req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'Rate limit' }));
    return;
  }
  const cacheKey = getCacheKey('firms_' + date);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(cached.data);
    return;
  }
  fetchUrl(target, 15000).then(result => {
    const body = JSON.stringify({ data: result.status === 200 ? result.body : '' });
    if (result.status === 200) cache.set(cacheKey, { data: body, time: Date.now() });
    res.writeHead(result.status === 200 ? 200 : result.status, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(body);
  }).catch(e => {
    res.writeHead(502, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: e.message, data: '' }));
  });
}

function handleUnsplash(req, res, parsedUrl) {
  if (!UNSPLASH_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'UNSPLASH_ACCESS_KEY not configured', results: [] }));
    return;
  }
  const q = parsedUrl.query.query || '';
  if (!q) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'Missing query', results: [] }));
    return;
  }
  const per_page = Math.min(parseInt(parsedUrl.query.per_page || '3', 10) || 3, 10);
  const target = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${per_page}&orientation=landscape`;
  const clientIp = req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'Rate limit' }));
    return;
  }
  const cacheKey = getCacheKey('unsplash_' + q + '_' + per_page);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(cached.data);
    return;
  }
  fetchUrl(target, 10000, { 'Authorization': `Client-ID ${UNSPLASH_KEY}` }).then(result => {
    if (result.status === 200) cache.set(cacheKey, { data: result.body, time: Date.now() });
    res.writeHead(result.status, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(result.body);
  }).catch(e => {
    res.writeHead(502, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: e.message, results: [] }));
  });
}

function handleOsirisProxy(req, res) {
  const subPath = req.url.replace(/^\/api\/osiris\//, '/api/');
  const target = OSIRIS_URL + subPath;
  fetchUrl(target, 15000).then(result => {
    const ct = result.headers && result.headers['content-type'] ? result.headers['content-type'] : 'application/json';
    res.writeHead(result.status, { 'Content-Type': ct, ...getCorsHeaders() });
    res.end(result.body);
  }).catch(e => {
    res.writeHead(502, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'OSiris proxy failed', message: e.message, hint: 'Is OSiris running on ' + OSIRIS_URL + ' ? (merged native fallback available for maritime/conflicts/cctv/flights/satellites)' }));
  });
}

async function handleProxy(req, res, apiPath) {
  const clientIp = req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
    return;
  }
  const cacheKey = getCacheKey(apiPath + req.url);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(cached.data);
    return;
  }
  try {
    const result = await fetchUrl(apiPath);
    cache.set(cacheKey, { data: result.body, time: Date.now() });
    var ct = result.headers && result.headers['content-type'] ? result.headers['content-type'] : 'application/json';
    res.writeHead(result.status, { 'Content-Type': ct, ...getCorsHeaders() });
    res.end(result.body);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'Upstream fetch failed', message: e.message }));
  }
}

function handleSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...getCorsHeaders()
  });
  res.write('data: {"type":"connected","merged":"osiris+global-earth"}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, getCorsHeaders());
    res.end();
    return;
  }
  const parsedUrl = url.parse(req.url, true);
  let safePath = path.normalize(decodeURIComponent(parsedUrl.pathname)).replace(/\\/g, '/');
  if (safePath === '/' || safePath === '.') safePath = 'index.html';
  if (safePath.startsWith('/')) safePath = safePath.slice(1);

  // ── Embedded OSIRIS — proxy to embedded server on port 4000 ──
  if (safePath.startsWith('osiris-embed/')) {
    const subPath = req.url.replace(/^\/osiris-embed/, '');
    const proxyTarget = `http://localhost:${EMBED_PORT}${subPath || '/'}`;
    const client = new URL(proxyTarget);
    const moduleClient = client.protocol === 'https:' ? https : http;
    const proxyReq = moduleClient.get(proxyTarget, { timeout: 10000 }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, {
        'Content-Type': proxyRes.headers['content-type'] || 'text/html',
        ...getCorsHeaders()
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      console.warn('[OSIRIS EMBED PROXY ERROR]', e.message, 'target:', proxyTarget);
      res.writeHead(502, { 'Content-Type': 'text/html', ...getCorsHeaders() });
      res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>OSIRIS — Not Ready</title><style>body{background:#0f0f23;color:#fff;font-family:sans-serif;padding:60px;text-align:center;line-height:1.6;}</style></head><body><h1>🛰 OSIRIS — Build Required</h1><p>The embedded OSIRIS server (<code>osiris-embed/server.js</code>) is not running or the build is missing.</p><ol style="text-align:left;display:inline-block;margin-top:20px;font-size:14px;line-height:2;color:#ccc;"><li>Run <code>npm install</code> in <code>D:\Projects\osiris</code></li><li>Run <code>npm run build</code> in <code>D:\Projects\osiris</code></li><li>Copy <code>.next/standalone/osiris/*</code> to <code>D:\Projects\global-earth-project\osiris-embed/</code></li><li>Restart the server (<code>node server.js</code>)</li></ol><a href="/" style="display:inline-block;margin-top:30px;padding:10px 20px;background:#a78bfa;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">← Back to Global Earth</a></body></html>');
    });
    return;
  }

  // Safe config endpoint (early, before proxy/404)
  if (safePath === 'api/config/public') {
    const safeConfig = { OSIRIS: { enabled: false, url: OSIRIS_URL }, LAYERS: { disasters: true, wars: true }, GLOBE_SETTINGS: { baseColor: '#1a202c' } };
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify(safeConfig)); return;
  }

  if (safePath === 'api/stream') { handleSSE(req, res); return; }
  if (safePath === 'api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ status: 'ok', merged: 'osiris+global-earth', uptime: process.uptime(), sseClients: sseClients.size, cacheEntries: cache.size, osiris: OSIRIS_URL, unsplash: !!UNSPLASH_KEY, osiris_native: ['maritime','conflicts','cctv','flights','satellites','earthquakes','fires','news'] }));
    return;
  }
  if (safePath === 'api/unsplash') { handleUnsplash(req, res, parsedUrl); return; }
  if (safePath === 'api/firms') { handleFirms(req, res, parsedUrl); return; }
  // OSIRIS merged native first, then proxy fallback
  if (safePath.startsWith('api/osiris/')) {
    const native = handleOsirisNative(req, res, parsedUrl);
    if (native && typeof native.then === 'function') { try{ await native; return; } catch(e){ /* fall to proxy */ } }
    else if (native !== null) return;
    // try proxy, but if proxy fails we already responded with 502 - keep that
    // For native-capable routes we also want fallback to proxy if native returned null
    // So attempt proxy as fallback for all osiris routes
    // If native didn't handle (null), we treat as proxy
    if (safePath.startsWith('api/osiris/')) { handleOsirisProxy(req, res); return; }
  }

  if (proxyEndpoints['/' + safePath]) {
    const targetUrl = proxyEndpoints['/' + safePath];
    if (targetUrl) { await handleProxy(req, res, targetUrl); return; }
  }
  if (safePath.startsWith('api/')) {
    // Safe config endpoint (before generic 404)
    if (safePath === 'api/config/public') {
      const safeConfig = { OSIRIS: { enabled: false, url: OSIRIS_URL }, LAYERS: { disasters: true, wars: true }, GLOBE_SETTINGS: { baseColor: '#1a202c' } };
      res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders() });
      res.end(JSON.stringify(safeConfig)); return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'Unknown API endpoint', merged: 'osiris+global-earth', hint: 'try /api/osiris/maritime, /api/osiris/conflicts, /api/osiris/cctv, /api/health' }));
    return;
  }
  // Config injection — public browser keys only (never log values).
  // js/config.js ships with __PLACEHOLDERS__ substituted from env at request time.
  if (safePath === 'js/config.js') {
    try {
      let cfg = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
      const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      cfg = cfg.split('__CESIUM_TOKEN__').join(esc(process.env.CESIUM_TOKEN || ''));
      cfg = cfg.split('__NASA_API_KEY__').join(esc(process.env.NASA_API_KEY || 'DEMO_KEY'));
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache', ...getCorsHeaders() });
      res.end(cfg);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/javascript', ...getCorsHeaders() });
      res.end('console.error("config injection failed");const CONFIG={CESIUM_TOKEN:"",FIRMS_MAP_KEY:"",NASA_API_KEY:"DEMO_KEY"};');
    }
    return;
  }
  const filePath = path.resolve(path.join(ROOT, safePath));
  const rootResolved = path.resolve(ROOT);
  if (!filePath.startsWith(rootResolved + path.sep) && filePath !== rootResolved) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const fallback404 = path.join(ROOT, '404.html');
      if (fs.existsSync(fallback404)) { res.writeHead(200, { 'Content-Type': 'text/html' }); fs.createReadStream(fallback404).pipe(res); }
      else { res.writeHead(404); res.end('Not Found'); }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(filePath).on('error', () => { res.writeHead(500); res.end('Server Error'); }).pipe(res);
  });
});

process.on('uncaughtException', e=>{ console.error('uncaught', e && e.stack || e); });
process.on('unhandledRejection', e=>{ console.error('unhandledRejection', e && e.stack || e); });

// Auto-start embedded OSIRIS on port 4000 (only once)
function startEmbeddedOsiris() {
  if (EMBED_STARTED.value) return;
  EMBED_STARTED.value = true;
  try {
    const embedDir = path.join(ROOT, 'osiris-embed');
    if (fs.existsSync(path.join(embedDir, 'server.js'))) {
      const child = spawn('node', [path.join(embedDir, 'server.js')], {
        cwd: embedDir,
        env: { ...process.env, PORT: String(EMBED_PORT) },
        stdio: 'inherit',
        detached: true
      });
      console.log(`[OSIRIS EMBED] Starting embedded OSIRIS on port ${EMBED_PORT}`);
      child.on('exit', (code) => console.log(`[OSIRIS EMBED] Exited with code ${code}`));
    } else {
      console.log('[OSIRIS EMBED] Server not found at osiris-embed/server.js — skip');
    }
  } catch (e) {
    console.log('[OSIRIS EMBED] Failed to start:', e.message);
  }
}
startEmbeddedOsiris();

setInterval(() => {
  const stale = Date.now() - CACHE_TTL * 2;
  for (const [key, val] of cache) { if (val.time < stale) cache.delete(key); }
}, CACHE_TTL);

server.listen(PORT, () => {
  console.log(`Global Earth + OSIRIS merged server at http://localhost:${PORT}/`);
  console.log(`API proxy: /api/eonet, /api/usgs, /api/gdacs, /api/noaa, /api/fema, /api/unsplash`);
  console.log(`OSIRIS merged native: /api/osiris/maritime, /api/osiris/conflicts, /api/osiris/cctv, /api/osiris/flights, /api/osiris/satellites (+ proxy fallback to ${OSIRIS_URL})`);
  console.log(`SSE stream: /api/stream`);
  console.log(`Health check: /api/health`);
  if (!UNSPLASH_KEY) console.log('Note: UNSPLASH_ACCESS_KEY not set - /api/unsplash will return 503');
  else console.log('Unsplash: key set');
  // Config: do NOT log secret values
  console.log('Config: secrets loaded from .env (not printed)');
  console.log(`OSiris proxy target (fallback): ${OSIRIS_URL}`);
});
