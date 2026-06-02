import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const secretPattern = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g;
const excludedPathPattern = /(^|[/\\])(?:\.git|node_modules)([/\\]|$)/;

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
    secretPattern.lastIndex = 0;
    if (secretPattern.test(line)) {
      findings.push(`${file}:${index + 1}`);
    }
  });
}

if (findings.length > 0) {
  console.error('Potential OpenAI-style secrets found at:');
  findings.forEach((location) => console.error(`- ${location}`));
  console.error('Secret values are intentionally not printed.');
  process.exit(1);
}

console.log('No OpenAI-style secrets found in tracked or untracked working files.');
