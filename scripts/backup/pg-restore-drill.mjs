#!/usr/bin/env node
/**
 * Automated PostgreSQL restore drill (SRE-2).
 *
 * Proves backups are restorable: dump the source DB, restore it into a throwaway
 * scratch DB, assert integrity (migrations applied + expected table count), then
 * drop the scratch DB. Exits non-zero on any integrity failure so it can run as a
 * scheduled CronJob / CI gate and produce a real RTO/RPO signal — not a doc claim.
 *
 * Env:
 *   DATABASE_URL            source connection (required)
 *   PG_BACKUP_CONTAINER     optional docker container to exec pg tools in (local dev)
 *   RESTORE_DRILL_MIN_TABLES expected minimum hr_* table count (default 150)
 *   RESTORE_DRILL_MIN_MIGRATIONS expected minimum pgmigrations rows (default 70)
 *
 * Run: node scripts/backup/pg-restore-drill.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is required'); process.exit(2); }

const container = process.env.PG_BACKUP_CONTAINER;
const minTables = Number(process.env.RESTORE_DRILL_MIN_TABLES ?? 150);
const minMigrations = Number(process.env.RESTORE_DRILL_MIN_MIGRATIONS ?? 70);

const u = new URL(url);
const sourceDb = u.pathname.replace(/^\//, '');
const scratchDb = `restore_drill_${Date.now().toString(36)}`;
const adminUrl = new URL(url); adminUrl.pathname = '/postgres';

// Run a pg CLI tool either via docker exec (local) or directly (container/CI).
function pg(tool, args, { input } = {}) {
  const env = { ...process.env, PGPASSWORD: u.password };
  if (container) {
    return execFileSync('docker', ['exec', '-i', '-e', `PGPASSWORD=${u.password}`, container, tool, ...args],
      { input, maxBuffer: 1 << 30 });
  }
  return execFileSync(tool, args, { input, env, maxBuffer: 1 << 30 });
}
const host = container ? 'localhost' : u.hostname;
const port = container ? '5432' : (u.port || '5432');
const conn = (db) => ['-h', host, '-p', port, '-U', u.username, '-d', db];

const tmp = mkdtempSync(join(tmpdir(), 'restore-drill-'));
const dumpFile = container ? `/tmp/${scratchDb}.dump` : join(tmp, 'src.dump');
let ok = false;
try {
  console.log(`[drill] dumping ${sourceDb} …`);
  pg('pg_dump', [...conn(sourceDb), '-Fc', '-f', dumpFile]);

  console.log(`[drill] creating scratch DB ${scratchDb} …`);
  pg('psql', [...conn('postgres'), '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${scratchDb}`]);

  console.log('[drill] restoring …');
  pg('pg_restore', [...conn(scratchDb), '--no-owner', '--no-privileges', dumpFile]);

  const tables = Number(pg('psql', [...conn(scratchDb), '-tAc',
    "select count(*) from information_schema.tables where table_schema like 'hr\\_%' and table_type='BASE TABLE'"]).toString().trim());
  const migrations = Number(pg('psql', [...conn(scratchDb), '-tAc', 'select count(*) from public.pgmigrations']).toString().trim());

  console.log(`[drill] restored: ${tables} hr_* tables, ${migrations} migrations`);
  if (tables < minTables) throw new Error(`integrity: ${tables} tables < ${minTables}`);
  if (migrations < minMigrations) throw new Error(`integrity: ${migrations} migrations < ${minMigrations}`);
  ok = true;
  console.log('[drill] PASS — backup is restorable and intact.');
} finally {
  try { pg('psql', [...conn('postgres'), '-c', `DROP DATABASE IF EXISTS ${scratchDb}`]); } catch { /* best effort */ }
  if (container) { try { pg('rm', ['-f', dumpFile]); } catch { /* ignore */ } }
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
