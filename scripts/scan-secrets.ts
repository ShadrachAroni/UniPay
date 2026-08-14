import fs from 'fs';
import path from 'path';

const SUSPICIOUS_PATTERNS = [
  /hyqd7bwMr9Kv/, // Specifically guard against the known leaked test secret
  /sk_live_[0-9a-zA-Z]{24,}/,
];

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.expo',
  'docs',
  '.agents',
]);

const IGNORE_FILES = new Set([
  '.env',
  '.env.example',
  'package-lock.json',
  'scan-secrets.ts',
  'scan-secrets.js',
]);

function scanDirectory(dir: string, issues: Array<{ file: string; line: number; match: string }>) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        scanDirectory(fullPath, issues);
      }
    } else if (entry.isFile()) {
      if (IGNORE_FILES.has(entry.name)) continue;
      if (!/\.(ts|tsx|js|jsx|json|md|sql)$/.test(entry.name)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(line)) {
              issues.push({
                file: fullPath,
                line: index + 1,
                match: line.trim().slice(0, 100),
              });
            }
          }
        });
      } catch (err) {
        // Skip unreadable files
      }
    }
  }
}

export function runSecretScan(): { clean: boolean; issues: Array<{ file: string; line: number; match: string }> } {
  const rootDir = process.cwd();
  const issues: Array<{ file: string; line: number; match: string }> = [];

  scanDirectory(rootDir, issues);

  return {
    clean: issues.length === 0,
    issues,
  };
}

if (process.argv[1]?.includes('scan-secrets')) {
  const result = runSecretScan();
  if (!result.clean) {
    console.error('❌ Potential secrets detected in codebase:');
    result.issues.forEach((issue) => {
      console.error(`  - ${issue.file}:${issue.line} -> ${issue.match}`);
    });
    process.exit(1);
  } else {
    console.log('✅ Secret scan passed: No hardcoded credentials detected.');
    process.exit(0);
  }
}
