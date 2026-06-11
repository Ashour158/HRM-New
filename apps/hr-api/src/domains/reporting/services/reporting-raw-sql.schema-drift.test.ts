import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HR_ANALYTICS_RAW_SQL_LOADERS } from './hr-analytics-reporting.service.js';
import { SERVICE_USAGE_RAW_SQL_LOADERS } from './service-usage-reporting.service.js';
import { SEMANTIC_REPORT_RAW_SQL_LOADERS } from './report-semantic-row-provider.service.js';

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
const REPORTING_REPOSITORY_TABLES: RawSqlLoaderContract[] = [{
  name: 'reporting repositories',
  tables: [
    {
      schema: 'hr_reporting',
      table: 'report_definitions',
      columns: ['id', 'tenant_id', 'report_name', 'report_type', 'data_source', 'query_definition', 'parameters', 'schedule', 'status', 'aggregate_version', 'created_at', 'updated_at'],
    },
    {
      schema: 'hr_reporting',
      table: 'report_executions',
      columns: ['id', 'tenant_id', 'report_definition_id', 'executed_by', 'parameters', 'result_url', 'row_count', 'started_at', 'completed_at', 'status', 'aggregate_version', 'created_at', 'updated_at'],
    },
    {
      schema: 'hr_reporting',
      table: 'report_schedules',
      columns: ['id', 'tenant_id', 'report_definition_id', 'frequency', 'recipients', 'next_run_at', 'last_run_at', 'status', 'aggregate_version', 'created_at', 'updated_at'],
    },
    {
      schema: 'hr_reporting',
      table: 'calculated_fields',
      columns: ['id', 'tenant_id', 'field_name', 'expression', 'data_type', 'source_fields', 'status', 'aggregate_version', 'created_at', 'updated_at'],
    },
  ],
}];

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

  it('keeps semantic report raw SQL loader contracts aligned to migration DDL', () => {
    assertLoaderContracts(SEMANTIC_REPORT_RAW_SQL_LOADERS);
  });

  it('keeps reporting repository tables aligned to migration DDL', () => {
    assertLoaderContracts(REPORTING_REPOSITORY_TABLES);
  });
});
