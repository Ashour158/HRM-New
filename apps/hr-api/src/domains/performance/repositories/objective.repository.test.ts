import { describe, expect, it } from 'vitest';
import { ObjectiveRepository } from './objective.repository.js';
import type { Objective } from '../aggregates/objective.aggregate.js';

describe('ObjectiveRepository numeric column mapping', () => {
  const repo = Object.create(ObjectiveRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): Objective;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000705',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    owner_id: '00000000-0000-0000-0000-000000000012',
    org_unit_id: null,
    parent_objective_id: null,
    review_cycle_id: null,
    title: 'Grow enterprise pipeline',
    description: null,
    period: '2026-Q3',
    status: 'IN_PROGRESS',
    alignment_type: null,
    aggregate_version: 1,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
  };

  it('parses confidence_score and progress when Postgres returns NUMERIC as strings', () => {
    const objective = repo.toAggregate({ ...baseRow, confidence_score: '0.82', progress: '55.5' });

    expect(objective.confidenceScore).toBe(0.82);
    expect(objective.progress).toBe(55.5);
  });

  it('defaults progress to 0 and leaves confidence_score undefined when null', () => {
    const objective = repo.toAggregate({ ...baseRow, confidence_score: null, progress: null });

    expect(objective.confidenceScore).toBeUndefined();
    expect(objective.progress).toBe(0);
  });

  it('throws instead of silently constructing an objective with a corrupt progress value', () => {
    expect(() => repo.toAggregate({ ...baseRow, confidence_score: null, progress: 'not-a-number' }))
      .toThrow(/Expected a numeric value/);
  });
});
