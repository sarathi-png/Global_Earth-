// Global Earth — dev-only static file server (production is fully static).
// No API routes, no proxies, no secrets at runtime. Optional .env values
// (CESIUM_TOKEN / NASA_API_KEY) are injected into js/config.js for local dev
// convenience only; static hosts use ?cesium_token= / ?firms_key= instead.
// Usage: node server.js [port]   (default 8080)
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 8080;

// Optional local .env (dev convenience, never required)
(function loadDotEnv() {
    try {
        const envPath = path.join(ROOT, '.env');
        if (!fs.existsSync(envPath)) return;
        for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
    '.mjs': 'application/javascript', '.json': 'application/json',
    '.xml': 'application/xml', '.wasm': 'application/wasm',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
        res.end();
        return;
    }
    const parsedUrl = url.parse(req.url, true);
    let safePath = path.normalize(decodeURIComponent(parsedUrl.pathname)).replace(/\\/g, '/');
    if (safePath === '/' || safePath === '.') safePath = 'index.html';
    if (safePath.startsWith('/')) safePath = safePath.slice(1);

    if (safePath === 'api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'ok', mode: 'static-dev', uptime: process.uptime() }));
        return;
    }

    // Dev-only config injection (static hosts use URL params instead)
    if (safePath === 'js/config.js') {
        try {
            let cfg = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
            const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            cfg = cfg.split('__CESIUM_TOKEN__').join(esc(process.env.CESIUM_TOKEN || ''));
            cfg = cfg.split('__NASA_API_KEY__').join(esc(process.env.NASA_API_KEY || 'DEMO_KEY'));
            res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
            res.end(cfg);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/javascript' });
            res.end('console.error("config injection failed");');
        }
        return;
    }

    const filePath = path.resolve(path.join(ROOT, safePath));
    if (!filePath.startsWith(path.resolve(ROOT) + path.sep) && filePath !== path.resolve(ROOT)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            const fallback404 = path.join(ROOT, '404.html');
            if (fs.existsSync(fallback404)) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                fs.createReadStream(fallback404).pipe(res);
            } else { res.writeHead(404); res.end('Not Found'); }
            return;
        }
        res.setHeader('Content-Type', mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        fs.createReadStream(filePath).on('error', () => { res.writeHead(500); res.end('Server Error'); }).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`Global Earth static dev server at http://localhost:${PORT}/`);
    console.log('Production is fully static (no server required).');
});
