import {
  determineReadinessStatus,
  summarizeProductionReadiness,
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
});
