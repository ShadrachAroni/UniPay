const fs = require('fs');
const path = require('path');

const nodeModulesDir = path.resolve(__dirname, '../node_modules');

function patchMetroPackage(pkgDir) {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const mainFile = pkg.main ? `./${pkg.main.replace(/^\.\//, '')}` : './src/index.js';

      pkg.exports = {
        ".": mainFile,
        "./package.json": "./package.json",
        "./src/*.js": "./src/*.js",
        "./src/*/*.js": "./src/*/*.js",
        "./src/*/*/*.js": "./src/*/*/*.js",
        "./src/*/*/*/*.js": "./src/*/*/*/*.js",
        "./private/*.js": "./src/*.js",
        "./private/*/*.js": "./src/*/*.js",
        "./private/*": "./src/*.js",
        "./private/*/*": "./src/*/*.js",
        "./private/*/*/*": "./src/*/*/*.js",
        "./src/*": "./src/*.js",
        "./src/*/*": "./src/*/*.js",
        "./src/*/*/*": "./src/*/*/*.js",
        "./src/*/*/*/*": "./src/*/*/*/*.js",
        "./*": "./*"
      };

      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log(`[patch_metro] Configured exports for: ${path.basename(pkgDir)}`);
    } catch (e) {
      console.error(`[patch_metro] Error patching ${pkgDir}:`, e.message);
    }
  }
}

if (fs.existsSync(nodeModulesDir)) {
  const dirs = fs.readdirSync(nodeModulesDir);
  for (const d of dirs) {
    if (d.startsWith('metro')) {
      patchMetroPackage(path.join(nodeModulesDir, d));
    }
  }
}
