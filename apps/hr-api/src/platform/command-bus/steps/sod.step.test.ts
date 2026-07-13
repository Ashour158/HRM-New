import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { AccessControlService } from '@hcm/access-control';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { SodStep } from './sod.step.js';

// Characterization tests for the segregation-of-duties gate — previously
// untested directly against a CommandBus command envelope even though it
// runs on every command.

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');

function makeCommand(overrides: Partial<HrCommandEnvelope<unknown>> = {}): HrCommandEnvelope<unknown> {
  return {
    commandId: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
    commandName: 'InvestigateEmployeeRelationsCase',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid('550e8400-e29b-41d4-a716-446655440012'),
      roles: ['ER_SPECIALIST'],
      permissions: [],
      mfaAuthenticated: true,
    },
    aggregateType: 'EmployeeRelationsCase',
    aggregateId: new Uuid('550e8400-e29b-41d4-a716-446655440020'),
    idempotencyKey: 'idem-key',
    correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
    reason: 'test',
    payload: {},
    metadata: { requestHash: 'hash', clientType: 'ADMIN_CONSOLE' },
    ...overrides,
  } as HrCommandEnvelope<unknown>;
}

describe('SodStep', () => {
  it('blocks an actor holding both roles of an incompatible SoD pair', async () => {
    const step = new SodStep(new AccessControlService());

    await expect(step.evaluate(makeCommand({
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440012'),
        // MANAGER + ER_SPECIALIST is the ER_SUBJECT_MANAGER_CANNOT_INVESTIGATE
        // incompatible role pair in the SoD matrix.
        roles: ['MANAGER', 'ER_SPECIALIST'],
        permissions: [],
        mfaAuthenticated: true,
      },
    }))).rejects.toMatchObject({
      errorCode: 'SOD_VIOLATION',
    });
  });

  it('allows an actor without any conflicting SoD role pair', async () => {
    const step = new SodStep(new AccessControlService());

    await expect(step.evaluate(makeCommand())).resolves.toBeUndefined();
  });
});
