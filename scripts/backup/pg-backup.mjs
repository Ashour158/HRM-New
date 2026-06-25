#!/usr/bin/env node
/**
 * Scheduled PostgreSQL base backup (SRE-1).
 *
 * Takes a compressed `pg_dump -Fc` of the source DB into BACKUP_DIR with a
 * timestamped name, then prunes backups older than the retention window. Intended
 * to run as a Kubernetes CronJob (postgres image) or locally. This is the base-backup
 * leg; continuous PITR additionally requires WAL archiving configured at the
 * Postgres/managed-service layer (see docs/disaster-recovery.md).
 *
 * Env:
 *   DATABASE_URL          source connection (required)
 *   BACKUP_DIR            output directory (default ./backups)
 *   BACKUP_RETENTION_DAYS prune older than N days (default 14)
 *   PG_BACKUP_CONTAINER   optional docker container to exec pg_dump in (local dev)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is required'); process.exit(2); }
const backupDir = process.env.BACKUP_DIR ?? join(process.cwd(), 'backups');
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 14);
const container = process.env.PG_BACKUP_CONTAINER;

const u = new URL(url);
const db = u.pathname.replace(/^\//, '');
const host = container ? 'localhost' : u.hostname;
const port = container ? '5432' : (u.port || '5432');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outName = `${db}_${stamp}.dump`;

mkdirSync(backupDir, { recursive: true });
const conn = ['-h', host, '-p', port, '-U', u.username, '-d', db, '-Fc'];

console.log(`[backup] pg_dump ${db} → ${outName}`);
if (container) {
  // Dump inside the container then copy out, so the artifact lands in BACKUP_DIR.
  const inside = `/tmp/${outName}`;
  execFileSync('docker', ['exec', '-e', `PGPASSWORD=${u.password}`, container, 'pg_dump', ...conn, '-f', inside], { stdio: 'inherit' });
  execFileSync('docker', ['cp', `${container}:${inside}`, join(backupDir, outName)], { stdio: 'inherit' });
  execFileSync('docker', ['exec', container, 'rm', '-f', inside]);
} else {
  execFileSync('pg_dump', [...conn, '-f', join(backupDir, outName)], { env: { ...process.env, PGPASSWORD: u.password }, stdio: 'inherit' });
}

// Prune old backups.
const cutoff = Date.now() - retentionDays * 86_400_000;
let pruned = 0;
for (const f of readdirSync(backupDir)) {
  if (!f.endsWith('.dump')) continue;
  const p = join(backupDir, f);
  if (statSync(p).mtimeMs < cutoff) { unlinkSync(p); pruned++; }
}
console.log(`[backup] done. pruned ${pruned} backup(s) older than ${retentionDays}d.`);
