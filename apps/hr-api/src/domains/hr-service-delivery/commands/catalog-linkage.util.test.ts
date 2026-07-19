import { describe, expect, it } from 'vitest';
import { deriveOwnerGroupFromCatalogItem, deriveSlaDeadlineFromCatalogItem } from './catalog-linkage.util.js';

describe('deriveSlaDeadlineFromCatalogItem', () => {
  it('adds the catalog item slaHours (in hours) to the reference time', () => {
    const reference = new Date('2026-07-13T00:00:00.000Z');
    const deadline = deriveSlaDeadlineFromCatalogItem({ slaHours: 24 }, reference);
    expect(deadline.toISOString()).toBe('2026-07-14T00:00:00.000Z');
  });

  it('supports fractional and long SLA windows', () => {
    const reference = new Date('2026-07-13T00:00:00.000Z');
    expect(deriveSlaDeadlineFromCatalogItem({ slaHours: 0.5 }, reference).toISOString()).toBe('2026-07-13T00:30:00.000Z');
    expect(deriveSlaDeadlineFromCatalogItem({ slaHours: 72 }, reference).toISOString()).toBe('2026-07-16T00:00:00.000Z');
  });

  it('defaults the reference time to now when omitted', () => {
    const before = Date.now();
    const deadline = deriveSlaDeadlineFromCatalogItem({ slaHours: 1 });
    const after = Date.now();
    expect(deadline.getTime()).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
    expect(deadline.getTime()).toBeLessThanOrEqual(after + 60 * 60 * 1000);
  });
});

describe('deriveOwnerGroupFromCatalogItem', () => {
  it('prefers the explicit default owner group over category', () => {
    expect(deriveOwnerGroupFromCatalogItem({ defaultOwnerGroup: 'Payroll Escalations', category: 'Payroll' })).toBe('Payroll Escalations');
  });

  it('falls back to category when no default owner group is configured', () => {
    expect(deriveOwnerGroupFromCatalogItem({ category: 'Benefits' })).toBe('Benefits');
  });

  it('treats whitespace-only values as absent', () => {
    expect(deriveOwnerGroupFromCatalogItem({ defaultOwnerGroup: '   ', category: 'Benefits' })).toBe('Benefits');
    expect(deriveOwnerGroupFromCatalogItem({ defaultOwnerGroup: '   ', category: '   ' })).toBeUndefined();
  });

  it('returns undefined when neither is configured', () => {
    expect(deriveOwnerGroupFromCatalogItem({})).toBeUndefined();
  });
});
