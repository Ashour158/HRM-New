import { describe, expect, it, vi } from 'vitest';
import { RestructureOrgUnitHandler } from './restructure-org-unit.handler.js';
import { OrgUnit } from '../aggregates/org-unit.aggregate.js';
import type { OrgUnitRepository } from '../repositories/org-unit.repository.js';
import type { OrgUnitFsm } from '../fsm/org-unit.fsm.js';
import type { WorksCouncilConsultationGuard } from '../../global-hr/services/works-council-consultation-guard.service.js';
import type { HrCommandEnvelope, RestructureOrgUnitPayload } from '@hcm/command-contracts';
import { Uuid, ConflictError } from '@hcm/shared-kernel';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const orgUnitId = new Uuid('00000000-0000-0000-0000-000000000200');
const legalEntityId = new Uuid('00000000-0000-0000-0000-000000000100');

function makeOrgUnit(overrides: Partial<{ legalEntityId?: Uuid }> = {}): OrgUnit {
  return OrgUnit.restore({
    id: orgUnitId,
    tenantId,
    name: 'People Operations',
    code: 'PEOPLE',
    parentId: undefined,
    legalEntityId: 'legalEntityId' in overrides ? overrides.legalEntityId : legalEntityId,
    level: 0,
    path: '/People Operations',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    version: 2,
  });
}

function command(payload: Partial<RestructureOrgUnitPayload> = {}): HrCommandEnvelope<unknown> {
  return {
    payload: { orgUnitId, newParentOrgUnitId: undefined, newName: 'Reorganized People Ops', ...payload },
    tenantId,
    correlationId: Uuid.generate(),
    commandId: Uuid.generate(),
  } as unknown as HrCommandEnvelope<unknown>;
}

function fsm() {
  return { getAllowedActions: vi.fn(() => ['Dissolve']) } as unknown as OrgUnitFsm;
}

describe('RestructureOrgUnitHandler', () => {
  it('blocks restructuring when the org unit legal entity has an incomplete works-council consultation', async () => {
    const entity = makeOrgUnit();
    const repo = { findById: vi.fn().mockResolvedValue(entity), save: vi.fn() } as unknown as OrgUnitRepository;
    const guard = {
      assertNotBlocked: vi.fn().mockRejectedValue(new ConflictError('blocked')),
    } as unknown as WorksCouncilConsultationGuard;
    const handler = new RestructureOrgUnitHandler(repo, fsm(), guard);

    await expect(handler.handle(command())).rejects.toBeInstanceOf(ConflictError);
    expect(guard.assertNotBlocked).toHaveBeenCalledWith(legalEntityId, tenantId, 'restructure org unit');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('succeeds once the blocking consultation has completed (guard passes)', async () => {
    const entity = makeOrgUnit();
    const repo = { findById: vi.fn().mockResolvedValue(entity), save: vi.fn() } as unknown as OrgUnitRepository;
    const guard = { assertNotBlocked: vi.fn().mockResolvedValue(undefined) } as unknown as WorksCouncilConsultationGuard;
    const handler = new RestructureOrgUnitHandler(repo, fsm(), guard);

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(entity.name).toBe('Reorganized People Ops');
    expect(repo.save).toHaveBeenCalledWith(entity);
  });

  it('succeeds normally when the org unit has no legal entity on file (guard not scoped, not consulted)', async () => {
    const entity = makeOrgUnit({ legalEntityId: undefined });
    const repo = { findById: vi.fn().mockResolvedValue(entity), save: vi.fn() } as unknown as OrgUnitRepository;
    const guard = { assertNotBlocked: vi.fn() } as unknown as WorksCouncilConsultationGuard;
    const handler = new RestructureOrgUnitHandler(repo, fsm(), guard);

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(guard.assertNotBlocked).not.toHaveBeenCalled();
  });
});
