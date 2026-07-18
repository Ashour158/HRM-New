import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { EquityGrant, type EquityGrantStatus, type VestingScheduleEntry } from '../aggregates/equity-grant.aggregate.js';
import { StartEquityGrantVestingHandler } from './start-equity-grant-vesting.handler.js';
import { RecordEquityGrantVestingHandler } from './record-equity-grant-vesting.handler.js';
import { ExerciseEquityGrantHandler } from './exercise-equity-grant.handler.js';
import { ExpireEquityGrantHandler } from './expire-equity-grant.handler.js';
import { ForfeitEquityGrantHandler } from './forfeit-equity-grant.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000040');
const grantId = new Uuid('00000000-0000-0000-0000-000000000041');
const actorId = new Uuid('00000000-0000-0000-0000-000000000042');

const vestingSchedule: VestingScheduleEntry[] = [
  { date: new Date('2027-01-01'), percentage: 25, units: 250 },
  { date: new Date('2028-01-01'), percentage: 25, units: 250 },
  { date: new Date('2029-01-01'), percentage: 25, units: 250 },
  { date: new Date('2030-01-01'), percentage: 25, units: 250 },
];

function buildGrant(status: EquityGrantStatus, overrides: Partial<{ vestedUnits: number; exercisedUnits: number; totalUnits: number }> = {}): EquityGrant {
  return new EquityGrant({
    id: grantId,
    tenantId,
    workerId,
    grantType: 'RSU',
    grantDate: new Date('2026-01-01'),
    vestingSchedule,
    totalUnits: overrides.totalUnits ?? 1000,
    vestedUnits: overrides.vestedUnits ?? 0,
    exercisedUnits: overrides.exercisedUnits ?? 0,
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
    aggregateType: 'EquityGrant',
    aggregateId: grantId,
    idempotencyKey: `${commandName}-test`,
    correlationId: Uuid.generate(),
    reason: 'test',
    payload: { grantId, ...extraPayload },
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

describe('StartEquityGrantVestingHandler', () => {
  it('starts vesting on a GRANTED grant', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const grant = buildGrant('GRANTED');
    findById.mockResolvedValue(grant);
    const handler = new StartEquityGrantVestingHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('StartEquityGrantVesting'));

    expect(result).toMatchObject({ success: true, newState: 'VESTING', eventsEmitted: expect.arrayContaining(['EquityGrantVestingStarted']) });
    expect(save).toHaveBeenCalledWith(grant);
  });

  it('rejects starting vesting twice', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildGrant('VESTING'));
    const handler = new StartEquityGrantVestingHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('StartEquityGrantVesting'))).rejects.toThrow(/Cannot start vesting for EquityGrant from state VESTING/);
  });
});

describe('RecordEquityGrantVestingHandler', () => {
  it('records a first tranche of 250 units and stays VESTING', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const grant = buildGrant('VESTING');
    findById.mockResolvedValue(grant);
    const handler = new RecordEquityGrantVestingHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('RecordEquityGrantVesting', { units: 250 }));

    expect(result).toMatchObject({
      success: true,
      newState: 'VESTING',
      data: { vestedUnits: 250 },
      eventsEmitted: expect.arrayContaining(['EquityGrantVested']),
    });
    expect(grant.vestedUnits).toBe(250);
    expect(save).toHaveBeenCalledWith(grant);
  });

  it('auto-transitions to VESTED once cumulative vested units reach totalUnits', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const grant = buildGrant('VESTING', { vestedUnits: 750 });
    findById.mockResolvedValue(grant);
    const handler = new RecordEquityGrantVestingHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('RecordEquityGrantVesting', { units: 250 }));

    expect(result.newState).toBe('VESTED');
    expect(grant.vestedUnits).toBe(1000);
  });

  it('allows further RecordVesting calls once fully VESTED (idempotent tranche re-application is rejected by unit overflow, but same-state calls are allowed)', async () => {
    const { repo, publisher, fsm, findById } = deps();
    const grant = buildGrant('VESTED', { vestedUnits: 1000 });
    findById.mockResolvedValue(grant);
    const handler = new RecordEquityGrantVestingHandler(repo as never, publisher as never, fsm as never);

    // Recording 0 additional units is a valid no-op tranche (e.g. replay safety).
    const result = await handler.handle(buildCommand('RecordEquityGrantVesting', { units: 0 }));
    expect(result.newState).toBe('VESTED');
  });

  it('rejects vesting more units than totalUnits (arithmetic guard)', async () => {
    const { repo, publisher, fsm, findById } = deps();
    const grant = buildGrant('VESTING', { vestedUnits: 900 });
    findById.mockResolvedValue(grant);
    const handler = new RecordEquityGrantVestingHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('RecordEquityGrantVesting', { units: 200 }))).rejects.toThrow(/Invalid vesting units/);
    expect(grant.vestedUnits).toBe(900);
  });

  it('rejects negative vesting units', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildGrant('VESTING'));
    const handler = new RecordEquityGrantVestingHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('RecordEquityGrantVesting', { units: -50 }))).rejects.toThrow(/Invalid vesting units/);
  });

  it('rejects recording vesting on a GRANTED (not-yet-vesting) grant', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildGrant('GRANTED'));
    const handler = new RecordEquityGrantVestingHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('RecordEquityGrantVesting', { units: 100 }))).rejects.toThrow(/Cannot record vesting for EquityGrant from state GRANTED/);
  });
});

describe('ExerciseEquityGrantHandler', () => {
  it('exercises a partial amount of vested units', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const grant = buildGrant('VESTED', { vestedUnits: 500 });
    findById.mockResolvedValue(grant);
    const handler = new ExerciseEquityGrantHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ExerciseEquityGrant', { units: 200 }));

    expect(result).toMatchObject({
      success: true,
      newState: 'EXERCISED',
      data: { exercisedUnits: 200 },
      eventsEmitted: expect.arrayContaining(['EquityGrantExercised']),
    });
    expect(grant.exercisedUnits).toBe(200);
    expect(save).toHaveBeenCalledWith(grant);
  });

  it('accumulates exercised units across repeated calls', async () => {
    const { repo, publisher, fsm, findById } = deps();
    const grant = buildGrant('EXERCISED', { vestedUnits: 500, exercisedUnits: 200 });
    findById.mockResolvedValue(grant);
    const handler = new ExerciseEquityGrantHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ExerciseEquityGrant', { units: 150 }));

    expect(grant.exercisedUnits).toBe(350);
    expect(result.newState).toBe('EXERCISED');
  });

  it('rejects exercising more units than vested (arithmetic guard)', async () => {
    const { repo, publisher, fsm, findById } = deps();
    const grant = buildGrant('VESTED', { vestedUnits: 300, exercisedUnits: 250 });
    findById.mockResolvedValue(grant);
    const handler = new ExerciseEquityGrantHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ExerciseEquityGrant', { units: 100 }))).rejects.toThrow(/Cannot exercise more units than vested/);
    expect(grant.exercisedUnits).toBe(250);
  });

  it('rejects exercising before anything has vested', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildGrant('VESTING'));
    const handler = new ExerciseEquityGrantHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ExerciseEquityGrant', { units: 10 }))).rejects.toThrow(/Cannot exercise EquityGrant from state VESTING/);
  });
});

describe('ExpireEquityGrantHandler', () => {
  it('expires a VESTED grant', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const grant = buildGrant('VESTED');
    findById.mockResolvedValue(grant);
    const handler = new ExpireEquityGrantHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ExpireEquityGrant'));

    expect(result).toMatchObject({ success: true, newState: 'EXPIRED', eventsEmitted: expect.arrayContaining(['EquityGrantExpired']) });
    expect(save).toHaveBeenCalledWith(grant);
  });

  it('rejects expiring an already FORFEITED grant (terminal state)', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildGrant('FORFEITED'));
    const handler = new ExpireEquityGrantHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ExpireEquityGrant'))).rejects.toThrow(/Cannot expire EquityGrant from state FORFEITED/);
  });
});

describe('ForfeitEquityGrantHandler', () => {
  it('forfeits a VESTING grant', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const grant = buildGrant('VESTING');
    findById.mockResolvedValue(grant);
    const handler = new ForfeitEquityGrantHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ForfeitEquityGrant'));

    expect(result).toMatchObject({ success: true, newState: 'FORFEITED', eventsEmitted: expect.arrayContaining(['EquityGrantForfeited']) });
    expect(save).toHaveBeenCalledWith(grant);
  });

  it('rejects forfeiting an EXERCISED grant', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildGrant('EXERCISED'));
    const handler = new ForfeitEquityGrantHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ForfeitEquityGrant'))).rejects.toThrow(/Cannot forfeit EquityGrant from state EXERCISED/);
  });
});
