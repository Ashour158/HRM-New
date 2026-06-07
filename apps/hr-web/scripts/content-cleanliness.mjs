import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const scanRoots = ['pages', 'layouts', 'components']
  .map((segment) => join(srcRoot, segment))
  .filter((dir) => existsSync(dir) && statSync(dir).isDirectory());
const extensions = new Set(['.ts', '.tsx']);
const forbiddenVisibleCopy = [
  /Payroll engine live/i,
  /gross-to-net engine/i,
  /deduction policies/i,
  /HTML artifacts/i,
  /runtime keys/i,
  /runtime evidence/i,
  /command enforcement/i,
  /backend-required/i,
  /API\s+Ready/i,
  /observed directly/i,
  /endpoint required/i,
  /PolicyValidationEngine/i,
  /PolicyImpactSimulationEngine/i,
  /PolicyApplicationEngine/i,
];

const allowedPaths = [
  'pages/admin/audit-console.tsx',
  'pages/admin/dead-letter-events.tsx',
  'pages/admin/event-contracts.tsx',
];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return [path];
  });
}

const offenders = [];

for (const file of scanRoots.flatMap((dir) => walk(dir))) {
  const normalized = relative(srcRoot, file).replaceAll('\\', '/');
  const extension = normalized.slice(normalized.lastIndexOf('.'));
  if (!extensions.has(extension) || allowedPaths.includes(normalized)) continue;

  const source = readFileSync(file, 'utf8');
  forbiddenVisibleCopy.forEach((pattern) => {
    if (pattern.test(source)) {
      offenders.push(`${normalized}: ${pattern}`);
    }
  });
}

if (offenders.length > 0) {
  console.error('Visible implementation copy found in normal product screens:');
  offenders.forEach((offender) => console.error(`- ${offender}`));
  process.exit(1);
}

console.log('UI content cleanliness check passed.');
