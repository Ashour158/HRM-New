import { describe, expect, it } from 'vitest';
import { ConflictError, Uuid } from '@hcm/shared-kernel';
import { OrgUnit } from './org-unit.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000099');

function activeOrgUnit(id: string, parentId?: Uuid): OrgUnit {
  return OrgUnit.rehydrate({
    id: new Uuid(id),
    tenantId,
    name: 'Engineering',
    code: null,
    parentId,
    legalEntityId: undefined,
    level: 0,
    path: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    version: 1,
  });
}

/**
 * HCM-P0-6: OrgUnitRepository.findTree() builds a real JS object-reference
 * tree from parentId relationships -- an org unit set as its own parent
 * (or two units set as each other's parent) produces a genuine circular
 * reference, and res.json() throws "Converting circular structure to
 * JSON" for the whole tenant. This is the cheapest layer of defense (no
 * DB access available in the aggregate); the full ancestor-chain check
 * lives in RestructureOrgUnitHandler.
 */
describe('OrgUnit.restructure self-parent guard', () => {
  it('rejects restructuring an org unit to be its own parent', () => {
    const unit = activeOrgUnit('00000000-0000-0000-0000-0000000000a1');

    expect(() =>
      unit.restructure(new Uuid('00000000-0000-0000-0000-0000000000a1'), undefined, correlationId),
    ).toThrow(ConflictError);
  });

  it('allows restructuring to a different parent', () => {
    const unit = activeOrgUnit('00000000-0000-0000-0000-0000000000a1');
    const newParentId = new Uuid('00000000-0000-0000-0000-0000000000a2');

    expect(() => unit.restructure(newParentId, undefined, correlationId)).not.toThrow();
    expect(unit.parentId?.value).toBe(newParentId.value);
  });

  it('allows clearing the parent (restructure to root)', () => {
    const unit = activeOrgUnit('00000000-0000-0000-0000-0000000000a1', new Uuid('00000000-0000-0000-0000-0000000000a2'));

    expect(() => unit.restructure(null, undefined, correlationId)).not.toThrow();
    expect(unit.parentId).toBeUndefined();
  });
});
