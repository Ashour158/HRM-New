import { describe, expect, it } from 'vitest';
import { CompensationBandRepository } from './compensation-band.repository.js';
import type { CompensationBand } from '../aggregates/compensation-band.aggregate.js';

describe('CompensationBandRepository numeric column mapping', () => {
  const repo = Object.create(CompensationBandRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): CompensationBand;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000901',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    band_code: 'ENG-L4',
    job_level: 'L4',
    job_family: 'Engineering',
    currency: 'USD',
    status: 'DRAFT',
    aggregate_version: 1,
    created_at: new Date('2026-06-03T09:00:00.000Z'),
    updated_at: new Date('2026-06-03T09:00:00.000Z'),
  };

  it('parses min_salary, mid_salary, and max_salary when Postgres returns them as NUMERIC strings', () => {
    // node-postgres returns NUMERIC columns as strings, not numbers. Passing
    // those strings straight into salary-range comparisons would produce
    // string comparison/concatenation instead of numeric arithmetic.
    const aggregate = repo.toAggregate({
      ...baseRow,
      min_salary: '80000.00',
      mid_salary: '100000.50',
      max_salary: '120000.99',
    });

    expect(aggregate.minSalary).toBe(80000);
    expect(typeof aggregate.minSalary).toBe('number');
    expect(aggregate.midSalary).toBe(100000.5);
    expect(typeof aggregate.midSalary).toBe('number');
    expect(aggregate.maxSalary).toBe(120000.99);
    expect(typeof aggregate.maxSalary).toBe('number');
  });

  it('throws instead of silently turning a corrupt salary value into NaN', () => {
    expect(() =>
      repo.toAggregate({
        ...baseRow,
        min_salary: 'not-a-number',
        mid_salary: '100000',
        max_salary: '120000',
      }),
    ).toThrow(/Expected a numeric value/);
  });
});
