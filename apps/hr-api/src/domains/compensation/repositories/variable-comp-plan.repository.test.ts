import { describe, expect, it } from 'vitest';
import { VariableCompPlanRepository } from './variable-comp-plan.repository.js';
import type { VariableCompPlan } from '../aggregates/variable-comp-plan.aggregate.js';

describe('VariableCompPlanRepository numeric column mapping', () => {
  const repo = Object.create(VariableCompPlanRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): VariableCompPlan;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000906',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    name: 'Sales Incentive Plan',
    plan_type: 'COMMISSION',
    currency: 'USD',
    status: 'DRAFT',
    aggregate_version: 1,
    created_at: new Date('2026-06-03T09:00:00.000Z'),
    updated_at: new Date('2026-06-03T09:00:00.000Z'),
  };

  it('parses target_percentage and max_percentage when Postgres returns them as NUMERIC strings', () => {
    // node-postgres returns NUMERIC columns as strings. An unparsed
    // percentage would silently string-concatenate in any downstream payout
    // calculation instead of multiplying/adding.
    const aggregate = repo.toAggregate({
      ...baseRow,
      target_percentage: '15.5',
      max_percentage: '30',
    });

    expect(aggregate.targetPercentage).toBe(15.5);
    expect(typeof aggregate.targetPercentage).toBe('number');
    expect(aggregate.maxPercentage).toBe(30);
    expect(typeof aggregate.maxPercentage).toBe('number');
  });

  it('throws instead of silently turning a corrupt max_percentage into NaN', () => {
    expect(() =>
      repo.toAggregate({
        ...baseRow,
        target_percentage: '15.5',
        max_percentage: 'not-a-number',
      }),
    ).toThrow(/Expected a numeric value/);
  });
});
