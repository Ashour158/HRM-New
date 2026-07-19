import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { TotalCompensationStatement, type TotalCompensationStatementStatus } from '../aggregates/total-compensation-statement.aggregate.js';
import { DeliverTotalCompensationStatementHandler } from './deliver-total-compensation-statement.handler.js';
import { AcknowledgeTotalCompensationStatementHandler } from './acknowledge-total-compensation-statement.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000070');
const statementId = new Uuid('00000000-0000-0000-0000-000000000071');
const actorId = new Uuid('00000000-0000-0000-0000-000000000072');

function buildStatement(status: TotalCompensationStatementStatus): TotalCompensationStatement {
  return new TotalCompensationStatement({
    id: statementId,
    tenantId,
    workerId,
    statementYear: 2026,
    baseSalary: 120000,
    bonusAmount: 15000,
    equityValue: 40000,
    benefitsValue: 20000,
    totalComp: 195000,
    currency: 'USD',
    status,
  });
}

function buildCommand(commandName: string): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: { actorType: 'USER', actorId, roles: ['COMPENSATION_ADMIN'], permissions: [], mfaAuthenticated: true },
    subjectWorkerId: workerId,
    aggregateType: 'TotalCompensationStatement',
    aggregateId: statementId,
    idempotencyKey: `${commandName}-test`,
    correlationId: Uuid.generate(),
    reason: 'test',
    payload: { statementId },
    metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
  };
}

function deps() {
  const findById = vi.fn();
  const save = vi.fn();
  const repo = { findById, save };
  const publisher = { publishAll: vi.fn() };
  const fsm = { getAllowedActions: vi.fn().mockReturnValue([]) };
  return { repo, publisher, fsm, findById, save };
}

describe('DeliverTotalCompensationStatementHandler', () => {
  it('delivers a GENERATED statement', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const statement = buildStatement('GENERATED');
    findById.mockResolvedValue(statement);
    const handler = new DeliverTotalCompensationStatementHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('DeliverTotalCompensationStatement'));

    expect(result).toMatchObject({
      success: true,
      newState: 'DELIVERED',
      data: { workerId: workerId.value },
      eventsEmitted: expect.arrayContaining(['TotalCompStatementDelivered']),
    });
    expect(save).toHaveBeenCalledWith(statement);
  });

  it('rejects delivering a DRAFT (not-yet-generated) statement', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildStatement('DRAFT'));
    const handler = new DeliverTotalCompensationStatementHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('DeliverTotalCompensationStatement'))).rejects.toThrow(/Cannot deliver TotalCompensationStatement from state DRAFT/);
  });

  it('throws when the statement does not exist', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(undefined);
    const handler = new DeliverTotalCompensationStatementHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('DeliverTotalCompensationStatement'))).rejects.toThrow('TotalCompensationStatement not found');
  });
});

describe('AcknowledgeTotalCompensationStatementHandler', () => {
  it('acknowledges a DELIVERED statement', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const statement = buildStatement('DELIVERED');
    findById.mockResolvedValue(statement);
    const handler = new AcknowledgeTotalCompensationStatementHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('AcknowledgeTotalCompensationStatement'));

    expect(result).toMatchObject({
      success: true,
      newState: 'ACKNOWLEDGED',
      data: { workerId: workerId.value },
      eventsEmitted: expect.arrayContaining(['TotalCompStatementAcknowledged']),
    });
    expect(save).toHaveBeenCalledWith(statement);
  });

  it('rejects acknowledging a GENERATED (not-yet-delivered) statement', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildStatement('GENERATED'));
    const handler = new AcknowledgeTotalCompensationStatementHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('AcknowledgeTotalCompensationStatement'))).rejects.toThrow(/Cannot acknowledge TotalCompensationStatement from state GENERATED/);
  });

  it('rejects re-acknowledging an already ACKNOWLEDGED statement (terminal state)', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildStatement('ACKNOWLEDGED'));
    const handler = new AcknowledgeTotalCompensationStatementHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('AcknowledgeTotalCompensationStatement'))).rejects.toThrow(/Cannot acknowledge TotalCompensationStatement from state ACKNOWLEDGED/);
  });
});
