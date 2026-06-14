import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const priorityDomains = [
  'compensation',
  'employee-relations',
  'global-hr',
  'payroll',
  'performance',
  'wellbeing-eap',
];

const domainRoot = join(process.cwd(), 'src', 'domains');

function walkFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return walkFiles(fullPath);
    return fullPath.endsWith('.aggregate.ts') ? [fullPath] : [];
  });
}

describe('HR data classification annotations', () => {
  it('documents sensitive aggregate data in priority HR domains', () => {
    const missing = priorityDomains
      .flatMap((domain) => walkFiles(join(domainRoot, domain, 'aggregates')))
      .filter((file) => !readFileSync(file, 'utf8').includes('@hrDataClassification'))
      .map((file) => relative(process.cwd(), file).replace(/\\/g, '/'));

    expect(missing).toEqual([]);
  });
});
