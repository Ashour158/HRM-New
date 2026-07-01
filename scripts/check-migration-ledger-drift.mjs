#!/usr/bin/env node

import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const migrationsDir = join(repoRoot, 'infra', 'migrations');
const requireFromDatabasePackage = createRequire(join(repoRoot, 'packages', 'hr-database', 'package.json'));

export function findMissingMigrationLedgerNames(fileNames, ledgerNames) {
  const ledger = new Set(ledgerNames);
  return [...new Set(fileNames)]
    .filter((name) => !ledger.has(name))
    .sort((a, b) => a.localeCompare(b));
}

async function readMigrationFileNames() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name.slice(0, -'.js'.length))
    .sort((a, b) => a.localeCompare(b));
}

async function readLedgerMigrationNames(databaseUrl) {
  const { Pool } = requireFromDatabasePackage('pg');
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? 5000),
    application_name: process.env.DB_APPLICATION_NAME ?? 'hcm-migration-ledger-drift-check',
  });

  try {
    const result = await pool.query('select name from pgmigrations');
    return result.rows.map((row) => String(row.name));
  } finally {
    await pool.end();
  }
}

function printHelp() {
  console.log(`Usage: node scripts/check-migration-ledger-drift.mjs

Compares migration files under infra/migrations/*.js with rows in public.pgmigrations.

Environment:
  DATABASE_URL  PostgreSQL connection string used to read pgmigrations.

Exit codes:
  0  Migration files and pgmigrations ledger are in sync.
  1  One or more migration files have no pgmigrations row.
  2  Configuration or database read failed.

This script only reports ledger drift. It does not backfill pgmigrations or inspect
whether a migration's schema changes have already been applied out of band.`);
}

function isHelpRequest(argv) {
  return argv.includes('--help') || argv.includes('-h');
}

function isMainModule() {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}

async function main() {
  if (isHelpRequest(process.argv.slice(2))) {
    printHelp();
    return 0;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required to check migration ledger drift.');
    console.error('Run with --help for usage.');
    return 2;
  }

  try {
    const [fileNames, ledgerNames] = await Promise.all([
      readMigrationFileNames(),
      readLedgerMigrationNames(databaseUrl),
    ]);
    const missingLedgerRows = findMissingMigrationLedgerNames(fileNames, ledgerNames);

    if (missingLedgerRows.length === 0) {
      console.log(`Migration ledger is in sync: ${fileNames.length} migration files all have pgmigrations rows.`);
      return 0;
    }

    console.error('Migration ledger drift detected. These migration files have no pgmigrations row:');
    for (const name of missingLedgerRows) {
      console.error(`- ${name}`);
    }
    console.error(
      'The schema may already be applied out-of-band, or this migration may never have run. Investigate before running db:migrate blindly.',
    );
    return 1;
  } catch (err) {
    console.error(`Could not check migration ledger drift: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

if (isMainModule()) {
  process.exitCode = await main();
}
