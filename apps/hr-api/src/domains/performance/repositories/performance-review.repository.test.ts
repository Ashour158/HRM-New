import { describe, expect, it } from 'vitest';
import { PerformanceReviewRepository } from './performance-review.repository.js';
import type { PerformanceReview } from '../aggregates/performance-review.aggregate.js';

describe('PerformanceReviewRepository numeric column mapping', () => {
  const repo = Object.create(PerformanceReviewRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): PerformanceReview;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000706',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    worker_id: '00000000-0000-0000-0000-000000000012',
    review_cycle_id: '00000000-0000-0000-0000-000000000050',
    manager_id: '00000000-0000-0000-0000-000000000013',
    self_review_content: null,
    manager_review_content: null,
    status: 'CALIBRATED',
    aggregate_version: 1,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
  };

  it('parses calibrated_rating and final_rating when Postgres returns NUMERIC as strings', () => {
    const review = repo.toAggregate({ ...baseRow, calibrated_rating: '4.5', final_rating: '4' });

    expect(review.calibratedRating).toBe(4.5);
    expect(review.finalRating).toBe(4);
  });

  it('leaves calibrated_rating and final_rating undefined when the column is null', () => {
    const review = repo.toAggregate({ ...baseRow, calibrated_rating: null, final_rating: null });

    expect(review.calibratedRating).toBeUndefined();
    expect(review.finalRating).toBeUndefined();
  });

  it('throws instead of silently constructing a review with a corrupt final_rating', () => {
    expect(() => repo.toAggregate({ ...baseRow, calibrated_rating: '4.5', final_rating: 'not-a-number' }))
      .toThrow(/Expected a numeric value/);
  });
});
