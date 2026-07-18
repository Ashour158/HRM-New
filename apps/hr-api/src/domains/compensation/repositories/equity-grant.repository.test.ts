import { describe, expect, it } from 'vitest';
import { EquityGrantRepository } from './equity-grant.repository.js';
import type { EquityGrant } from '../aggregates/equity-grant.aggregate.js';

describe('EquityGrantRepository numeric column mapping', () => {
  const repo = Object.create(EquityGrantRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): EquityGrant;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000905',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    worker_id: '00000000-0000-0000-0000-000000000012',
    grant_type: 'RSU',
    grant_date: new Date('2026-01-15T00:00:00.000Z'),
    vesting_schedule: [],
    status: 'GRANTED',
    aggregate_version: 1,
    created_at: new Date('2026-06-03T09:00:00.000Z'),
    updated_at: new Date('2026-06-03T09:00:00.000Z'),
  };

  it('parses total_units, vested_units, and exercised_units when Postgres returns them as NUMERIC strings', () => {
    // node-postgres returns NUMERIC columns as strings. Unparsed unit counts
    // would silently string-concatenate in recordVesting()/exercise()'s +=
    // arithmetic instead of adding.
    const aggregate = repo.toAggregate({
      ...baseRow,
      total_units: '1000',
      vested_units: '250.5',
      exercised_units: '100',
      strike_price: null,
    });

    expect(aggregate.totalUnits).toBe(1000);
    expect(typeof aggregate.totalUnits).toBe('number');
    expect(aggregate.vestedUnits).toBe(250.5);
    expect(typeof aggregate.vestedUnits).toBe('number');
    expect(aggregate.exercisedUnits).toBe(100);
    expect(typeof aggregate.exercisedUnits).toBe('number');
  });

  it('parses a present strike_price and maps a null strike_price to undefined', () => {
    const withPrice = repo.toAggregate({
      ...baseRow,
      total_units: '1000',
      vested_units: '0',
      exercised_units: '0',
      strike_price: '12.34',
    });
    expect(withPrice.strikePrice).toBe(12.34);
    expect(typeof withPrice.strikePrice).toBe('number');

    const withoutPrice = repo.toAggregate({
      ...baseRow,
      total_units: '1000',
      vested_units: '0',
      exercised_units: '0',
      strike_price: null,
    });
    expect(withoutPrice.strikePrice).toBeUndefined();
  });

  it('throws instead of silently turning a corrupt total_units into NaN', () => {
    expect(() =>
      repo.toAggregate({
        ...baseRow,
        total_units: 'not-a-number',
        vested_units: '0',
        exercised_units: '0',
        strike_price: null,
      }),
    ).toThrow(/Expected a numeric value/);
  });
});
