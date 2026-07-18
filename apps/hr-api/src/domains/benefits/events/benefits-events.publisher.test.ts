import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { BenefitsEventsPublisher } from './benefits-events.publisher.js';
import { BenefitsProgram } from '../aggregates/benefits-program.aggregate.js';
import { CreateBenefitsProgramHandler } from '../commands/create-benefits-program.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const commandId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const programId = new Uuid('00000000-0000-0000-0000-000000000005');

function command(payload: unknown, overrides: Partial<HrCommandEnvelope<unknown>> = {}): HrCommandEnvelope<unknown> {
  return {
    commandId,
    commandName: 'CreateBenefitsProgram',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['HR_ADMIN'],
      permissions: ['benefits:write'],
      mfaAuthenticated: true,
    },
    aggregateType: 'BenefitsProgram',
    idempotencyKey: 'benefits-command-key',
    correlationId,
    reason: 'benefits smoke',
    payload,
    metadata: {
      requestHash: 'request-hash',
      clientType: 'HR_ADMIN',
      hrDataSensitivity: 'LOW',
    },
    ...overrides,
  };
}

describe('BenefitsEventsPublisher', () => {
  it('leaves benefits domain events for the CommandBus outbox lane instead of direct EventBus publication', async () => {
    const eventBus = { publishAll: vi.fn(async () => undefined) };
    const publisher = new BenefitsEventsPublisher();
    const program = BenefitsProgram.create({
      id: programId,
      tenantId,
      programName: 'Medical',
      programType: 'HEALTH',
      monthlyPremium: 350,
      currency: 'USD',
      correlationId,
    });

    await publisher.publishAll(program, command({ programId }));

    expect(eventBus.publishAll).not.toHaveBeenCalled();
    expect(program.domainEvents.map((event) => event.eventName)).toEqual(['BenefitsProgramCreated']);
  });

  it('keeps benefits workflow events on the command result for CommandBus outbox writing', async () => {
    const repo = { save: vi.fn(async () => undefined) };
    const publisher = new BenefitsEventsPublisher();
    const fsm = { getAllowedActions: vi.fn(() => ['Activate']) };
    const handler = new CreateBenefitsProgramHandler(repo as never, publisher, fsm as never);

    const result = await handler.handle(command({
      programId,
      programName: 'Medical',
      programType: 'HEALTH',
    }));

    expect(result).toEqual(expect.objectContaining({
      success: true,
      aggregateId: programId,
      newState: 'DRAFT',
      eventsEmitted: ['BenefitsProgramCreated'],
    }));
  });
});
