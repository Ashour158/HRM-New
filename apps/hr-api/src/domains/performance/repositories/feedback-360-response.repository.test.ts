import { describe, expect, it } from 'vitest';
import { Feedback360ResponseRepository } from './feedback-360-response.repository.js';
import type { Feedback360Response } from '../aggregates/feedback-360-response.aggregate.js';

describe('Feedback360ResponseRepository numeric column mapping', () => {
  const repo = Object.create(Feedback360ResponseRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): Feedback360Response;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000707',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    cycle_id: '00000000-0000-0000-0000-000000000060',
    reviewee_id: '00000000-0000-0000-0000-000000000012',
    reviewer_id: '00000000-0000-0000-0000-000000000013',
    relationship_type: 'PEER',
    status: 'SUBMITTED',
    competency_scores: null,
    strengths: null,
    improvements: null,
    comments: null,
    dimension_scores: null,
    area_comments: null,
    visibility: 'ANONYMOUS',
    is_anonymous: true,
    submitted_at: new Date('2026-06-01T00:00:00.000Z'),
    withdrawn_at: null,
    aggregate_version: 1,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
  };

  it('parses overall_rating when Postgres returns the NUMERIC column as a string', () => {
    const response = repo.toAggregate({ ...baseRow, overall_rating: '4.25' });
    expect(response.overallRating).toBe(4.25);
  });

  it('leaves overall_rating undefined when the column is null', () => {
    const response = repo.toAggregate({ ...baseRow, overall_rating: null });
    expect(response.overallRating).toBeUndefined();
  });

  it('throws instead of silently constructing a response with a corrupt overall_rating', () => {
    expect(() => repo.toAggregate({ ...baseRow, overall_rating: 'not-a-number' }))
      .toThrow(/Expected a numeric value/);
  });
});
