import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';
import { BenefitsProgram } from '../aggregates/benefits-program.aggregate.js';
import { CreateBenefitsProgramHandler } from './create-benefits-program.handler.js';
import { ActivateBenefitsProgramHandler } from './activate-benefits-program.handler.js';
import { SuspendBenefitsProgramHandler } from './suspend-benefits-program.handler.js';
import { CloseBenefitsProgramHandler } from './close-benefits-program.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const commandId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const programId = new Uuid('00000000-0000-0000-0000-000000000006');

function command(commandName: string, payload: unknown, aggregateId?: Uuid): HrCommandEnvelope<unknown> {
  return {
    commandId,
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['BENEFITS_ADMIN'],
      permissions: ['benefits:write'],
      mfaAuthenticated: true,
    },
    aggregateType: 'BenefitsProgram',
    aggregateId,
    idempotencyKey: `${commandName}-key`,
    correlationId,
    reason: 'benefits program lifecycle test',
    payload,
    metadata: {
      requestHash: `${commandName}-hash`,
      clientType: 'HR_ADMIN',
      hrDataSensitivity: 'LOW',
    },
  };
}

function program(status: BenefitsProgram['status']) {
  return new BenefitsProgram({
    id: programId,
    tenantId,
    programName: 'Premium PPO',
    programType: 'MEDICAL',
    monthlyPremium: 450,
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

describe('BenefitsProgram lifecycle command handlers', () => {
  it('creates a DRAFT program with a zero premium by default so activation is required before enrollment can price coverage', async () => {
    const repo = { save: vi.fn(async () => undefined) };
    const handler = new CreateBenefitsProgramHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['Activate']) } as never,
      { getSetup: vi.fn(async () => ({ locations: [{ active: true, currency: 'USD' }] })) } as never,
    );

    const result = await handler.handle(command('CreateBenefitsProgram', {
      programId,
      programName: 'Premium PPO',
      programType: 'MEDICAL',
    }));

    const saved = repo.save.mock.calls[0]?.[0] as BenefitsProgram;
    expect(saved.status).toBe('DRAFT');
    expect(saved.monthlyPremium).toBe(0);
    expect(saved.currency).toBe('USD');
    expect(result).toEqual(expect.objectContaining({
      newState: 'DRAFT',
      eventsEmitted: ['BenefitsProgramCreated'],
    }));
  });

  it('creates a program with the given monthlyPremium/currency', async () => {
    const repo = { save: vi.fn(async () => undefined) };
    const handler = new CreateBenefitsProgramHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['Activate']) } as never,
      { getSetup: vi.fn(async () => ({ locations: [{ active: true, currency: 'USD' }] })) } as never,
    );

    const result = await handler.handle(command('CreateBenefitsProgram', {
      programId,
      programName: 'Premium PPO',
      programType: 'MEDICAL',
      monthlyPremium: 450,
      currency: 'USD',
    }));

    expect(result.data).toEqual(expect.objectContaining({ monthlyPremium: 450, currency: 'USD' }));
  });

  it('activates a DRAFT program through the canonical aggregate, making it eligible for enrollment', async () => {
    const existing = program('DRAFT');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new ActivateBenefitsProgramHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['Suspend', 'Close']) } as never,
    );

    const result = await handler.handle(command('ActivateBenefitsProgram', { benefitsProgramId: programId }, programId));

    expect(repo.findById).toHaveBeenCalledWith(programId);
    expect(existing.status).toBe('ACTIVE');
    expect(result).toEqual(expect.objectContaining({
      newState: 'ACTIVE',
      eventsEmitted: ['BenefitsProgramActivated'],
    }));
  });

  it('rejects activation of an already-CLOSED (terminal) program', async () => {
    const existing = program('CLOSED');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new ActivateBenefitsProgramHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('ActivateBenefitsProgram', { benefitsProgramId: programId }, programId))).rejects.toThrow(
      'Cannot activate BenefitsProgram from state CLOSED',
    );
  });

  it('suspends an ACTIVE program, blocking new enrollment while preserving existing coverage', async () => {
    const existing = program('ACTIVE');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new SuspendBenefitsProgramHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['Activate', 'Close']) } as never,
    );

    const result = await handler.handle(command('SuspendBenefitsProgram', { benefitsProgramId: programId, reason: 'carrier renegotiation' }, programId));

    expect(existing.status).toBe('SUSPENDED');
    expect(result).toEqual(expect.objectContaining({
      newState: 'SUSPENDED',
      eventsEmitted: ['BenefitsProgramSuspended'],
    }));
    expect(result.data).toEqual(expect.objectContaining({ reason: 'carrier renegotiation' }));
  });

  it('closes an ACTIVE program permanently', async () => {
    const existing = program('ACTIVE');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new CloseBenefitsProgramHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('CloseBenefitsProgram', { benefitsProgramId: programId, reason: 'plan discontinued' }, programId));

    expect(existing.status).toBe('CLOSED');
    expect(result).toEqual(expect.objectContaining({
      newState: 'CLOSED',
      eventsEmitted: ['BenefitsProgramClosed'],
    }));
    // BenefitsCarrierConsumer keys off `programId` in this payload to
    // auto-terminate remaining enrollments -- it must always be present.
    expect(result.data).toEqual(expect.objectContaining({ programId: programId.value, status: 'CLOSED' }));
  });

  it('closes a SUSPENDED program permanently', async () => {
    const existing = program('SUSPENDED');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new CloseBenefitsProgramHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('CloseBenefitsProgram', { benefitsProgramId: programId }, programId));

    expect(existing.status).toBe('CLOSED');
    expect(result.eventsEmitted).toEqual(['BenefitsProgramClosed']);
  });

  it('rejects closing a DRAFT program (never activated)', async () => {
    const existing = program('DRAFT');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new CloseBenefitsProgramHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('CloseBenefitsProgram', { benefitsProgramId: programId }, programId))).rejects.toThrow(
      'Cannot close BenefitsProgram from state DRAFT',
    );
  });

  it('rejects activating/suspending/closing a program that does not exist', async () => {
    const repo = { findById: vi.fn(async () => undefined), save: vi.fn(async () => undefined) };
    const handler = new ActivateBenefitsProgramHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('ActivateBenefitsProgram', { benefitsProgramId: programId }, programId))).rejects.toThrow(
      'BenefitsProgram not found',
    );
  });
});
