import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface StaticEvidence {
  generatedAt: string;
  projectRoot: string;
  tableNames: string[];
  migrationFiles: string[];
  triggerDefinitions: string[];
  domainNames: string[];
  frontendApiRoutes: string[];
  backendApiRoutes: string[];
  scrollTrapFiles: string[];
  placeholderFiles: string[];
  geolocationFieldHits: string[];
  workflowFiles: string[];
}

export interface AuditFinding {
  code: string;
  severity: AuditSeverity;
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string;
}

export interface AuditReport {
  generatedAt: string;
  projectRoot: string;
  summary: {
    tables: number;
    domains: number;
    frontendApiRoutes: number;
    backendApiRoutes: number;
    findings: number;
  };
  findings: AuditFinding[];
}

const KNOWN_ROUTE_ALIASES = new Map<string, string[]>();

export async function collectStaticEvidence(projectRoot: string): Promise<StaticEvidence> {
  const files = await listFiles(projectRoot);
  const migrationFiles = files.filter((file) => {
    const normalized = normalizePath(file);
    return normalized.includes('infra/migrations/') || normalized.includes('packages/hr-database/src/migrations/');
  });
  const controllerFiles = files.filter((file) => normalizePath(file).includes('apps/hr-api/src/') && file.endsWith('.ts'));
  const frontendFiles = files.filter((file) => normalizePath(file).includes('apps/hr-web/src/') && /\.(ts|tsx)$/.test(file));
  const domainNames = await collectDomainNames(projectRoot);

  const tableNames = new Set<string>();
  const triggerDefinitions: string[] = [];
  const geolocationFieldHits = new Set<string>();

  for (const file of migrationFiles) {
    const content = await readFile(join(projectRoot, file), 'utf8');
    for (const tableName of extractTableNames(content)) {
      tableNames.add(tableName);
    }
    for (const trigger of content.matchAll(/CREATE\s+TRIGGER[\s\S]*?(?:;|'\))/gi)) {
      triggerDefinitions.push(trigger[0].replace(/\s+/g, ' ').trim());
    }
    if (/\b(latitude|longitude|geolocation|geo_|coordinates|accuracy_meters)\b/i.test(content)) {
      geolocationFieldHits.add(file);
    }
  }

  const backendApiRoutes = new Set<string>();
  const workflowFiles: string[] = [];
  for (const file of controllerFiles) {
    const normalized = normalizePath(file);
    const content = await readFile(join(projectRoot, file), 'utf8');
    for (const route of extractBackendRoutes(content)) {
      backendApiRoutes.add(route);
    }
    if (/(workflow|fsm|saga|command-bus|outbox|inbox)/i.test(normalized)) {
      workflowFiles.push(file);
    }
  }

  const frontendApiRoutes = new Set<string>();
  const scrollTrapFiles = new Set<string>();
  const placeholderFiles = new Set<string>();

  for (const file of frontendFiles) {
    const content = await readFile(join(projectRoot, file), 'utf8');
    for (const route of extractFrontendApiRoutes(content)) {
      frontendApiRoutes.add(route);
    }
    if (/h-screen[^"`']*overflow-hidden|overflow-hidden[^"`']*h-screen/.test(content)) {
      scrollTrapFiles.add(file);
    }
    if (hasUnfinishedWorkflowLanguage(content)) {
      placeholderFiles.add(file);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    projectRoot,
    tableNames: sortValues(tableNames),
    migrationFiles: migrationFiles.sort(),
    triggerDefinitions: triggerDefinitions.sort(),
    domainNames,
    frontendApiRoutes: sortValues(frontendApiRoutes),
    backendApiRoutes: sortValues(backendApiRoutes),
    scrollTrapFiles: sortValues(scrollTrapFiles),
    placeholderFiles: sortValues(placeholderFiles),
    geolocationFieldHits: sortValues(geolocationFieldHits),
    workflowFiles: workflowFiles.sort(),
  };
}

export function createAuditReport(evidence: StaticEvidence): AuditReport {
  const findings: AuditFinding[] = [];
  const mismatchedRoutes = evidence.frontendApiRoutes.filter(
    (route) => !routeHasBackendMatch(route, evidence.backendApiRoutes),
  );

  if (mismatchedRoutes.length > 0) {
    findings.push({
      code: 'API_ROUTE_MISMATCH',
      severity: 'high',
      title: 'Frontend API routes are not backed by matching service endpoints',
      summary:
        'Some UI workflows call API paths that are not exposed by the backend. Those workflows may render blank states or fail silently.',
      evidence: mismatchedRoutes,
      recommendation:
        'Either implement the missing backend endpoints or change the frontend clients to call the canonical service routes. Keep a smoke test for each route pair.',
    });
  }

  if (evidence.scrollTrapFiles.length > 0) {
    findings.push({
      code: 'PAGE_SCROLL_TRAPPED',
      severity: 'high',
      title: 'Shell layout can prevent page-level vertical scrolling',
      summary:
        'One or more frontend layout files combine fixed viewport height with hidden overflow, which can trap content below the fold.',
      evidence: evidence.scrollTrapFiles,
      recommendation:
        'Move scrolling to the main content column with min-height constraints, or remove hidden page overflow from the root shell.',
    });
  }

  if (evidence.placeholderFiles.length > 0) {
    findings.push({
      code: 'PLACEHOLDER_WORKFLOW',
      severity: 'medium',
      title: 'User-facing workflows still contain placeholder or demo language',
      summary:
        'Placeholder markers mean parts of the product are still presentation surfaces rather than complete service workflows.',
      evidence: evidence.placeholderFiles,
      recommendation:
        'Replace demo screens with service-backed states, real loading/error handling, and tests that fail when the endpoint is unavailable.',
    });
  }

  if (evidence.workflowFiles.length > 0 && evidence.triggerDefinitions.length === 0) {
    findings.push({
      code: 'APP_LEVEL_WORKFLOWS_ONLY',
      severity: 'medium',
      title: 'Workflow automation appears app-level rather than database-triggered',
      summary:
        'Workflow engines, command buses, sagas, or outbox files exist, but no database trigger definitions were found in migrations.',
      evidence: evidence.workflowFiles.slice(0, 12),
      recommendation:
        'Document which workflow guarantees belong in application services and which require database triggers, then add migration-backed triggers only where invariant enforcement needs them.',
    });
  }

  if (evidence.geolocationFieldHits.length === 0) {
    findings.push({
      code: 'MISSING_GEOLOCATION_EVIDENCE',
      severity: 'medium',
      title: 'No structured geolocation evidence fields found',
      summary:
        'Attendance check-in/out cannot be fully audited without structured location evidence such as latitude, longitude, accuracy, provider, and policy decision metadata.',
      evidence: ['No migration files contained latitude, longitude, geolocation, coordinates, or accuracy fields.'],
      recommendation:
        'Add policy-driven geolocation requirements and store structured check-in/out evidence fields on attendance events.',
    });
  }

  return {
    generatedAt: evidence.generatedAt,
    projectRoot: evidence.projectRoot,
    summary: {
      tables: evidence.tableNames.length,
      domains: evidence.domainNames.length,
      frontendApiRoutes: evidence.frontendApiRoutes.length,
      backendApiRoutes: evidence.backendApiRoutes.length,
      findings: findings.length,
    },
    findings,
  };
}

export function formatAuditReport(report: AuditReport): string {
  const lines = [
    '# HRM Nexus Policy & Workflow Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectRoot}`,
    '',
    '## Summary',
    '',
    `- Tables: ${report.summary.tables}`,
    `- Domains: ${report.summary.domains}`,
    `- Frontend API routes: ${report.summary.frontendApiRoutes}`,
    `- Backend API routes: ${report.summary.backendApiRoutes}`,
    `- Findings: ${report.summary.findings}`,
    '',
    '## Findings',
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('No findings detected by the static auditor.');
    return lines.join('\n');
  }

  for (const finding of report.findings) {
    lines.push(`### [${finding.severity.toUpperCase()}] ${finding.title}`);
    lines.push('');
    lines.push(`Code: ${finding.code}`);
    lines.push('');
    lines.push(finding.summary);
    lines.push('');
    lines.push('Evidence:');
    for (const item of finding.evidence) {
      lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push(`Recommendation: ${finding.recommendation}`);
    lines.push('');
  }

  return lines.join('\n');
}

async function listFiles(root: string, current = ''): Promise<string[]> {
  const directory = join(root, current);
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === '.turbo') {
      continue;
    }
    const absolute = join(directory, entry);
    const relativePath = join(current, entry);
    const entryStat = await stat(absolute);
    if (entryStat.isDirectory()) {
      files.push(...(await listFiles(root, relativePath)));
    } else {
      files.push(normalizePath(relativePath));
    }
  }
  return files;
}

async function collectDomainNames(projectRoot: string): Promise<string[]> {
  const domainRoot = join(projectRoot, 'apps/hr-api/src/domains');
  try {
    const entries = await readdir(domainRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function extractTableNames(content: string): string[] {
  const tableNames = new Set<string>();

  for (const match of content.matchAll(/createTable\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
    tableNames.add(match[1] ?? '');
  }

  for (const match of content.matchAll(
    /createTable\s*\(\s*\{\s*schema:\s*['"`]([^'"`]+)['"`]\s*,\s*name:\s*['"`]([^'"`]+)['"`]/g,
  )) {
    tableNames.add(`${match[1]}.${match[2]}`);
  }

  for (const match of content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][\w]*\.[a-zA-Z_][\w]*)/gi)) {
    tableNames.add(match[1] ?? '');
  }

  return [...tableNames].filter(Boolean);
}

function extractBackendRoutes(content: string): string[] {
  const controllerMatch = content.match(/@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/);
  if (!controllerMatch) {
    return [];
  }

  const controllerPath = controllerMatch[1] ?? '';
  const routes = new Set<string>();
  const methodPattern = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
  for (const match of content.matchAll(methodPattern)) {
    routes.add(joinRoute(controllerPath, match[2] ?? ''));
  }

  return [...routes];
}

function extractFrontendApiRoutes(content: string): string[] {
  const routes = new Set<string>();
  const patterns = [
    /\bapi\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g,
    /\bapiClient\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g,
    /\bfetch\(\s*['"`]([^'"`]+)['"`]/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const route = normalizeApiRoute(match[1] ?? '');
      if (route) {
        routes.add(route);
      }
    }
  }

  return [...routes];
}

function hasUnfinishedWorkflowLanguage(content: string): boolean {
  const withoutBenignPlaceholderAttributes = content.replace(
    /\bplaceholder\s*=\s*(?:"[^"]*"|'[^']*'|{`[^`]*`}|{[^}]*})/gi,
    '',
  );

  return /\b(not wired|development mode|mock data|demo mode|placeholder\s+(?:workflow|data|screen|surface|content|copy|endpoint|integration)|(?:workflow|data|screen|surface|content|endpoint|integration)\s+placeholder)\b/i.test(
    withoutBenignPlaceholderAttributes,
  );
}

function routeHasBackendMatch(frontendRoute: string, backendRoutes: string[]): boolean {
  if (backendRoutes.includes(frontendRoute)) {
    return true;
  }

  const aliases = KNOWN_ROUTE_ALIASES.get(frontendRoute) ?? [];
  if (aliases.some((alias) => backendRoutes.includes(alias))) {
    return true;
  }

  return backendRoutes.some((backendRoute) => routePatternMatches(backendRoute, frontendRoute));
}

function routePatternMatches(backendRoute: string, frontendRoute: string): boolean {
  const backendParts = backendRoute.split('/').filter(Boolean);
  const frontendParts = frontendRoute.split('/').filter(Boolean);
  if (backendParts.length !== frontendParts.length) {
    return false;
  }

  return backendParts.every((part, index) => {
    const frontendPart = frontendParts[index] ?? '';
    return part === frontendPart || part.startsWith(':') || frontendPart.startsWith(':');
  });
}

function normalizeApiRoute(route: string): string | null {
  if (route.startsWith('http')) {
    try {
      return new URL(route).pathname.replace(/^\/api\/v1/, '') || '/';
    } catch {
      return null;
    }
  }

  if (!route.startsWith('/')) {
    return null;
  }

  const withoutApiPrefix = route.replace(/^\/api\/v1/, '') || '/';
  const withoutQuery = withoutApiPrefix.split('?')[0] ?? withoutApiPrefix;
  return withoutQuery.replace(/\$\{[^}]+\}/g, ':dynamic');
}

function joinRoute(prefix: string, suffix: string): string {
  const normalizedPrefix = prefix.replace(/^\/|\/$/g, '');
  const normalizedSuffix = suffix.replace(/^\/|\/$/g, '');
  const path = [normalizedPrefix, normalizedSuffix].filter(Boolean).join('/');
  return `/${path}`;
}

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function sortValues(values: Set<string>): string[] {
  return [...values].filter(Boolean).sort();
}

export function toProjectRelative(projectRoot: string, absolutePath: string): string {
  return normalizePath(relative(projectRoot, absolutePath));
}
