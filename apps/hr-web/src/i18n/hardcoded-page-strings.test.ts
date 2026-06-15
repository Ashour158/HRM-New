import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('i18n page content guard', () => {
  it('rejects hardcoded user-facing page strings outside the documented allowlist', () => {
    const output = execFileSync('node', ['scripts/i18n-hardcoded-strings.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toContain('No unapproved hardcoded page strings found.');
  });
});
