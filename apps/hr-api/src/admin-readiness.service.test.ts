import {
  determineReadinessStatus,
  summarizeProductionPendingWork,
  summarizeProductionReadiness,
  type ProductionPendingWorkItem,
  type ProductionReadinessDomain,
} from './admin-readiness.service.js';

function domain(
  code: string,
  status: ProductionReadinessDomain['status'],
  blockers: string[] = [],
  warnings: string[] = [],
): ProductionReadinessDomain {
  return {
    code,
    label: code,
    status,
    summary: `${code} summary`,
    blockers,
    warnings,
    evidence: [],
    metrics: {},
    actionPath: '/admin/system-console',
  };
}

describe('Admin production readiness', () => {
  it('keeps blocked domains above configured or warning states', () => {
    expect(determineReadinessStatus({
      configured: true,
      blockers: ['No payroll result lines exist.'],
      warnings: ['No payslip artifacts exist.'],
    })).toBe('BLOCKED');
  });

  it('marks missing configuration separately from warning-only domains', () => {
    expect(determineReadinessStatus({ configured: false })).toBe('NOT_CONFIGURED');
    expect(determineReadinessStatus({
      configured: true,
      warnings: ['Runtime cannot prove latest CI run passed.'],
    })).toBe('WARNING');
    expect(determineReadinessStatus({ configured: true })).toBe('READY');
  });

  it('summarizes the production gate and refuses readiness when any domain is not clean', () => {
    const summary = summarizeProductionReadiness([
      domain('AUTH', 'READY'),
      domain('PAYROLL', 'BLOCKED', ['Payroll cycle has blockers.']),
      domain('INTEGRATIONS', 'NOT_CONFIGURED'),
      domain('CICD', 'WARNING', [], ['Latest CI result is external.']),
    ]);

    expect(summary.productionReady).toBe(false);
    expect(summary.overallStatus).toBe('BLOCKED');
    expect(summary.summary).toEqual({
      READY: 1,
      WARNING: 1,
      BLOCKED: 1,
      NOT_CONFIGURED: 1,
    });
    expect(summary.criticalBlockers).toContain('PAYROLL: Payroll cycle has blockers.');
    expect(summary.warnings).toContain('CICD: Latest CI result is external.');
  });

  it('marks the production gate ready when every domain is clean', () => {
    const summary = summarizeProductionReadiness([
      domain('AUTH', 'READY'),
      domain('PAYROLL', 'READY'),
      domain('POLICIES', 'READY'),
      domain('CICD', 'READY'),
    ]);

    expect(summary.productionReady).toBe(true);
    expect(summary.overallStatus).toBe('READY');
    expect(summary.summary).toEqual({
      READY: 4,
      WARNING: 0,
      BLOCKED: 0,
      NOT_CONFIGURED: 0,
    });
    expect(summary.criticalBlockers).toEqual([]);
    expect(summary.warnings).toEqual([]);
  });

  it('summarizes pending work by open item weight and highest group priority', () => {
    const items: ProductionPendingWorkItem[] = [
      {
        id: 'access',
        group: 'Governance And Privacy',
        title: 'Access review',
        summary: 'Two access reviews are pending.',
        count: 2,
        status: 'attention',
        statusLabel: 'Review',
        priority: 'HIGH',
        actionPath: '/admin/system-console/access-governance',
        actionLabel: 'Open',
        signals: [],
      },
      {
        id: 'release',
        group: 'Release Gates',
        title: 'Release envelope',
        summary: 'Release gates are ready.',
        count: 0,
        status: 'live',
        statusLabel: 'Ready',
        priority: 'LOW',
        actionPath: '/admin/system-console/readiness',
        actionLabel: 'Open',
        signals: [],
      },
      {
        id: 'queue',
        group: 'Operational Health',
        title: 'Queue decision',
        summary: 'A non-retryable event needs a decision.',
        count: 0,
        status: 'attention',
        statusLabel: 'Inspect',
        priority: 'CRITICAL',
        actionPath: '/admin/system-console/dead-letter-events',
        actionLabel: 'Open',
        signals: [],
      },
    ];

    const summary = summarizeProductionPendingWork(items);

    expect(summary.totalOpenItems).toBe(3);
    expect(summary.highPriorityItems).toBe(2);
    expect(summary.groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ group: 'Governance And Privacy', openItems: 2, highestPriority: 'HIGH' }),
      expect.objectContaining({ group: 'Operational Health', openItems: 1, highestPriority: 'CRITICAL' }),
      expect.objectContaining({ group: 'Release Gates', openItems: 0, highestPriority: 'LOW' }),
    ]));
  });
});
