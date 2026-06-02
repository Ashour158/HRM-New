import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { collectStaticEvidence, createAuditReport } from './audit-core.js';

describe('createAuditReport', () => {
  it('flags frontend API routes that have no backend endpoint match', () => {
    const report = createAuditReport({
      generatedAt: '2026-06-01T00:00:00.000Z',
      projectRoot: 'repo',
      tableNames: ['hr_core.workers'],
      migrationFiles: ['001_workers.js'],
      triggerDefinitions: [],
      domainNames: ['hr-core'],
      frontendApiRoutes: ['/employee/benefits', '/policy/allowed-actions'],
      backendApiRoutes: ['/policy/allowed-actions', '/hr/benefits'],
      scrollTrapFiles: [],
      placeholderFiles: [],
      geolocationFieldHits: [],
      workflowFiles: ['workflow-engine.ts'],
    });

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: 'API_ROUTE_MISMATCH',
        severity: 'high',
      }),
    );
    expect(report.findings.find((finding) => finding.code === 'API_ROUTE_MISMATCH')?.evidence).toContain(
      '/employee/benefits',
    );
  });

  it('flags layouts that trap page scroll', () => {
    const report = createAuditReport({
      generatedAt: '2026-06-01T00:00:00.000Z',
      projectRoot: 'repo',
      tableNames: [],
      migrationFiles: [],
      triggerDefinitions: [],
      domainNames: [],
      frontendApiRoutes: [],
      backendApiRoutes: [],
      scrollTrapFiles: ['apps/hr-web/src/layouts/portal-layout.tsx'],
      placeholderFiles: [],
      geolocationFieldHits: [],
      workflowFiles: [],
    });

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: 'PAGE_SCROLL_TRAPPED',
        severity: 'high',
      }),
    );
  });
});

describe('collectStaticEvidence', () => {
  it('collects routes, tables, triggers, scroll traps, and geolocation evidence from the repo tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hrm-audit-'));
    await mkdir(join(root, 'packages/hr-database/src/migrations'), { recursive: true });
    await mkdir(join(root, 'apps/hr-api/src/domains/time-attendance/api'), { recursive: true });
    await mkdir(join(root, 'apps/hr-web/src/pages/employee'), { recursive: true });
    await mkdir(join(root, 'apps/hr-web/src/layouts'), { recursive: true });

    await writeFile(
      join(root, 'packages/hr-database/src/migrations/001_time.js'),
      `
        pgm.createTable({ schema: 'hr_time', name: 'time_clock_events' }, {
          latitude: { type: 'numeric' },
          longitude: { type: 'numeric' }
        });
        pgm.sql('CREATE TRIGGER time_clock_audit AFTER INSERT ON hr_time.time_clock_events EXECUTE FUNCTION audit()');
      `,
    );
    await writeFile(
      join(root, 'packages/hr-database/src/migrations/002_sql_tables.js'),
      `
        pgm.sql(\`
          CREATE TABLE IF NOT EXISTS hr_performance.goals (
            id uuid PRIMARY KEY
          );
        \`);
      `,
    );
    await writeFile(
      join(root, 'apps/hr-api/src/domains/time-attendance/api/time.controller.ts'),
      `
        @Controller()
        export class TimeController {
          @Get('employee/attendance/events')
          list() {}
        }
      `,
    );
    await writeFile(
      join(root, 'apps/hr-web/src/pages/employee/benefits.tsx'),
      `
        api.get('/employee/benefits');
        <p>Development Mode: endpoint not wired yet</p>
      `,
    );
    await writeFile(
      join(root, 'apps/hr-web/src/layouts/portal-layout.tsx'),
      `<div className="h-screen overflow-hidden">`,
    );

    const evidence = await collectStaticEvidence(root);

    expect(evidence.tableNames).toContain('hr_time.time_clock_events');
    expect(evidence.tableNames).toContain('hr_performance.goals');
    expect(evidence.triggerDefinitions).toHaveLength(1);
    expect(evidence.backendApiRoutes).toContain('/employee/attendance/events');
    expect(evidence.frontendApiRoutes).toContain('/employee/benefits');
    expect(evidence.scrollTrapFiles).toContain('apps/hr-web/src/layouts/portal-layout.tsx');
    expect(evidence.placeholderFiles).toContain('apps/hr-web/src/pages/employee/benefits.tsx');
    expect(evidence.geolocationFieldHits).toContain('packages/hr-database/src/migrations/001_time.js');
  });

  it('does not flag normal form placeholder attributes as unfinished workflows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hrm-audit-placeholders-'));
    await mkdir(join(root, 'apps/hr-web/src/pages/admin'), { recursive: true });

    await writeFile(
      join(root, 'apps/hr-web/src/pages/admin/settings.tsx'),
      `
        export function Settings() {
          return <input placeholder="Policy name" aria-label="Policy name" />;
        }
      `,
    );

    const evidence = await collectStaticEvidence(root);

    expect(evidence.placeholderFiles).toEqual([]);
  });
});
