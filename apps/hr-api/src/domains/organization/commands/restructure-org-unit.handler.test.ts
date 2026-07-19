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

/** Permissive stub for tests that aren't exercising the works-council guard itself. */
function passingGuard(): WorksCouncilConsultationGuard {
  return { assertNotBlocked: vi.fn().mockResolvedValue(undefined) } as unknown as WorksCouncilConsultationGuard;
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

/**
 * HCM-P0-6: without ancestor-chain validation, RestructureOrgUnit could set
 * a unit as its own parent, or two units as each other's parent.
 * OrgUnitRepository.findTree() then builds a real JS circular reference,
 * and res.json() on any org-tree endpoint throws "Converting circular
 * structure to JSON" -- an unhandled 500 for the whole tenant.
 */
describe('RestructureOrgUnitHandler cycle prevention', () => {
  const A = '00000000-0000-0000-0000-0000000000a1';
  const B = '00000000-0000-0000-0000-0000000000a2';
  const C = '00000000-0000-0000-0000-0000000000a3';
  const root = '00000000-0000-0000-0000-0000000000a0';
  const cycleCorrelationId = new Uuid('00000000-0000-0000-0000-000000000099');

  function unit(id: string, parentId?: string): OrgUnit {
    return OrgUnit.rehydrate({
      id: new Uuid(id),
      tenantId,
      name: `Unit ${id.slice(-2)}`,
      code: null,
      parentId: parentId ? new Uuid(parentId) : undefined,
      legalEntityId: undefined,
      level: 0,
      path: null,
      status: 'ACTIVE',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      version: 1,
    });
  }

  function cycleCommand(unitId: string, newParentOrgUnitId: string | null): HrCommandEnvelope<unknown> {
    return {
      commandId: new Uuid('00000000-0000-0000-0000-000000000abc'),
      commandName: 'RestructureOrgUnit',
      tenantId,
      correlationId: cycleCorrelationId,
      aggregateType: 'OrgUnit',
      actor: { actorType: 'USER', actorId: tenantId, roles: ['HR_ADMIN'], permissions: [], mfaAuthenticated: true },
      payload: { orgUnitId: new Uuid(unitId), newParentOrgUnitId: newParentOrgUnitId ? new Uuid(newParentOrgUnitId) : newParentOrgUnitId },
    } as unknown as HrCommandEnvelope<unknown>;
  }

  function buildHandler(units: Record<string, OrgUnit>) {
    const repo = {
      findById: vi.fn(async (id: Uuid) => units[id.value]),
      save: vi.fn(async () => undefined),
    };
    const fsmInstance = { getAllowedActions: vi.fn(() => []) } as unknown as OrgUnitFsm;
    return { handler: new RestructureOrgUnitHandler(repo as never, fsmInstance, passingGuard()), repo };
  }

  it('rejects setting a unit as its own parent', async () => {
    const { handler } = buildHandler({ [A]: unit(A) });

    await expect(handler.handle(cycleCommand(A, A))).rejects.toThrow(/cycle|own parent/i);
  });

  it('rejects a direct 2-unit cycle (B is currently a child of A; restructuring A under B)', async () => {
    const { handler } = buildHandler({
      [A]: unit(A),
      [B]: unit(B, A),
    });

    await expect(handler.handle(cycleCommand(A, B))).rejects.toThrow(/cycle/i);
  });

  it('rejects a deeper cycle (A -> B -> C; restructuring A under C)', async () => {
    const { handler } = buildHandler({
      [A]: unit(A),
      [B]: unit(B, A),
      [C]: unit(C, B),
    });

    await expect(handler.handle(cycleCommand(A, C))).rejects.toThrow(/cycle/i);
  });

  it('allows a legitimate restructure to an unrelated parent', async () => {
    const { handler, repo } = buildHandler({
      [root]: unit(root),
      [A]: unit(A, root),
      [B]: unit(B, root),
    });

    const result = await handler.handle(cycleCommand(A, B));

    expect(result.success).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('allows restructuring to root (no parent)', async () => {
    const { handler, repo } = buildHandler({ [A]: unit(A, B), [B]: unit(B) });

    const result = await handler.handle(cycleCommand(A, null));

    expect(result.success).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
