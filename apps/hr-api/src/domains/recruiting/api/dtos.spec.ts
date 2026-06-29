import { describe, expect, it } from 'vitest';
import { CreateOfferDtoSchema } from './dtos.js';

// CreateOfferHandler resolves the candidate (and its requisition) from applicationId,
// so the offer-create contract must require it. This locks that contract so a future
// edit can't silently drop the candidate linkage again.
describe('CreateOfferDtoSchema', () => {
  const valid = {
    offerId: '11111111-1111-1111-1111-111111111111',
    applicationId: '22222222-2222-2222-2222-222222222222',
    proposedSalary: 120000,
    currency: 'USD',
    startDate: '2026-07-01T00:00:00.000Z',
  };

  it('accepts a payload with a candidate applicationId', () => {
    const parsed = CreateOfferDtoSchema.parse(valid);
    expect(parsed.applicationId).toBe(valid.applicationId);
  });

  it('rejects a payload missing applicationId', () => {
    const withoutApplication: Partial<typeof valid> = { ...valid };
    delete withoutApplication.applicationId;
    expect(() => CreateOfferDtoSchema.parse(withoutApplication)).toThrow();
  });

  it('rejects a non-uuid applicationId', () => {
    expect(() => CreateOfferDtoSchema.parse({ ...valid, applicationId: 'not-a-uuid' })).toThrow();
  });
});
