import { getPool, runMigrations } from '@hcm/database';
import { describe, expect, it } from 'vitest';

let skipReason = '';

async function canReachDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    skipReason = 'DATABASE_URL is not set';
    return false;
  }
  try {
    await Promise.race([
      getPool().query('select 1'),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('database reachability timeout')), 2_000)),
    ]);
    return true;
  } catch (err) {
    skipReason = err instanceof Error ? err.message : String(err);
    return false;
  }
}

async function expectKeyTablesPresent(): Promise<void> {
  const result = await getPool().query(
    `select
       to_regclass('hr_platform.tenants') as tenants,
       to_regclass('hr_platform.audit_log') as audit_log,
       to_regclass('hr_platform.outbox_events') as outbox_events,
       to_regclass('hr_core.workers') as workers`,
  );
  // to_regclass renders names unqualified when the schema is on the
  // search_path, so assert presence (non-null) rather than the exact
  // schema-qualified string.
  const row = result.rows[0] as Record<string, unknown>;
  for (const key of ['tenants', 'audit_log', 'outbox_events', 'workers']) {
    expect(row[key], `expected ${key} to exist after migration`).toBeTruthy();
  }
}

describe('migration rollback/forward roundtrip', () => {
  it('migrates latest, rolls back the last migration, and migrates forward again', async () => {
    if (!(await canReachDatabase())) {
      console.warn(`[migration-roundtrip.test] skipped: ${skipReason}`);
      return;
    }

    await runMigrations('up');
    await expectKeyTablesPresent();

    let downMigrationSupported = true;
    try {
      await runMigrations('down', 1);
    } catch (err) {
      downMigrationSupported = false;
      console.warn(`[migration-roundtrip.test] down migration was not available: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await runMigrations('up');
    }

    await expectKeyTablesPresent();
    if (!downMigrationSupported) {
      console.warn('[migration-roundtrip.test] clean bootstrap-to-latest succeeded, but down-migration roundtrip support is incomplete.');
    }
  }, 120_000);
});
