import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const domainRoot = 'apps/hr-api/src/domains/';
const excludedPathPattern = /(^|[/\\])(?:\.git|node_modules)([/\\]|$)/;
const ignoredDomainPathPattern = /(?:^|[/\\])hcm-setup[/\\]hcm-setup\.defaults\.ts$/;
const ignoredTestPathPattern = /\.(?:spec|test)\.ts$/;

const isoCurrencyCodes = new Set([
  'AED', 'AFN', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
  'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
  'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
  'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
  'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
  'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD',
  'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW', 'ZWL',
]);

function gitFiles(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

function shouldScan(file) {
  const normalized = file.replaceAll('\\', '/');
  return normalized.startsWith(domainRoot)
    && normalized.endsWith('.ts')
    && !excludedPathPattern.test(file)
    && !ignoredTestPathPattern.test(normalized)
    && !ignoredDomainPathPattern.test(file)
    && !ignoredDomainPathPattern.test(normalized);
}

const files = [...new Set([
  ...gitFiles(['ls-files']),
  ...gitFiles(['ls-files', '--others', '--exclude-standard']),
])].filter(shouldScan);

const stringLiteralPattern = /(['"`])([^'"`]*?)\1/g;
const uppercaseTokenPattern = /\b[A-Z]{3}\b/g;
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
    stringLiteralPattern.lastIndex = 0;
    let literalMatch;
    while ((literalMatch = stringLiteralPattern.exec(line)) !== null) {
      const literal = literalMatch[2] ?? '';
      uppercaseTokenPattern.lastIndex = 0;
      let tokenMatch;
      while ((tokenMatch = uppercaseTokenPattern.exec(literal)) !== null) {
        const token = tokenMatch[0];
        if (isoCurrencyCodes.has(token)) {
          findings.push(`${file}:${index + 1} hardcoded currency literal "${token}"`);
        }
      }
    }
  });
}

if (findings.length > 0) {
  console.error('Hardcoded currency literals found in production domain code:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  console.error('Read tenant currency from HcmSetupService.getSetup(tenantId) instead.');
  process.exit(1);
}

console.log('No hardcoded production currency literals found in domain code.');
