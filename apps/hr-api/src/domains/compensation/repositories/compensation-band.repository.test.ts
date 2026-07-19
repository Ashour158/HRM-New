import { describe, expect, it } from 'vitest';
import { CompensationBandRepository } from './compensation-band.repository.js';
import type { CompensationBand } from '../aggregates/compensation-band.aggregate.js';

describe('CompensationBandRepository min/mid/max_salary mapping', () => {
  const repo = Object.create(CompensationBandRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): CompensationBand;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000901',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    band_code: 'ENG-L4',
    job_level: 'L4',
    job_family: 'ENGINEERING',
    currency: 'USD',
    status: 'ACTIVE',
    aggregate_version: 0,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };

  it('parses min/mid/max_salary as genuine numbers when Postgres returns the NUMERIC columns as strings', () => {
    // node-postgres returns NUMERIC columns as strings. Without parseNumeric,
    // band.minSalary/midSalary/maxSalary would hold strings at runtime despite
    // the declared `number` type, and the offer-compensation engine's
    // `minSalary <= midSalary <= maxSalary` band validity check -- along with
    // its compa-ratio/range-penetration arithmetic -- would silently do
    // string comparison/concatenation instead of numeric comparison/math.
    const band = repo.toAggregate({
      ...baseRow,
      min_salary: '80000.00',
      mid_salary: '100000.00',
      max_salary: '120000.00',
    });

    expect(typeof band.minSalary).toBe('number');
    expect(typeof band.midSalary).toBe('number');
    expect(typeof band.maxSalary).toBe('number');
    expect(band.minSalary).toBe(80000);
    expect(band.midSalary).toBe(100000);
    expect(band.maxSalary).toBe(120000);
    expect(band.minSalary <= band.midSalary && band.midSalary <= band.maxSalary).toBe(true);
  });

  it('throws instead of silently constructing a band with a corrupt salary value', () => {
    expect(() =>
      repo.toAggregate({ ...baseRow, min_salary: 'not-a-number', mid_salary: '100000', max_salary: '120000' }),
    ).toThrow(/Expected a numeric value/);
  });
});
