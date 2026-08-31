const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 8080;

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
  for (let i = 0; i < apiUrl.length; i++) {
    h = ((h << 5) - h + apiUrl.charCodeAt(i)) | 0;
  }
  return 'api_' + Math.abs(h).toString(36);
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  if (!entry || now - entry.start > 60000) {
    rateLimiter.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function fetchUrl(targetUrl, timeoutMs = 15000, extraHeaders) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const headers = { 'User-Agent': 'GlobalEarth/2.0', ...(extraHeaders || {}) };
    const req = client.get(targetUrl, { timeout: timeoutMs, headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const OSIRIS_URL = process.env.OSIRIS_URL || 'http://localhost:4000';

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
    res.end(JSON.stringify({ error: 'OSiris proxy failed', message: e.message, hint: 'Is OSiris running on ' + OSIRIS_URL + ' ?' }));
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
  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch (e) { sseClients.delete(client); }
  }
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

  if (safePath === 'api/stream') { handleSSE(req, res); return; }
  if (safePath === 'api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), sseClients: sseClients.size, cacheEntries: cache.size, osiris: OSIRIS_URL, unsplash: !!UNSPLASH_KEY }));
    return;
  }

  if (safePath === 'api/unsplash') { handleUnsplash(req, res, parsedUrl); return; }
  if (safePath.startsWith('api/osiris/')) { handleOsirisProxy(req, res); return; }

  if (proxyEndpoints['/' + safePath]) {
    const targetUrl = proxyEndpoints['/' + safePath];
    if (targetUrl) { await handleProxy(req, res, targetUrl); return; }
  }

  if (safePath.startsWith('api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ error: 'Unknown API endpoint' }));
    return;
  }

  const filePath = path.join(ROOT, safePath);
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const fallback404 = path.join(ROOT, '404.html');
      if (fs.existsSync(fallback404)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(fallback404).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
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

setInterval(() => {
  const stale = Date.now() - CACHE_TTL * 2;
  for (const [key, val] of cache) { if (val.time < stale) cache.delete(key); }
}, CACHE_TTL);

server.listen(PORT, () => {
  console.log(`Global Earth server running at http://localhost:${PORT}/`);
  console.log(`API proxy: /api/eonet, /api/usgs, /api/gdacs, /api/noaa, /api/fema, /api/unsplash, /api/osiris/*`);
  console.log(`SSE stream: /api/stream`);
  console.log(`Health check: /api/health`);
  if (!UNSPLASH_KEY) console.log('Note: UNSPLASH_ACCESS_KEY not set - /api/unsplash will return 503');
  console.log(`OSiris proxy target: ${OSIRIS_URL}`);
});
