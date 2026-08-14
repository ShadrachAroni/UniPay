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

function patchFinalHandler() {
  const finalHandlerPath = path.join(nodeModulesDir, 'finalhandler', 'index.js');
  if (fs.existsSync(finalHandlerPath)) {
    try {
      let content = fs.readFileSync(finalHandlerPath, 'utf8');
      if (content.includes('res.statusMessage = statuses.message[status]')) {
        content = content.replace(
          'res.statusMessage = statuses.message[status]',
          'res.statusMessage = (statuses.message && statuses.message[status]) || (typeof statuses === \'function\' ? statuses(status) : null) || statuses[status] || \'Error\''
        );
        fs.writeFileSync(finalHandlerPath, content, 'utf8');
        console.log('[patch_metro] Patched finalhandler index.js for statusMessage compatibility');
      }
    } catch (e) {
      console.error('[patch_metro] Error patching finalhandler:', e.message);
    }
  }

  const nestedStatusesPath = path.join(nodeModulesDir, 'finalhandler', 'node_modules', 'statuses', 'index.js');
  if (fs.existsSync(nestedStatusesPath)) {
    try {
      let content = fs.readFileSync(nestedStatusesPath, 'utf8');
      if (!content.includes('status.message = codes')) {
        content = content.replace('status.STATUS_CODES = codes', 'status.STATUS_CODES = codes\nstatus.message = codes');
        fs.writeFileSync(nestedStatusesPath, content, 'utf8');
        console.log('[patch_metro] Patched nested statuses for finalhandler');
      }
    } catch (e) {
      console.error('[patch_metro] Error patching nested statuses:', e.message);
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
  patchFinalHandler();
}
