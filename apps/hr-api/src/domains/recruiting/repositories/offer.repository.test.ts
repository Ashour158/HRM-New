import { describe, expect, it } from 'vitest';
import { OfferRepository } from './offer.repository.js';
import type { Offer } from '../aggregates/offer.aggregate.js';

describe('OfferRepository proposed_salary mapping', () => {
  const repo = Object.create(OfferRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): Offer;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000901',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    candidate_id: '00000000-0000-0000-0000-000000000010',
    requisition_id: '00000000-0000-0000-0000-000000000020',
    currency: 'USD',
    start_date: '2026-08-01T00:00:00.000Z',
    benefits_package: null,
    status: 'DRAFT',
    sent_at: null,
    accepted_at: null,
    declined_at: null,
    proposed_by: null,
    approved_by: null,
    aggregate_version: 0,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };

  it('parses proposed_salary as a genuine number when Postgres returns the NUMERIC column as a string', () => {
    // This is the exact bug: `row.proposed_salary as number` is a type-only
    // cast -- it does not convert. node-postgres returns NUMERIC columns as
    // strings, so without parseNumeric, `offer.proposedSalary` would
    // actually hold the string "125000.50" at runtime despite the `number`
    // type, and `offer.proposedSalary + 1000` would string-concatenate
    // ("125000.501000") instead of adding (126000.5).
    const offer = repo.toAggregate({ ...baseRow, proposed_salary: '125000.50' });

    expect(typeof offer.proposedSalary).toBe('number');
    expect(offer.proposedSalary).toBe(125000.5);
    expect(offer.proposedSalary + 1000).toBe(126000.5);
  });

  it('throws instead of silently constructing an offer with a corrupt salary', () => {
    expect(() => repo.toAggregate({ ...baseRow, proposed_salary: 'not-a-number' })).toThrow(/Expected a numeric value/);
  });
});
