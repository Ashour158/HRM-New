import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Regression test for the `no-cross-domain-controller-imports` dependency-cruiser
 * rule declared in `.dependency-cruiser.cjs` and enforced by the `lint:boundaries`
 * script.
 *
 * This does NOT re-implement the rule. It shells out to the real `depcruise`
 * binary with the project's actual config file, the same way
 * `pnpm run lint:boundaries` does in CI, against deliberately-crafted fixture
 * files written under `src/domains/` for the duration of each test (and
 * removed again in `afterEach`, regardless of pass/fail).
 *
 * It exists to prove the rule is not a no-op:
 *   - a genuine cross-domain controller -> repository import must be flagged
 *     as an error and must fail the process (matching what CI relies on), and
 *   - a same-domain import must be left untouched, so this test would also
 *     catch an accidental *over*-broadening of the rule (e.g. dropping the
 *     `pathNot` same-domain exclusion) as well as an accidental loosening
 *     (narrowed `to.path`, dropped `forbidden` entry, etc.).
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const hrApiRoot = join(testDir, '..');
const configFile = '.dependency-cruiser.cjs';

const violationFixtureDir = join(
  hrApiRoot,
  'src/domains/__depcruise_regression_fixture_violation__',
);
const ownerFixtureDir = join(hrApiRoot, 'src/domains/__depcruise_regression_fixture_owner__');

function resolveDepcruiseBinPath(): string {
  const packageDir = realpathSync(join(hrApiRoot, 'node_modules', 'dependency-cruiser'));
  const packageJson = JSON.parse(
    readFileSync(join(packageDir, 'package.json'), 'utf8'),
  ) as { bin?: Record<string, string> };
  const relBinPath = packageJson.bin?.depcruise;
  if (!relBinPath) {
    throw new Error('dependency-cruiser package.json does not declare a "depcruise" bin entry');
  }
  return join(packageDir, relBinPath);
}

function runDepcruise(targets: string[]): { status: number; output: string } {
  const binPath = resolveDepcruiseBinPath();
  try {
    const output = execFileSync(
      process.execPath,
      [binPath, '--config', configFile, '--include-only', '^src/domains', ...targets],
      { cwd: hrApiRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { status: 0, output };
  } catch (error) {
    const execError = error as { status?: number | null; stdout?: string; stderr?: string };
    return {
      status: execError.status ?? 1,
      output: `${execError.stdout ?? ''}${execError.stderr ?? ''}`,
    };
  }
}

function removeFixtures(): void {
  for (const dir of [violationFixtureDir, ownerFixtureDir]) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

describe('dependency-cruiser domain-boundary rule (regression)', () => {
  beforeEach(() => {
    removeFixtures();
  });

  afterEach(() => {
    removeFixtures();
  });

  it('flags a genuine cross-domain controller -> repository import as an error', () => {
    mkdirSync(join(violationFixtureDir, 'api'), { recursive: true });
    mkdirSync(join(ownerFixtureDir, 'repositories'), { recursive: true });

    writeFileSync(
      join(ownerFixtureDir, 'repositories', 'fixture-target.repository.ts'),
      "export class FixtureTargetRepository {\n  find(): string {\n    return 'fixture';\n  }\n}\n",
    );
    writeFileSync(
      join(violationFixtureDir, 'api', 'fixture.controller.ts'),
      "import { FixtureTargetRepository } from '../../__depcruise_regression_fixture_owner__/repositories/fixture-target.repository';\n\n" +
        'export class FixtureController {\n' +
        '  constructor(private readonly repo: FixtureTargetRepository) {}\n' +
        '}\n',
    );

    const result = runDepcruise([
      'src/domains/__depcruise_regression_fixture_violation__',
      'src/domains/__depcruise_regression_fixture_owner__',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('no-cross-domain-controller-imports');
    expect(result.output).toContain(
      'src/domains/__depcruise_regression_fixture_violation__/api/fixture.controller.ts',
    );
  });

  it('does not flag a same-domain import (control case, guards against an always-red rule)', () => {
    mkdirSync(join(violationFixtureDir, 'api'), { recursive: true });
    mkdirSync(join(violationFixtureDir, 'repositories'), { recursive: true });

    writeFileSync(
      join(violationFixtureDir, 'repositories', 'own.repository.ts'),
      "export class OwnRepository {\n  find(): string {\n    return 'own';\n  }\n}\n",
    );
    writeFileSync(
      join(violationFixtureDir, 'api', 'fixture-compliant.controller.ts'),
      "import { OwnRepository } from '../repositories/own.repository';\n\n" +
        'export class FixtureCompliantController {\n' +
        '  constructor(private readonly repo: OwnRepository) {}\n' +
        '}\n',
    );

    const result = runDepcruise(['src/domains/__depcruise_regression_fixture_violation__']);

    expect(result.status).toBe(0);
    expect(result.output).not.toContain('no-cross-domain-controller-imports');
  });
});
