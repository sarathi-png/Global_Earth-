const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 8080;

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

function fetchUrl(targetUrl, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(targetUrl, { timeout: timeoutMs, headers: { 'User-Agent': 'GlobalEarth/2.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

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
  let safePath = path.normalize(decodeURIComponent(parsedUrl.pathname));
  if (safePath === '/' || safePath === '\\' || safePath === '.') safePath = 'index.html';
  if (safePath.startsWith('/') || safePath.startsWith('\\')) safePath = safePath.slice(1);

  if (safePath === 'api/stream') { handleSSE(req, res); return; }
  if (safePath === 'api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders() });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), sseClients: sseClients.size, cacheEntries: cache.size }));
    return;
  }

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
  console.log(`API proxy: /api/eonet, /api/usgs, /api/gdacs, /api/noaa, /api/fema`);
  console.log(`SSE stream: /api/stream`);
  console.log(`Health check: /api/health`);
});
