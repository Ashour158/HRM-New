// Regression test for scripts/verify-tsc-output.mjs.
//
// Context: turbo.json's build task previously did not include
// "*.tsbuildinfo" in its cached `outputs`, and every composite:true package
// in this workspace builds via plain `tsc`, which relies on that file for
// incremental state. TypeScript's incremental engine only checks recorded
// source-file signatures in tsconfig.tsbuildinfo -- it never verifies the
// output files it previously emitted are still on disk. If dist/ output is
// ever partially deleted (interrupted build, AV quarantine, a corrupted
// cache restore) while tsconfig.tsbuildinfo is left untouched, `tsc` exits 0
// without regenerating the missing files, and Turborepo then caches that
// truncated dist/ as a "successful" build.
//
// verify-tsc-output.mjs is a defense-in-depth guard that runs after `tsc`
// (or `nest build`) and fails loudly if any expected output file is
// missing, rather than letting a truncated build report success silently.
// This test exercises verify()'s decision logic directly (no child process,
// no real tsc invocation) against small synthetic package fixtures.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, afterEach, describe, test } from 'node:test';

import { verify } from './verify-tsc-output.mjs';

let tmpRoot;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'verify-tsc-output-test-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function writeTsconfig(dir, compilerOptions = {}, extra = {}) {
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          rootDir: './src',
          outDir: './dist',
          declaration: true,
          ...compilerOptions,
        },
        include: ['src/**/*'],
        exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        ...extra,
      },
      null,
      2,
    ),
  );
}

function writeSrc(dir, relPath, contents = '// fixture source\n') {
  const full = join(dir, 'src', relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, contents);
}

function writeDist(dir, relPath, contents = '// fixture output\n') {
  const full = join(dir, 'dist', relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, contents);
}

describe('verify-tsc-output verify()', () => {
  test('reports ok when every source file has matching .js and .d.ts output', () => {
    writeTsconfig(tmpRoot);
    writeSrc(tmpRoot, 'index.ts');
    writeSrc(tmpRoot, 'nested/util.ts');
    writeDist(tmpRoot, 'index.js');
    writeDist(tmpRoot, 'index.d.ts');
    writeDist(tmpRoot, 'nested/util.js');
    writeDist(tmpRoot, 'nested/util.d.ts');

    const result = verify(tmpRoot);

    assert.equal(result.status, 'ok');
    assert.equal(result.sourceCount, 2);
  });

  test('reports missing when a dist file was deleted but tsconfig.tsbuildinfo is untouched', () => {
    // This is the exact truncation scenario: a complete build exists, then
    // an output file disappears without tsc's incremental state changing.
    writeTsconfig(tmpRoot);
    writeSrc(tmpRoot, 'index.ts');
    writeSrc(tmpRoot, 'nested/util.ts');
    writeDist(tmpRoot, 'index.js');
    writeDist(tmpRoot, 'index.d.ts');
    // nested/util.js and nested/util.d.ts are intentionally never written --
    // simulates files deleted from an otherwise-complete dist/.

    const result = verify(tmpRoot);

    assert.equal(result.status, 'missing');
    assert.equal(result.sourceCount, 2);
    assert.deepEqual(
      result.missing.sort(),
      ['dist/nested/util.d.ts', 'dist/nested/util.js'].sort(),
    );
  });

  test('does not require .d.ts output when declaration emission is disabled', () => {
    writeTsconfig(tmpRoot, { declaration: false });
    writeSrc(tmpRoot, 'index.ts');
    writeDist(tmpRoot, 'index.js');
    // No index.d.ts written -- should not be flagged since declaration:false.

    const result = verify(tmpRoot);

    assert.equal(result.status, 'ok');
  });

  test('skips verification entirely for noEmit projects', () => {
    // Mirrors apps/hr-web's tsconfig.json, which runs `tsc` purely as a
    // typecheck gate before a separate bundler (Vite) build -- there is no
    // dist/ output from tsc itself, so nothing should be verified.
    writeTsconfig(tmpRoot, { noEmit: true });
    writeSrc(tmpRoot, 'index.ts');
    // No dist/ directory at all.

    const result = verify(tmpRoot);

    assert.equal(result.status, 'skipped');
    assert.match(result.reason, /noEmit/);
  });

  test('excludes *.test.ts and *.spec.ts source files from the output contract', () => {
    writeTsconfig(tmpRoot);
    writeSrc(tmpRoot, 'index.ts');
    writeSrc(tmpRoot, 'index.test.ts');
    writeSrc(tmpRoot, 'index.spec.ts');
    writeDist(tmpRoot, 'index.js');
    writeDist(tmpRoot, 'index.d.ts');
    // No compiled output for the test/spec files -- should not be flagged.

    const result = verify(tmpRoot);

    assert.equal(result.status, 'ok');
    assert.equal(result.sourceCount, 1);
  });

  test('honors additional tsconfig "exclude" glob patterns', () => {
    writeTsconfig(tmpRoot, {}, { exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/generated/**'] });
    writeSrc(tmpRoot, 'index.ts');
    writeSrc(tmpRoot, 'generated/schema.ts');
    writeDist(tmpRoot, 'index.js');
    writeDist(tmpRoot, 'index.d.ts');
    // No compiled output for generated/schema.ts -- excluded, should not be flagged.

    const result = verify(tmpRoot);

    assert.equal(result.status, 'ok');
    assert.equal(result.sourceCount, 1);
  });

  test('resolves a one-level tsconfig "extends" chain, matching this repo\'s per-package configs', () => {
    // Every real package's tsconfig.json extends the repo-root tsconfig.json
    // for shared compilerOptions (composite, declaration, strict, etc.) and
    // only sets rootDir/outDir locally -- mirror that shape here.
    writeFileSync(
      join(tmpRoot, 'base.tsconfig.json'),
      JSON.stringify({ compilerOptions: { declaration: true, composite: true } }, null, 2),
    );
    writeTsconfig(
      tmpRoot,
      { declaration: undefined },
      { extends: './base.tsconfig.json' },
    );
    // Remove the redundant declaration:true this test added via writeTsconfig's
    // defaults so the inherited value from "extends" is what's actually exercised.
    writeFileSync(
      join(tmpRoot, 'tsconfig.json'),
      JSON.stringify(
        {
          extends: './base.tsconfig.json',
          compilerOptions: { rootDir: './src', outDir: './dist' },
          include: ['src/**/*'],
          exclude: ['src/**/*.test.ts'],
        },
        null,
        2,
      ),
    );
    writeSrc(tmpRoot, 'index.ts');
    writeDist(tmpRoot, 'index.js');
    // Deliberately omit dist/index.d.ts to prove "declaration" was inherited
    // from the extended base config, not defaulted away.

    const result = verify(tmpRoot);

    assert.equal(result.status, 'missing');
    assert.deepEqual(result.missing, ['dist/index.d.ts']);
  });

  test('reports an error when tsconfig.json is missing', () => {
    // No tsconfig.json written at all.
    const result = verify(tmpRoot);

    assert.equal(result.status, 'error');
    assert.match(result.reason, /no tsconfig\.json found/);
  });

  test('reports skipped when there are no compilable source files', () => {
    writeTsconfig(tmpRoot);
    mkdirSync(join(tmpRoot, 'src'), { recursive: true });
    // src/ exists but is empty.

    const result = verify(tmpRoot);

    assert.equal(result.status, 'skipped');
    assert.match(result.reason, /no compilable source files/);
  });
});
