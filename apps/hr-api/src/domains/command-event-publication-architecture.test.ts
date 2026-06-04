import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const domainRoot = join(process.cwd(), 'src', 'domains');

function walkFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return walkFiles(fullPath);
    return fullPath.endsWith('.ts') && !fullPath.endsWith('.test.ts') && !fullPath.endsWith('.spec.ts')
      ? [fullPath]
      : [];
  });
}

describe('domain command event publication architecture', () => {
  it('keeps command-side domain events on CommandResult/outbox instead of direct EventBus publication', () => {
    const offenders = walkFiles(domainRoot)
      .filter((file) => file.includes(`${join('commands')}${'\\'}`) || file.includes(`${join('events')}${'\\'}`))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return /eventBus\s*\.\s*publish(?:All)?\s*\(/.test(source);
      })
      .map((file) => relative(process.cwd(), file).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });
});
