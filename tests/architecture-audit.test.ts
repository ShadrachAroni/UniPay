import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getFilesRecursively(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getFilesRecursively(filePath, fileList);
    } else if (filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('Architecture Audit — Provider Branching Leakage Check', () => {
  it('ensures no provider-specific logic leaks outside adapter implementations', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const allTsFiles = getFilesRecursively(srcDir);

    // Exclude adapters directory since adapter files legitimately contain adapter code
    const nonAdapterFiles = allTsFiles.filter(
      (filePath) => !filePath.includes('/adapters/') && !filePath.includes('\\adapters\\')
    );

    const prohibitedPatterns = [
      /provider\s*===\s*['"]loop['"]/i,
      /rail\s*===\s*['"]loop['"]/i,
      /switch\s*\(\s*provider\s*\)/i,
      /switch\s*\(\s*rail\s*\)/i,
      /if\s*\(\s*provider\s*===\s*['"]seeded['"]/i,
    ];

    const violations: { file: string; line: number; text: string }[] = [];

    for (const filePath of nonAdapterFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        // Ignore comments
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          return;
        }

        for (const pattern of prohibitedPatterns) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(srcDir, filePath),
              line: idx + 1,
              text: line.trim(),
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      console.error('Architecture Audit Violations:', violations);
    }

    expect(violations).toHaveLength(0);
  });
});
