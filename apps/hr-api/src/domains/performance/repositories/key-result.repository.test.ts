import { describe, expect, it } from 'vitest';
import { KeyResultRepository } from './key-result.repository.js';
import type { KeyResult } from '../aggregates/key-result.aggregate.js';

describe('KeyResultRepository numeric column mapping', () => {
  const repo = Object.create(KeyResultRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): KeyResult;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000702',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    objective_id: '00000000-0000-0000-0000-000000000030',
    title: 'Grow active accounts to target',
    description: null,
    unit: 'accounts',
    scoring_method: 'LINEAR',
    status: 'IN_PROGRESS',
    due_date: null,
    aggregate_version: 1,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
  };

  it('parses target_value, current_value, start_value, and progress when Postgres returns NUMERIC as strings', () => {
    const keyResult = repo.toAggregate({
      ...baseRow,
      target_value: '500',
      current_value: '325.5',
      start_value: '100',
      progress: '65.1',
    });

    expect(keyResult.targetValue).toBe(500);
    expect(keyResult.currentValue).toBe(325.5);
    expect(keyResult.startValue).toBe(100);
    expect(keyResult.progress).toBe(65.1);
  });

  it('defaults current_value, start_value, and progress to 0 when null, matching the NOT NULL DEFAULT 0 schema', () => {
    const keyResult = repo.toAggregate({
      ...baseRow,
      target_value: '500',
      current_value: null,
      start_value: null,
      progress: null,
    });

    expect(keyResult.currentValue).toBe(0);
    expect(keyResult.startValue).toBe(0);
    expect(keyResult.progress).toBe(0);
  });

  it('throws instead of silently constructing a key result with a corrupt target_value', () => {
    expect(() => repo.toAggregate({ ...baseRow, target_value: 'not-a-number', current_value: null, start_value: null, progress: null }))
      .toThrow(/Expected a numeric value/);
  });
});
