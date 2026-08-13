/**
 * fix-metro.js
 * Patches metro-config/src/loadConfig.js to fix ERR_UNSUPPORTED_ESM_URL_SCHEME
 * on Windows when using Node.js 22+ with Expo.
 * No external dependencies needed.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'metro-config', 'src', 'loadConfig.js');

if (!fs.existsSync(filePath)) {
  console.log('[fix-metro] metro-config not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

const OLD = `        const configModule = await import(absolutePath);`;
const NEW = `        const { pathToFileURL } = require('url');
        const pathToImport = path.isAbsolute(absolutePath) && process.platform === 'win32'
          ? pathToFileURL(absolutePath).href
          : absolutePath;
        const configModule = await import(pathToImport);`;

if (content.includes(NEW)) {
  console.log('[fix-metro] Patch already applied, skipping.');
  process.exit(0);
}

if (!content.includes(OLD)) {
  console.log('[fix-metro] Target line not found, metro-config may have changed. Skipping patch.');
  process.exit(0);
}

content = content.replace(OLD, NEW);
fs.writeFileSync(filePath, content, 'utf8');
console.log('[fix-metro] metro-config patched successfully for Windows ESM URL compatibility.');
