import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const pagesRoot = join(root, 'src', 'pages');
const allowlistPath = join(root, 'scripts', 'i18n-hardcoded-strings.allowlist.json');
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));

const ignoredFiles = new Set((allowlist.ignoredFiles ?? []).map((entry) => entry.path.replaceAll('\\', '/')));
const ignoredPrefixes = [...ignoredFiles].filter((entry) => !entry.endsWith('.tsx') && !entry.endsWith('.ts'));
const ignoredPatterns = new Set(allowlist.ignoredPatterns ?? []);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return walk(fullPath);
    if (!entry.endsWith('.tsx')) return [];
    if (entry.endsWith('.test.tsx') || entry.endsWith('.a11y.test.tsx')) return [];
    return [fullPath];
  });
}

function isIgnored(file) {
  const normalized = relative(root, file).replaceAll('\\', '/');
  if (ignoredFiles.has(normalized)) return true;
  return ignoredPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function stripCodeNoise(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/className=(["'`])[\s\S]*?\1/g, '')
    .replace(/to=(["'`])[\s\S]*?\1/g, '')
    .replace(/href=(["'`])[\s\S]*?\1/g, '');
}

function collectViolations(file) {
  if (isIgnored(file)) return [];
  const normalized = relative(root, file).replaceAll('\\', '/');
  const source = stripCodeNoise(readFileSync(file, 'utf8'));
  const violations = [];
  const jsxTextPattern = />\s*([A-Z][^<>{}\n]{2,})\s*</g;
  const attributePattern = /\b(aria-label|title|placeholder)=["']([A-Z][^"']{2,})["']/g;

  for (const match of source.matchAll(jsxTextPattern)) {
    const text = match[1].replace(/\s+/g, ' ').trim();
    if (!text || ignoredPatterns.has(text)) continue;
    violations.push(`${normalized}: JSX text "${text}"`);
  }

  for (const match of source.matchAll(attributePattern)) {
    const text = match[2].replace(/\s+/g, ' ').trim();
    if (!text || ignoredPatterns.has(text)) continue;
    violations.push(`${normalized}: ${match[1]} "${text}"`);
  }

  return violations;
}

const violations = walk(pagesRoot).flatMap(collectViolations);

if (violations.length > 0) {
  console.error('Hardcoded user-facing page strings found outside the i18n allowlist:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('No unapproved hardcoded page strings found.');
