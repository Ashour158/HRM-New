import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { PayScale, type PayScaleStatus, type PayScaleStep } from '../aggregates/pay-scale.aggregate.js';
import { ActivatePayScaleHandler } from './activate-pay-scale.handler.js';
import { RevisePayScaleHandler } from './revise-pay-scale.handler.js';
import { ClosePayScaleHandler } from './close-pay-scale.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const scaleId = new Uuid('00000000-0000-0000-0000-000000000050');
const actorId = new Uuid('00000000-0000-0000-0000-000000000051');

const steps: PayScaleStep[] = [
  { stepNumber: 1, amount: 50000 },
  { stepNumber: 2, amount: 55000 },
];

function buildScale(status: PayScaleStatus): PayScale {
  return new PayScale({
    id: scaleId,
    tenantId,
    scaleCode: 'GRADE-3',
    grade: 'G3',
    steps,
    currency: 'USD',
    status,
  });
}

function buildCommand(commandName: string, extraPayload: Record<string, unknown> = {}): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: { actorType: 'USER', actorId, roles: ['COMPENSATION_ADMIN'], permissions: [], mfaAuthenticated: true },
    aggregateType: 'PayScale',
    aggregateId: scaleId,
    idempotencyKey: `${commandName}-test`,
    correlationId: Uuid.generate(),
    reason: 'test',
    payload: { scaleId, ...extraPayload },
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

describe('ActivatePayScaleHandler', () => {
  it('activates a DRAFT scale', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const scale = buildScale('DRAFT');
    findById.mockResolvedValue(scale);
    const handler = new ActivatePayScaleHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ActivatePayScale'));

    expect(result).toMatchObject({ success: true, newState: 'ACTIVE', eventsEmitted: expect.arrayContaining(['PayScaleActivated']) });
    expect(save).toHaveBeenCalledWith(scale);
  });

  it('rejects activating a CLOSED scale', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildScale('CLOSED'));
    const handler = new ActivatePayScaleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ActivatePayScale'))).rejects.toThrow(/Cannot activate PayScale from state CLOSED/);
  });
});

describe('RevisePayScaleHandler', () => {
  it('revises the step progression of an ACTIVE scale', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const scale = buildScale('ACTIVE');
    findById.mockResolvedValue(scale);
    const handler = new RevisePayScaleHandler(repo as never, publisher as never, fsm as never);
    const newSteps: PayScaleStep[] = [{ stepNumber: 1, amount: 52000 }, { stepNumber: 2, amount: 58000 }, { stepNumber: 3, amount: 63000 }];

    const result = await handler.handle(buildCommand('RevisePayScale', { steps: newSteps }));

    expect(result).toMatchObject({ success: true, newState: 'REVISED', eventsEmitted: expect.arrayContaining(['PayScaleRevised']) });
    expect(scale.steps).toEqual(newSteps);
    expect(save).toHaveBeenCalledWith(scale);
  });

  it('rejects revising with an empty step list', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildScale('ACTIVE'));
    const handler = new RevisePayScaleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('RevisePayScale', { steps: [] }))).rejects.toThrow(/Pay scale must have at least one step/);
  });

  it('rejects revising a DRAFT scale', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildScale('DRAFT'));
    const handler = new RevisePayScaleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('RevisePayScale', { steps }))).rejects.toThrow(/Cannot revise PayScale from state DRAFT/);
  });
});

describe('ClosePayScaleHandler', () => {
  it('closes an ACTIVE scale', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const scale = buildScale('ACTIVE');
    findById.mockResolvedValue(scale);
    const handler = new ClosePayScaleHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ClosePayScale'));

    expect(result).toMatchObject({ success: true, newState: 'CLOSED', eventsEmitted: expect.arrayContaining(['PayScaleClosed']) });
    expect(save).toHaveBeenCalledWith(scale);
  });

  it('rejects closing a DRAFT scale', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildScale('DRAFT'));
    const handler = new ClosePayScaleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ClosePayScale'))).rejects.toThrow(/Cannot close PayScale from state DRAFT/);
  });
});
