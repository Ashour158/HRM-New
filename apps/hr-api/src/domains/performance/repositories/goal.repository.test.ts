import { describe, expect, it } from 'vitest';
import { GoalRepository } from './goal.repository.js';
import type { Goal } from '../aggregates/goal.aggregate.js';

describe('GoalRepository numeric column mapping', () => {
  const repo = Object.create(GoalRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): Goal;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000701',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    worker_id: '00000000-0000-0000-0000-000000000012',
    title: 'Ship the Q3 roadmap',
    description: null,
    unit: '%',
    start_date: null,
    due_date: null,
    smart_criteria: {},
    metric_name: null,
    review_cadence: null,
    evidence_required: false,
    status: 'ACTIVE',
    aggregate_version: 1,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
  };

  it('parses target_value, current_value, baseline_value, and weight when Postgres returns NUMERIC as strings', () => {
    // Previously these columns were passed through with zero conversion --
    // not even an `as number` cast -- because `toAggregate`'s row parameter
    // is (mis)typed `Record<string, never>`, which silences any type error
    // that would otherwise flag the mismatch. At runtime each of these is a
    // NUMERIC column, so node-postgres returns a string.
    const goal = repo.toAggregate({
      ...baseRow,
      target_value: '100.5',
      current_value: '42.25',
      baseline_value: '10',
      weight: '0.75',
    });

    expect(goal.targetValue).toBe(100.5);
    expect(goal.currentValue).toBe(42.25);
    expect(goal.baselineValue).toBe(10);
    expect(goal.weight).toBe(0.75);
    expect(typeof goal.targetValue).toBe('number');
  });

  it('leaves optional numeric fields undefined when the column is null', () => {
    const goal = repo.toAggregate({
      ...baseRow,
      target_value: null,
      current_value: null,
      baseline_value: null,
      weight: null,
    });

    expect(goal.targetValue).toBeUndefined();
    expect(goal.currentValue).toBeUndefined();
    expect(goal.baselineValue).toBeUndefined();
    expect(goal.weight).toBeUndefined();
  });

  it('throws instead of silently constructing a goal with a corrupt numeric field', () => {
    expect(() => repo.toAggregate({ ...baseRow, target_value: 'not-a-number', current_value: null, baseline_value: null, weight: null }))
      .toThrow(/Expected a numeric value/);
  });
});
