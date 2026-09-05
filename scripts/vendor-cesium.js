// Idempotent build-time vendor script (no binaries committed to git).
// Downloads CesiumJS 1.119 build + earth texture into vendor/ + assets/.
// Safe to run on Render (node >= 18, npm available). Skips work if present.
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const CESIUM_VERSION = '1.119.0';
const THREE_GLOBE_VERSION = '2.45.2';
const CESIUM_DEST = path.join(ROOT, 'vendor', 'cesium');
const TEXTURE_DEST = path.join(ROOT, 'assets', 'textures', 'earth-texture.jpg');
const FORCE = process.argv.includes('--force');

function npm(args, opts) {
  return new Promise((resolve, reject) => {
    // Shell string (quoted) avoids EINVAL on Windows npm.cmd and DEP0190-safe.
    const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
    const cmd = ['npm', ...args].map(q).join(' ');
    exec(cmd, opts, (err, stdout, stderr) => {
      if (err) return reject(new Error(`npm ${args.join(' ')} failed: ${stderr || err.message}`));
      resolve(stdout);
    });
  });
}

function dirSize(p) {
  let total = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    total += e.isDirectory() ? dirSize(f) : fs.statSync(f).size;
  }
  return total;
}

(async () => {
  const cesiumReady = fs.existsSync(path.join(CESIUM_DEST, 'Cesium.js'));
  const textureReady = fs.existsSync(TEXTURE_DEST);
  if (cesiumReady && textureReady && !FORCE) {
    console.log('[vendor] Cesium + texture already present, skipping (use --force to re-download).');
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'global-earth-vendor-'));
  console.log('[vendor] temp dir:', tmp);
  try {
    console.log(`[vendor] installing cesium@${CESIUM_VERSION} + three-globe@${THREE_GLOBE_VERSION} ...`);
    await npm(['install', '--no-save', '--no-audit', '--no-fund',
      `cesium@${CESIUM_VERSION}`, `three-globe@${THREE_GLOBE_VERSION}`, '--prefix', tmp,
    ], { timeout: 600000 });
    if (!cesiumReady || FORCE) {
      const src = path.join(tmp, 'node_modules', 'cesium', 'Build', 'Cesium');
      if (!fs.existsSync(path.join(src, 'Cesium.js'))) throw new Error('cesium Build output missing Cesium.js');
      fs.rmSync(CESIUM_DEST, { recursive: true, force: true });
      fs.mkdirSync(CESIUM_DEST, { recursive: true });
      fs.cpSync(src, CESIUM_DEST, { recursive: true });
      console.log(`[vendor] cesium vendored (${(dirSize(CESIUM_DEST) / 1048576).toFixed(1)} MB)`);
    }
    if (!textureReady || FORCE) {
      const texSrc = path.join(tmp, 'node_modules', 'three-globe', 'example', 'img', 'earth-blue-marble.jpg');
      if (!fs.existsSync(texSrc)) throw new Error('three-globe texture missing: ' + texSrc);
      fs.mkdirSync(path.dirname(TEXTURE_DEST), { recursive: true });
      fs.copyFileSync(texSrc, TEXTURE_DEST);
      console.log(`[vendor] texture vendored (${(fs.statSync(TEXTURE_DEST).size / 1024).toFixed(0)} KB)`);
    }
    console.log('[vendor] done.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error('[vendor] FAILED:', e.message); process.exit(1); });
