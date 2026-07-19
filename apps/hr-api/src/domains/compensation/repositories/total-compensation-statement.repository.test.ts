import { describe, expect, it } from 'vitest';
import { TotalCompensationStatementRepository } from './total-compensation-statement.repository.js';
import type { TotalCompensationStatement } from '../aggregates/total-compensation-statement.aggregate.js';

describe('TotalCompensationStatementRepository numeric column mapping', () => {
  const repo = Object.create(TotalCompensationStatementRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): TotalCompensationStatement;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000903',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    worker_id: '00000000-0000-0000-0000-000000000012',
    statement_year: 2026,
    currency: 'USD',
    status: 'DRAFT',
    aggregate_version: 1,
    created_at: new Date('2026-06-03T09:00:00.000Z'),
    updated_at: new Date('2026-06-03T09:00:00.000Z'),
  };

  it('parses base_salary, bonus_amount, equity_value, benefits_value, and total_comp when Postgres returns them as NUMERIC strings', () => {
    // node-postgres returns NUMERIC columns as strings. Summing unparsed
    // strings for totalComp-style fields produces string concatenation
    // instead of addition.
    const aggregate = repo.toAggregate({
      ...baseRow,
      base_salary: '150000.00',
      bonus_amount: '15000.25',
      equity_value: '50000.50',
      benefits_value: '12000.75',
      total_comp: '227001.50',
    });

    expect(aggregate.baseSalary).toBe(150000);
    expect(typeof aggregate.baseSalary).toBe('number');
    expect(aggregate.bonusAmount).toBe(15000.25);
    expect(typeof aggregate.bonusAmount).toBe('number');
    expect(aggregate.equityValue).toBe(50000.5);
    expect(typeof aggregate.equityValue).toBe('number');
    expect(aggregate.benefitsValue).toBe(12000.75);
    expect(typeof aggregate.benefitsValue).toBe('number');
    expect(aggregate.totalComp).toBe(227001.5);
    expect(typeof aggregate.totalComp).toBe('number');
  });

  it('throws instead of silently turning a corrupt total_comp into NaN', () => {
    expect(() =>
      repo.toAggregate({
        ...baseRow,
        base_salary: '150000',
        bonus_amount: '15000',
        equity_value: '50000',
        benefits_value: '12000',
        total_comp: 'not-a-number',
      }),
    ).toThrow(/Expected a numeric value/);
  });
});
