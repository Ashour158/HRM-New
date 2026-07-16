import { describe, expect, it } from 'vitest';
import { KpiMeasurementRepository } from './kpi-measurement.repository.js';
import type { KpiMeasurement } from '../aggregates/kpi-measurement.aggregate.js';

describe('KpiMeasurementRepository numeric column mapping', () => {
  const repo = Object.create(KpiMeasurementRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): KpiMeasurement;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000704',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    kpi_id: '00000000-0000-0000-0000-000000000040',
    period_start: new Date('2026-04-01T00:00:00.000Z'),
    period_end: new Date('2026-06-30T00:00:00.000Z'),
    status: 'RECORDED',
    recorded_by: null,
    validated_by: null,
    notes: null,
    aggregate_version: 1,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
  };

  it('parses actual_value, target_value, variance, and variance_percentage when Postgres returns NUMERIC as strings', () => {
    const measurement = repo.toAggregate({
      ...baseRow,
      actual_value: '74.5',
      target_value: '80',
      variance: '-5.5',
      variance_percentage: '-6.88',
    });

    expect(measurement.actualValue).toBe(74.5);
    expect(measurement.targetValue).toBe(80);
    expect(measurement.variance).toBe(-5.5);
    expect(measurement.variancePercentage).toBe(-6.88);
  });

  it('leaves optional numeric fields undefined when the column is null', () => {
    const measurement = repo.toAggregate({
      ...baseRow,
      actual_value: '74.5',
      target_value: null,
      variance: null,
      variance_percentage: null,
    });

    expect(measurement.targetValue).toBeUndefined();
    expect(measurement.variance).toBeUndefined();
    expect(measurement.variancePercentage).toBeUndefined();
  });

  it('throws instead of silently constructing a measurement with a corrupt actual_value', () => {
    expect(() => repo.toAggregate({ ...baseRow, actual_value: 'not-a-number', target_value: null, variance: null, variance_percentage: null }))
      .toThrow(/Expected a numeric value/);
  });
});
