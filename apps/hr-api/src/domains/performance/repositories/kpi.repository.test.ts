import { describe, expect, it } from 'vitest';
import { KpiRepository } from './kpi.repository.js';
import type { KeyPerformanceIndicator } from '../aggregates/kpi.aggregate.js';

describe('KpiRepository numeric column mapping', () => {
  const repo = Object.create(KpiRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): KeyPerformanceIndicator;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000703',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    org_unit_id: null,
    name: 'Employee eNPS',
    description: null,
    unit: 'score',
    frequency: 'QUARTERLY',
    owner_id: null,
    formula: null,
    data_source: null,
    department: null,
    status: 'ACTIVE',
    aggregate_version: 1,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
  };

  it('parses target_value and actual_value when Postgres returns NUMERIC as strings', () => {
    const kpi = repo.toAggregate({ ...baseRow, target_value: '80', actual_value: '74.5' });

    expect(kpi.targetValue).toBe(80);
    expect(kpi.actualValue).toBe(74.5);
  });

  it('leaves target_value and actual_value undefined when the column is null', () => {
    const kpi = repo.toAggregate({ ...baseRow, target_value: null, actual_value: null });

    expect(kpi.targetValue).toBeUndefined();
    expect(kpi.actualValue).toBeUndefined();
  });

  it('throws instead of silently constructing a KPI with a corrupt actual_value', () => {
    expect(() => repo.toAggregate({ ...baseRow, target_value: '80', actual_value: 'not-a-number' }))
      .toThrow(/Expected a numeric value/);
  });
});
