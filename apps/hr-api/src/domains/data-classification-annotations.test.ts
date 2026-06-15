import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const domainRoot = join(process.cwd(), 'src', 'domains');
const sensitiveFieldPattern =
  /\b(salary|amount|netPay|grossPay|pay|tax|insurance|bank|iban|routing|accountNumber|bonus|equity|compensation|rate|disciplinary|investigation|grievance|medical|mental|clinical|health|wellbeing|accommodation|disability|diversity|ethnicity|race|religion|union|visa|passport|permit|immigration|rating|calibration|succession)\b/i;
const declarationPattern = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??:\s*[^;]+;.*$/;

function walkFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return walkFiles(fullPath);
    return fullPath.endsWith('.aggregate.ts') ? [fullPath] : [];
  });
}

describe('HR data classification annotations', () => {
  it('documents sensitive aggregate fields with field-level classification annotations', () => {
    const missing = walkFiles(domainRoot)
      .flatMap((file) => missingAnnotationsForFile(file))
      .sort();

    expect(missing).toEqual([]);
  });
});

function missingAnnotationsForFile(file: string): string[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const missing: string[] = [];

  lines.forEach((line, index) => {
    const match = declarationPattern.exec(line);
    if (!match || !sensitiveFieldPattern.test(match[1])) return;

    const annotationWindow = lines
      .slice(Math.max(0, index - 4), index + 1)
      .join('\n');
    if (!annotationWindow.includes('@hrDataClassification')) {
      const path = relative(process.cwd(), file).replace(/\\/g, '/');
      missing.push(`${path}:${index + 1} ${match[1]}`);
    }
  });

  return missing;
}
