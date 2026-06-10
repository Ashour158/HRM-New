import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HR_ANALYTICS_RAW_SQL_LOADERS } from './hr-analytics-reporting.service.js';
import { SERVICE_USAGE_RAW_SQL_LOADERS } from './service-usage-reporting.service.js';

type RawSqlLoaderContract = {
  name: string;
  tables: Array<{
    schema: string;
    table: string;
    columns: string[];
  }>;
};

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '..', '..', '..', '..', '..', '..');
const migrationsDir = join(repoRoot, 'infra', 'migrations');
const migrationTexts = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(join(migrationsDir, name), 'utf8'));
const allMigrations = migrationTexts.join('\n');

function hasTable(schema: string, table: string): boolean {
  return allMigrations.includes(`schema: '${schema}', name: '${table}'`)
    || allMigrations.includes(`CREATE TABLE IF NOT EXISTS ${schema}.${table}`)
    || allMigrations.includes(`CREATE TABLE ${schema}.${table}`);
}

function hasColumn(table: string, column: string): boolean {
  const createTableBlock = new RegExp(`${escapeRegExp(table)}[\\s\\S]*?\\n\\s*\\}\\);|${escapeRegExp(table)}[\\s\\S]*?\\n\\s*\\)`, 'i');
  const block = createTableBlock.exec(allMigrations)?.[0] ?? allMigrations;
  return block.includes(`${column}:`)
    || new RegExp(`\\b${escapeRegExp(column)}\\b`, 'i').test(block)
    || allMigrations.includes(`${column}:`);
}

function assertLoaderContracts(contracts: RawSqlLoaderContract[]) {
  for (const contract of contracts) {
    for (const table of contract.tables) {
      expect(hasTable(table.schema, table.table), `${contract.name} table ${table.schema}.${table.table}`).toBe(true);
      for (const column of table.columns) {
        expect(hasColumn(table.table, column), `${contract.name} column ${table.schema}.${table.table}.${column}`).toBe(true);
      }
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('reporting raw SQL schema drift coverage', () => {
  it('keeps service usage raw SQL loader contracts aligned to migration DDL', () => {
    assertLoaderContracts(SERVICE_USAGE_RAW_SQL_LOADERS);
  });

  it('keeps HR analytics raw SQL loader contracts aligned to migration DDL', () => {
    assertLoaderContracts(HR_ANALYTICS_RAW_SQL_LOADERS);
  });
});
