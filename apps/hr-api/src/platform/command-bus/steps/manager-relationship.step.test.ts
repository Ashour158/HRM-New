import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { ManagerRelationshipStep } from './manager-relationship.step.js';

// Characterization tests for the manager/HRBP relationship gate — previously
// untested directly in command-bus.security.test.ts despite gating every
// MANAGER-initiated command.

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const managerId = new Uuid('550e8400-e29b-41d4-a716-446655440015');
const subjectWorkerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

function makeCommand(overrides: Partial<HrCommandEnvelope<unknown>> = {}): HrCommandEnvelope<unknown> {
  return {
    commandId: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
    commandName: 'ApproveAbsenceRequest',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: managerId,
      roles: ['MANAGER'],
      permissions: [],
      mfaAuthenticated: true,
    },
    aggregateType: 'AbsenceRequest',
    aggregateId: new Uuid('550e8400-e29b-41d4-a716-446655440020'),
    subjectWorkerId,
    idempotencyKey: 'idem-key',
    correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
    reason: 'test',
    payload: { workerId: subjectWorkerId },
    metadata: { requestHash: 'hash', clientType: 'MANAGER_PORTAL' },
    ...overrides,
  } as HrCommandEnvelope<unknown>;
}

function dbReturning(row: { id: string } | undefined) {
  const query = {
    select: () => query,
    where: () => query,
    executeTakeFirst: async () => row,
  };
  return { selectFrom: () => query };
}

describe('ManagerRelationshipStep', () => {
  it('does not check non-manager actors', async () => {
    const step = new ManagerRelationshipStep(dbReturning(undefined) as never);

    await expect(step.evaluate(makeCommand({
      actor: { actorType: 'USER', actorId: managerId, roles: ['EMPLOYEE'], permissions: [], mfaAuthenticated: true },
    }))).resolves.toBeUndefined();
  });

  it('bypasses the direct-report check for privileged roles even when also a manager', async () => {
    const step = new ManagerRelationshipStep(dbReturning(undefined) as never);

    await expect(step.evaluate(makeCommand({
      actor: { actorType: 'USER', actorId: managerId, roles: ['MANAGER', 'HR_ADMIN'], permissions: [], mfaAuthenticated: true },
    }))).resolves.toBeUndefined();
  });

  it('allows a manager to act on their direct report', async () => {
    const step = new ManagerRelationshipStep(dbReturning({ id: subjectWorkerId.value }) as never);

    await expect(step.evaluate(makeCommand())).resolves.toBeUndefined();
  });

  it('denies a manager acting on a worker who is not their direct report', async () => {
    const step = new ManagerRelationshipStep(dbReturning(undefined) as never);

    await expect(step.evaluate(makeCommand())).rejects.toMatchObject({
      errorCode: 'MANAGER_RELATIONSHIP_DENIED',
    });
  });

  it('does not check commands with no resolvable subject worker', async () => {
    const step = new ManagerRelationshipStep(dbReturning(undefined) as never);

    await expect(step.evaluate(makeCommand({
      subjectWorkerId: undefined,
      payload: {},
    }))).resolves.toBeUndefined();
  });
});
