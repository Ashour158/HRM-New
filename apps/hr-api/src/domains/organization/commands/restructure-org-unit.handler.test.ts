import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { OrgUnit } from '../aggregates/org-unit.aggregate.js';
import { OrgUnitFsm } from '../fsm/org-unit.fsm.js';
import { RestructureOrgUnitHandler } from './restructure-org-unit.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000099');

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

function command(orgUnitId: string, newParentOrgUnitId: string | null): HrCommandEnvelope<unknown> {
  return {
    commandId: new Uuid('00000000-0000-0000-0000-000000000abc'),
    commandName: 'RestructureOrgUnit',
    tenantId,
    correlationId,
    aggregateType: 'OrgUnit',
    actor: { actorType: 'USER', actorId: tenantId, roles: ['HR_ADMIN'], permissions: [], mfaAuthenticated: true },
    payload: { orgUnitId: new Uuid(orgUnitId), newParentOrgUnitId: newParentOrgUnitId ? new Uuid(newParentOrgUnitId) : newParentOrgUnitId },
  } as unknown as HrCommandEnvelope<unknown>;
}

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

  function buildHandler(units: Record<string, OrgUnit>) {
    const repo = {
      findById: vi.fn(async (id: Uuid) => units[id.value]),
      save: vi.fn(async () => undefined),
    };
    const fsm = { getAllowedActions: vi.fn(() => []) } as unknown as OrgUnitFsm;
    return { handler: new RestructureOrgUnitHandler(repo as never, fsm), repo };
  }

  it('rejects setting a unit as its own parent', async () => {
    const { handler } = buildHandler({ [A]: unit(A) });

    await expect(handler.handle(command(A, A))).rejects.toThrow(/cycle|own parent/i);
  });

  it('rejects a direct 2-unit cycle (B is currently a child of A; restructuring A under B)', async () => {
    const { handler } = buildHandler({
      [A]: unit(A),
      [B]: unit(B, A),
    });

    await expect(handler.handle(command(A, B))).rejects.toThrow(/cycle/i);
  });

  it('rejects a deeper cycle (A -> B -> C; restructuring A under C)', async () => {
    const { handler } = buildHandler({
      [A]: unit(A),
      [B]: unit(B, A),
      [C]: unit(C, B),
    });

    await expect(handler.handle(command(A, C))).rejects.toThrow(/cycle/i);
  });

  it('allows a legitimate restructure to an unrelated parent', async () => {
    const { handler, repo } = buildHandler({
      [root]: unit(root),
      [A]: unit(A, root),
      [B]: unit(B, root),
    });

    const result = await handler.handle(command(A, B));

    expect(result.success).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('allows restructuring to root (no parent)', async () => {
    const { handler, repo } = buildHandler({ [A]: unit(A, B), [B]: unit(B) });

    const result = await handler.handle(command(A, null));

    expect(result.success).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
