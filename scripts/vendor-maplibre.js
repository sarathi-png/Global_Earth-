// Idempotent build-time vendor script (no binaries committed to git).
// Downloads MapLibre GL (OSIRIS engine) dist JS + CSS into vendor/maplibre/
// via plain HTTPS (no npm required). Skips work if present.
const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, 'vendor', 'maplibre');
const FORCE = process.argv.includes('--force');

const FILES = [
  { name: 'maplibre-gl.js', urls: [
    'https://cdn.jsdelivr.net/npm/maplibre-gl@4/dist/maplibre-gl.js',
    'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js',
  ]},
  { name: 'maplibre-gl.css', urls: [
    'https://cdn.jsdelivr.net/npm/maplibre-gl@4/dist/maplibre-gl.css',
    'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css',
  ]},
];

function fetchTo(url, dest) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'global-earth-vendor/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchTo(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(new Error('timeout for ' + url)); });
  });
}

(async () => {
  const jsReady = fs.existsSync(path.join(DEST, 'maplibre-gl.js'));
  const cssReady = fs.existsSync(path.join(DEST, 'maplibre-gl.css'));
  if (jsReady && cssReady && !FORCE) {
    console.log('[vendor] MapLibre already present, skipping (use --force to re-download).');
    return;
  }
  fs.mkdirSync(DEST, { recursive: true });
  for (const f of FILES) {
    const dest = path.join(DEST, f.name);
    if (!FORCE && fs.existsSync(dest)) { console.log(`[vendor] ${f.name} present, skipping.`); continue; }
    let lastErr = null;
    for (const u of f.urls) {
      try {
        console.log(`[vendor] downloading ${u} ...`);
        await fetchTo(u, dest);
        lastErr = null;
        break;
      } catch (e) { lastErr = e; console.warn(`[vendor] failed ${u}: ${e.message}`); }
    }
    if (lastErr) throw lastErr;
    console.log(`[vendor] ${f.name} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
  }
  // Sanity: UMD bundle must expose maplibregl.
  const head = fs.readFileSync(path.join(DEST, 'maplibre-gl.js'), 'utf8').slice(0, 4000);
  if (!/maplibregl/i.test(head) && !fs.readFileSync(path.join(DEST, 'maplibre-gl.js'), 'utf8').includes('Map')) {
    throw new Error('downloaded bundle does not look like maplibre-gl');
  }
  console.log('[vendor] done.');
})().catch((e) => { console.error('[vendor] FAILED:', e.message); process.exit(1); });
