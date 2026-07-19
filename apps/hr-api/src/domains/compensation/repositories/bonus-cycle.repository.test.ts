import { describe, expect, it } from 'vitest';
import { BonusCycleRepository } from './bonus-cycle.repository.js';
import type { BonusCycle } from '../aggregates/bonus-cycle.aggregate.js';

describe('BonusCycleRepository numeric column mapping', () => {
  const repo = Object.create(BonusCycleRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): BonusCycle;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000904',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    cycle_name: 'FY26 Annual Bonus',
    cycle_year: 2026,
    eligibility_date: new Date('2026-01-01T00:00:00.000Z'),
    payment_date: new Date('2027-03-01T00:00:00.000Z'),
    currency: 'USD',
    status: 'DRAFT',
    aggregate_version: 1,
    created_at: new Date('2026-06-03T09:00:00.000Z'),
    updated_at: new Date('2026-06-03T09:00:00.000Z'),
  };

  it('parses total_pool_amount when Postgres returns it as a NUMERIC string', () => {
    // node-postgres returns NUMERIC columns as strings. An unparsed
    // total_pool_amount would silently string-concatenate in any downstream
    // pool-allocation arithmetic.
    const aggregate = repo.toAggregate({
      ...baseRow,
      total_pool_amount: '2500000.75',
    });

    expect(aggregate.totalPoolAmount).toBe(2500000.75);
    expect(typeof aggregate.totalPoolAmount).toBe('number');
  });

  it('throws instead of silently turning a corrupt total_pool_amount into NaN', () => {
    expect(() =>
      repo.toAggregate({
        ...baseRow,
        total_pool_amount: 'not-a-number',
      }),
    ).toThrow(/Expected a numeric value/);
  });
});
