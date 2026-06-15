import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile workspace decision', () => {
  it('does not include the removed empty mobile app in workspace package globs', () => {
    const repoRoot = resolve(process.cwd(), '../..');
    const workspace = readFileSync(resolve(repoRoot, 'pnpm-workspace.yaml'), 'utf8');

    expect(existsSync(resolve(repoRoot, 'apps/hr-mobile'))).toBe(false);
    expect(workspace).not.toMatch(/-\s*["']?apps\/\*["']?/);
    expect(workspace).not.toMatch(/apps\/hr-mobile/);
  });
});
