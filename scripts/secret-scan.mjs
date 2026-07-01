import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const secretPatterns = [
  { name: 'OpenAI-style API key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: 'AWS access key id', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'GitHub token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: 'Private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: 'Database URL with embedded credentials', pattern: /\b(?:postgres|postgresql|mysql|mssql):\/\/[^:\s/@]+:[^@\s]+@[^ \n\r]+/gi },
  { name: 'JWT-like bearer token', pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g },
  {
    name: 'Plaintext secret assignment',
    pattern: /\b(?:JWT_SECRET|SESSION_SECRET|ENCRYPTION_KEY|DATABASE_PASSWORD|POSTGRES_PASSWORD|REDIS_PASSWORD|CLIENT_SECRET)\s*[:=]\s*['"]?(?!replace-me|changeme|your-|test|dummy|example|set |undefined|null)[A-Za-z0-9+/_=.-]{16,}/gi,
  },
];
const excludedPathPattern = /(^|[/\\])(?:\.git|node_modules)([/\\]|$)/;
const allowedExamplePathPattern = /(^|[/\\])(?:\.env\.example|secret\.example\.yaml|infra[/\\]docker-compose\.yml)$/;
const allowedTestSecretPattern = /(?:change-me-in-production|dev-secret-change-me|production-secret-with-enough-entropy|test-secret|dummy-secret|example-secret)/i;
// CI job env blocks use a `<name>_ci_password` convention for ephemeral, service-container-only
// Postgres credentials (e.g. hcm_ci_password, rls_ci_password). Any such suffix is allowed here;
// a real-looking secret without this naming convention is still flagged.
const ciFixturePasswordPattern = /:[a-z0-9_]+_ci_password@/i;

function isAllowedFinding(file, line, findingName) {
  const normalized = file.replaceAll('\\', '/');
  if (allowedExamplePathPattern.test(file) || allowedExamplePathPattern.test(normalized)) {
    return true;
  }
  if (
    findingName === 'Database URL with embedded credentials'
    && normalized.startsWith('.github/workflows/')
    && ciFixturePasswordPattern.test(line)
  ) {
    return true;
  }
  if (
    findingName === 'Database URL with embedded credentials'
    && normalized === 'deploy/docker-compose.production.yml'
    && line.includes('${POSTGRES_PASSWORD}')
  ) {
    return true;
  }
  // Unit-test fixtures that only exercise env-var parsing / pool-key derivation logic (never a
  // real network connection — the DB client is either mocked or the connection is never opened
  // in the test). Narrowed to localhost AND a short (<=8 char), plain-alphanumeric password —
  // real leaked credentials are essentially never this short/low-entropy, so this can't be used
  // to smuggle a real secret past the scanner just by pointing it at localhost.
  if (
    findingName === 'Database URL with embedded credentials'
    && /\.(?:spec|test)\.ts$/.test(normalized)
    && /:[A-Za-z0-9]{1,8}@localhost(?::\d+)?\//i.test(line)
  ) {
    return true;
  }
  if (
    findingName === 'Plaintext secret assignment'
    && /\.(?:spec|test)\.ts$/.test(normalized)
    && allowedTestSecretPattern.test(line)
  ) {
    return true;
  }
  // CI workflow files use GitHub Actions ${{ secrets.* }} for real secrets;
  // any plaintext assignment must additionally look CI-scoped/ephemeral to be
  // allowed, so a real-looking secret committed here is still flagged.
  if (
    findingName === 'Plaintext secret assignment'
    && normalized.startsWith('.github/workflows/')
    && /\bci[-_]|ephemeral|runtime-lifecycle|fake[-_]?secret/i.test(line)
  ) {
    return true;
  }
  // Mock PEM placeholders in test fixtures are not real keys.
  if (
    findingName === 'Private key block'
    && /\.(?:spec|test)\.ts$/.test(normalized)
    && /mock|placeholder|example|dummy/i.test(line)
  ) {
    return true;
  }
  return false;
}

function gitFiles(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

const files = [...new Set([
  ...gitFiles(['ls-files']),
  ...gitFiles(['ls-files', '--others', '--exclude-standard']),
])].filter((file) => !excludedPathPattern.test(file));

const findings = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (content.includes('\0')) continue;

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { name, pattern } of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        if (isAllowedFinding(file, line, name)) continue;
        findings.push(`${file}:${index + 1} (${name})`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error('Potential secrets found at:');
  findings.forEach((location) => console.error(`- ${location}`));
  console.error('Secret values are intentionally not printed.');
  process.exit(1);
}

console.log('No supported secret patterns found in tracked or untracked working files.');
