const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 8080;
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  let safePath = path.normalize(decodeURIComponent(req.url.split('?')[0]));
  if (safePath === '/' || safePath === '\\' || safePath === '.') safePath = 'index.html';
  if (safePath.startsWith('/') || safePath.startsWith('\\')) safePath = safePath.slice(1);
  const filePath = path.join(ROOT, safePath);
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', type);
    const readStream = fs.createReadStream(filePath);
    readStream.on('error', () => {
      res.statusCode = 500;
      res.end('Server Error');
    });
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Offline server running at http://localhost:${PORT}/`);
});
