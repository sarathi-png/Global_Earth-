#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEPLOY_DIR = path.join(__dirname, '..', 'deploy');
const ROOT = path.join(__dirname, '..');

console.log('Global Earth - GitHub Pages Deploy Script');
console.log('=========================================\n');

// Check if gh-pages is available
try {
  execSync('gh --version', { stdio: 'ignore' });
} catch (e) {
  console.error('Error: GitHub CLI (gh) is required for deployment.');
  console.error('Install it from: https://cli.github.com/');
  process.exit(1);
}

// Create deploy directory
if (fs.existsSync(DEPLOY_DIR)) {
  fs.rmSync(DEPLOY_DIR, { recursive: true });
}
fs.mkdirSync(DEPLOY_DIR, { recursive: true });

// Copy static files
const copyDir = (src, dest) => {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
};

console.log('Copying static files...');
copyDir(path.join(ROOT, 'assets'), path.join(DEPLOY_DIR, 'assets'));
copyDir(path.join(ROOT, 'core'), path.join(DEPLOY_DIR, 'core'));
copyDir(path.join(ROOT, 'css'), path.join(DEPLOY_DIR, 'css'));
copyDir(path.join(ROOT, 'data'), path.join(DEPLOY_DIR, 'data'));
copyDir(path.join(ROOT, 'animations'), path.join(DEPLOY_DIR, 'animations'));
copyDir(path.join(ROOT, 'incidents'), path.join(DEPLOY_DIR, 'incidents'));
copyDir(path.join(ROOT, 'js'), path.join(DEPLOY_DIR, 'js'));
copyDir(path.join(ROOT, 'layers'), path.join(DEPLOY_DIR, 'layers'));
copyDir(path.join(ROOT, 'search'), path.join(DEPLOY_DIR, 'search'));
copyDir(path.join(ROOT, 'timeline'), path.join(DEPLOY_DIR, 'timeline'));
copyDir(path.join(ROOT, 'ui'), path.join(DEPLOY_DIR, 'ui'));
copyDir(path.join(ROOT, 'fonts'), path.join(DEPLOY_DIR, 'fonts'));
copyDir(path.join(ROOT, 'scripts'), path.join(DEPLOY_DIR, 'scripts'));
copyDir(path.join(ROOT, 'vendor'), path.join(DEPLOY_DIR, 'vendor'));

// Copy root files
const rootFiles = ['index.html', 'server.js', 'sw.js', 'manifest.json', '.env.example', 'README.md', 'LICENSE'];
rootFiles.forEach(file => {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DEPLOY_DIR, file));
});

// Create .nojekyll for GitHub Pages
fs.writeFileSync(path.join(DEPLOY_DIR, '.nojekyll'), '');

// Create CNAME if needed (optional)
// fs.writeFileSync(path.join(DEPLOY_DIR, 'CNAME'), 'your-domain.com');

console.log('Files copied to deploy/ directory.\n');

// Deploy with GitHub Pages
console.log('Deploying to GitHub Pages...');
try {
  execSync(`gh api repos/{owner}/{repo}/pages -X PUT -f build_type=legacy -f source={"branch":"gh-pages","path":"/"}`, {
    stdio: 'inherit'
  });
} catch (e) {
  console.log('Note: GitHub Pages may need to be enabled in repository settings.');
}

try {
  execSync(`git subtree split --prefix=deploy -b gh-pages`, {
    cwd: ROOT,
    stdio: 'inherit'
  });
  execSync(`git push -f origin gh-pages`, {
    cwd: ROOT,
    stdio: 'inherit'
  });
  console.log('\nDeployment successful!');
  console.log('Your site will be available at: https://<username>.github.io/<repo>/');
} catch (e) {
  console.error('\nDeployment failed. Make sure you have git configured and push access.');
  console.error('Alternative: Deploy the deploy/ directory manually to GitHub Pages.');
}

// Cleanup
console.log('\nCleaning up...');
fs.rmSync(DEPLOY_DIR, { recursive: true });
console.log('Done!');
