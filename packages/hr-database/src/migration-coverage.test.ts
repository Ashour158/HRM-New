import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface TableReference {
  schema: string;
  table: string;
  filePath: string;
}

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '..', '..', '..');
const apiSrcRoot = join(repoRoot, 'apps', 'hr-api', 'src');
const migrationsRoot = join(repoRoot, 'infra', 'migrations');

function walkFiles(root: string, predicate: (filePath: string) => boolean): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const filePath = join(root, entry);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(filePath, predicate));
    } else if (predicate(filePath)) {
      files.push(filePath);
    }
  }
  return files;
}

function scanRepositoryTableReferences(): TableReference[] {
  const repositoryFiles = walkFiles(
    apiSrcRoot,
    (filePath) =>
      filePath.endsWith('.ts') &&
      !filePath.endsWith('.test.ts') &&
      !filePath.endsWith('.spec.ts') &&
      filePath.split(/[\\/]/).includes('repositories'),
  );

  const references = new Map<string, TableReference>();
  const qualifiedCallPattern =
    /(?:selectFrom|insertInto|updateTable|deleteFrom)\(\s*['"`](hr_[a-z_]+)\.([a-z_]+)['"`]\s*\)/g;
  const schemaTablePattern = /schemaTable\(\s*['"`](hr_[a-z_]+)['"`]\s*,\s*['"`]([a-z_]+)['"`]\s*\)/g;

  for (const filePath of repositoryFiles) {
    const source = readFileSync(filePath, 'utf8');
    for (const pattern of [qualifiedCallPattern, schemaTablePattern]) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        const reference: TableReference = {
          schema: match[1],
          table: match[2],
          filePath: relative(repoRoot, filePath),
        };
        references.set(`${reference.schema}.${reference.table}`, reference);
      }
    }
  }

  return Array.from(references.values()).sort((a, b) => `${a.schema}.${a.table}`.localeCompare(`${b.schema}.${b.table}`));
}

function scanMigratedTables(): Set<string> {
  const migratedTables = new Set<string>();
  const migrationFiles = walkFiles(migrationsRoot, (filePath) => filePath.endsWith('.js'));
  const createTableObjectPattern = /createTable\(\s*\{\s*schema:\s*['"`](hr_[a-z_]+)['"`]\s*,\s*name:\s*['"`]([a-z_]+)['"`]/g;
  const rawCreateTablePattern = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+["']?(hr_[a-z_]+)["']?\.(?:"?)([a-z_]+)(?:"?)/gi;

  for (const filePath of migrationFiles) {
    const source = readFileSync(filePath, 'utf8');
    for (const pattern of [createTableObjectPattern, rawCreateTablePattern]) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        migratedTables.add(`${match[1]}.${match[2]}`);
      }
    }
  }

  return migratedTables;
}

describe('repository migration coverage', () => {
  it('has a migration-created table for every hr_* table referenced by repositories', () => {
    const references = scanRepositoryTableReferences();
    const migratedTables = scanMigratedTables();

    const missingTables = references
      .filter((reference) => !migratedTables.has(`${reference.schema}.${reference.table}`))
      .map((reference) => `${reference.schema}.${reference.table} referenced by ${reference.filePath}`)
      .sort();

    expect(
      missingTables,
      `Every hr_* repository table reference must be created by a migration. Missing:${missingTables.length > 0 ? `\n- ${missingTables.join('\n- ')}` : ''}`,
    ).toEqual([]);
  });
});
