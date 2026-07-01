import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

interface MigrationLedgerDriftModule {
  findMissingMigrationLedgerNames(fileNames: string[], ledgerNames: string[]): string[];
}

async function loadScriptModule(): Promise<MigrationLedgerDriftModule> {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..', '..', '..');
  const scriptPath = join(repoRoot, 'scripts', 'check-migration-ledger-drift.mjs');
  return import(pathToFileURL(scriptPath).href) as Promise<MigrationLedgerDriftModule>;
}

describe('migration ledger drift comparison', () => {
  it('returns an empty list when every migration file has a ledger row', async () => {
    const { findMissingMigrationLedgerNames } = await loadScriptModule();

    expect(
      findMissingMigrationLedgerNames(
        ['20260601000000000_alpha', '20260602000000000_beta'],
        ['20260602000000000_beta', '20260601000000000_alpha'],
      ),
    ).toEqual([]);
  });

  it('returns sorted migration names that exist on disk but not in pgmigrations', async () => {
    const { findMissingMigrationLedgerNames } = await loadScriptModule();

    expect(
      findMissingMigrationLedgerNames(
        [
          '20260603000000000_gamma',
          '20260601000000000_alpha',
          '20260602000000000_beta',
          '20260601000000000_alpha',
        ],
        ['20260602000000000_beta', '20260531000000000_older_extra_row'],
      ),
    ).toEqual(['20260601000000000_alpha', '20260603000000000_gamma']);
  });
});
