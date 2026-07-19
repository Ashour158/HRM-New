import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CompensationBand, type CompensationBandStatus } from '../aggregates/compensation-band.aggregate.js';
import { ActivateCompensationBandHandler } from './activate-compensation-band.handler.js';
import { ReviseCompensationBandHandler } from './revise-compensation-band.handler.js';
import { CloseCompensationBandHandler } from './close-compensation-band.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const bandId = new Uuid('00000000-0000-0000-0000-000000000010');
const actorId = new Uuid('00000000-0000-0000-0000-000000000011');

function buildBand(status: CompensationBandStatus): CompensationBand {
  return new CompensationBand({
    id: bandId,
    tenantId,
    bandCode: 'ENG-L5',
    jobLevel: 'L5',
    jobFamily: 'ENGINEERING',
    minSalary: 100000,
    midSalary: 130000,
    maxSalary: 160000,
    currency: 'USD',
    status,
  });
}

function buildCommand(commandName: string, payload: Record<string, unknown>): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: { actorType: 'USER', actorId, roles: ['COMPENSATION_ADMIN'], permissions: [], mfaAuthenticated: true },
    aggregateType: 'CompensationBand',
    aggregateId: bandId,
    idempotencyKey: `${commandName}-test`,
    correlationId: Uuid.generate(),
    reason: 'test',
    payload,
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

describe('ActivateCompensationBandHandler', () => {
  it('activates a DRAFT band', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const band = buildBand('DRAFT');
    findById.mockResolvedValue(band);
    const handler = new ActivateCompensationBandHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ActivateCompensationBand', { bandId }));

    expect(result).toMatchObject({ success: true, newState: 'ACTIVE', eventsEmitted: expect.arrayContaining(['CompensationBandActivated']) });
    expect(save).toHaveBeenCalledWith(band);
  });

  it('rejects activating a non-DRAFT band', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildBand('ACTIVE'));
    const handler = new ActivateCompensationBandHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ActivateCompensationBand', { bandId }))).rejects.toThrow(/Cannot activate CompensationBand from state ACTIVE/);
  });

  it('throws when band is not found', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(undefined);
    const handler = new ActivateCompensationBandHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ActivateCompensationBand', { bandId }))).rejects.toThrow('CompensationBand not found');
  });
});

describe('ReviseCompensationBandHandler', () => {
  it('revises salary ranges on an ACTIVE band', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const band = buildBand('ACTIVE');
    findById.mockResolvedValue(band);
    const handler = new ReviseCompensationBandHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ReviseCompensationBand', { bandId, minSalary: 110000, midSalary: 140000, maxSalary: 170000 }));

    expect(result).toMatchObject({
      success: true,
      newState: 'REVISED',
      data: { minSalary: 110000, midSalary: 140000, maxSalary: 170000 },
      eventsEmitted: expect.arrayContaining(['CompensationBandRevised']),
    });
    expect(save).toHaveBeenCalledWith(band);
  });

  it('rejects revising a DRAFT band', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildBand('DRAFT'));
    const handler = new ReviseCompensationBandHandler(repo as never, publisher as never, fsm as never);

    await expect(
      handler.handle(buildCommand('ReviseCompensationBand', { bandId, minSalary: 1, midSalary: 2, maxSalary: 3 })),
    ).rejects.toThrow(/Cannot revise CompensationBand from state DRAFT/);
  });

  it('rejects negative salary values', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildBand('ACTIVE'));
    const handler = new ReviseCompensationBandHandler(repo as never, publisher as never, fsm as never);

    await expect(
      handler.handle(buildCommand('ReviseCompensationBand', { bandId, minSalary: -1, midSalary: 2, maxSalary: 3 })),
    ).rejects.toThrow();
  });
});

describe('CloseCompensationBandHandler', () => {
  it('closes an ACTIVE band', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const band = buildBand('ACTIVE');
    findById.mockResolvedValue(band);
    const handler = new CloseCompensationBandHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('CloseCompensationBand', { bandId }));

    expect(result).toMatchObject({ success: true, newState: 'CLOSED', eventsEmitted: expect.arrayContaining(['CompensationBandClosed']) });
    expect(save).toHaveBeenCalledWith(band);
  });

  it('rejects closing a DRAFT band', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildBand('DRAFT'));
    const handler = new CloseCompensationBandHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('CloseCompensationBand', { bandId }))).rejects.toThrow(/Cannot close CompensationBand from state DRAFT/);
  });

  it('rejects closing an already CLOSED band (terminal state)', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildBand('CLOSED'));
    const handler = new CloseCompensationBandHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('CloseCompensationBand', { bandId }))).rejects.toThrow(/Cannot close CompensationBand from state CLOSED/);
  });
});
