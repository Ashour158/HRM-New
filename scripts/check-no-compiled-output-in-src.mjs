import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const scanRoots = [
  'apps/hr-api',
  'apps/hr-web',
  'apps/hr-auditor-agent',
  ...readdirSync('packages', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join('packages', entry.name)),
];

const compiledOutputPattern = /\.(?:js|js\.map|d\.ts|d\.ts\.map)$/;
const allowedHandWrittenFiles = new Set([
  'apps/hr-api/src/types/express.d.ts',
  'apps/hr-web/src/vite-env.d.ts',
  'apps/hr-web/postcss.config.js',
  'apps/hr-web/tailwind.config.js',
]);

function walk(dir, findings) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__snapshots__') continue;
      walk(fullPath, findings);
      continue;
    }

    if (!compiledOutputPattern.test(entry.name)) continue;

    const normalized = relative(process.cwd(), fullPath).replaceAll('\\', '/');
    if (allowedHandWrittenFiles.has(normalized)) continue;

    findings.push(normalized);
  }
}

const findings = [];
for (const root of scanRoots) {
  walk(root, findings);
}

if (findings.length > 0) {
  console.error('Compiled output (.js/.d.ts/.js.map/.d.ts.map) found alongside .ts source files:');
  findings.forEach((file) => console.error(`- ${file}`));
  console.error('');
  console.error('These files shadow real .ts source for tools that resolve .js before .ts');
  console.error('(e.g. Vitest\'s default test glob), and must never sit in src/. Delete them');
  console.error('and fix whatever emitted them in place instead of into dist/.');
  process.exit(1);
}

console.log('No compiled output found alongside .ts source files.');
