import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// `pnpm audit` (and `npm audit` underneath it) calls the legacy
// `/-/npm/v1/security/audits` endpoint, which the npm registry retired
// (HTTP 410 "This endpoint is being retired. Use the bulk advisory endpoint
// instead."). This is not fixed by any pnpm version — confirmed against both
// the pinned 9.15.9 and the current latest (10.x) release, both still hit the
// same 410. Until pnpm ships a client for the new bulk-advisory endpoint,
// dependency vulnerability scanning here goes through osv-scanner instead,
// which queries the OSV.dev database directly and isn't affected by npm's
// audit-API retirement.
//
// The osv-scanner binary must already be on PATH (the CI workflow downloads
// a pinned release before invoking this script). Locally, install it with:
//   go install github.com/google/osv-scanner/v2/cmd/osv-scanner@v2

const FAIL_ON_SEVERITIES = new Set(['HIGH', 'CRITICAL']);
const LOCKFILE = 'pnpm-lock.yaml';

function run() {
  if (!existsSync(LOCKFILE)) {
    console.error(`dependency-audit: ${LOCKFILE} not found at repo root`);
    process.exit(1);
  }

  let raw;
  try {
    raw = execFileSync('osv-scanner', ['scan', 'source', '--lockfile', LOCKFILE, '--format', 'json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // osv-scanner exits non-zero when it finds ANY vulnerability (including
    // LOW/MODERATE ones we don't want to fail the build on), so stdout still
    // has the real JSON report even on a non-zero exit — only a genuinely
    // missing stdout means the scan itself failed to run.
    raw = error.stdout;
    if (!raw) {
      console.error('dependency-audit: osv-scanner did not produce output');
      console.error(error.stderr || error.message);
      process.exit(1);
    }
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error('dependency-audit: could not parse osv-scanner JSON output');
    console.error(raw.slice(0, 2000));
    process.exit(1);
  }

  const findings = [];
  for (const source of report.results ?? []) {
    for (const pkg of source.packages ?? []) {
      for (const vuln of pkg.vulnerabilities ?? []) {
        const severity = vuln.database_specific?.severity ?? 'UNKNOWN';
        findings.push({
          package: `${pkg.package.name}@${pkg.package.version}`,
          id: vuln.id,
          severity,
          summary: vuln.summary || vuln.details?.split('\n')[0] || '',
        });
      }
    }
  }

  const bySeverity = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`dependency-audit: ${findings.length} known advisor${findings.length === 1 ? 'y' : 'ies'} across dependencies`);
  console.log(`  by severity: ${JSON.stringify(bySeverity)}`);

  const blocking = findings.filter((f) => FAIL_ON_SEVERITIES.has(f.severity));
  if (blocking.length === 0) {
    console.log('dependency-audit: no HIGH or CRITICAL severity findings — passing.');
    return;
  }

  console.error(`dependency-audit: ${blocking.length} HIGH/CRITICAL finding(s):`);
  for (const f of blocking) {
    console.error(`  - [${f.severity}] ${f.package} — ${f.id}${f.summary ? `: ${f.summary}` : ''}`);
  }
  process.exit(1);
}

run();
