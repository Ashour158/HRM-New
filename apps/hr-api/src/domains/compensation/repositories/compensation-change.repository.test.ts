import { describe, expect, it } from 'vitest';
import { CompensationChangeRepository } from './compensation-change.repository.js';
import type { CompensationChange } from '../aggregates/compensation-change.aggregate.js';

describe('CompensationChangeRepository numeric column mapping', () => {
  const repo = Object.create(CompensationChangeRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): CompensationChange;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000902',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    worker_id: '00000000-0000-0000-0000-000000000012',
    change_type: 'MERIT_INCREASE',
    currency: 'USD',
    effective_date: new Date('2026-08-01T00:00:00.000Z'),
    approved_by: null,
    status: 'DRAFT',
    aggregate_version: 1,
    created_at: new Date('2026-06-03T09:00:00.000Z'),
    updated_at: new Date('2026-06-03T09:00:00.000Z'),
  };

  it('parses new_amount (NOT NULL) and old_amount (nullable) when Postgres returns them as NUMERIC strings', () => {
    // node-postgres returns NUMERIC columns as strings. Without conversion at
    // this read boundary, CompensationChange.approve()/submit() guards and any
    // downstream amount math would string-concatenate instead of adding.
    const aggregate = repo.toAggregate({
      ...baseRow,
      old_amount: '95000.00',
      new_amount: '105000.50',
    });

    expect(aggregate.oldAmount).toBe(95000);
    expect(typeof aggregate.oldAmount).toBe('number');
    expect(aggregate.newAmount).toBe(105000.5);
    expect(typeof aggregate.newAmount).toBe('number');
  });

  it('maps a null old_amount to undefined instead of throwing', () => {
    const aggregate = repo.toAggregate({
      ...baseRow,
      old_amount: null,
      new_amount: '105000',
    });

    expect(aggregate.oldAmount).toBeUndefined();
  });

  it('throws instead of silently turning a corrupt new_amount into NaN', () => {
    expect(() =>
      repo.toAggregate({
        ...baseRow,
        old_amount: null,
        new_amount: 'not-a-number',
      }),
    ).toThrow(/Expected a numeric value/);
  });

  it('throws instead of silently turning a corrupt but present old_amount into NaN', () => {
    expect(() =>
      repo.toAggregate({
        ...baseRow,
        old_amount: 'garbage',
        new_amount: '105000',
      }),
    ).toThrow(/Expected a numeric value/);
  });
});
