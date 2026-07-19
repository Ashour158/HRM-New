import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ReportSchedule } from '../aggregates/report-schedule.aggregate.js';
import { RecordReportScheduleRunHandler } from './record-report-schedule-run.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000101');
const reportScheduleId = new Uuid('00000000-0000-0000-0000-00000000d601');
const reportDefinitionId = new Uuid('00000000-0000-0000-0000-00000000d501');
const commandId = new Uuid('00000000-0000-0000-0000-00000000c001');
const correlationId = new Uuid('00000000-0000-0000-0000-00000000c002');

function command(payload: Record<string, unknown>) {
  return {
    commandId,
    commandName: 'RecordReportScheduleRun',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'SYSTEM',
      actorId,
      roles: ['SYSTEM_ACTOR'],
      permissions: [],
      mfaAuthenticated: true,
      email: 'system-scheduler@example.com',
    },
    aggregateType: 'ReportSchedule',
    aggregateId: reportScheduleId,
    correlationId,
    idempotencyKey: 'record-report-schedule-run-test',
    reason: 'scheduled-report-generation',
    payload,
    metadata: { clientType: 'SYSTEM_SCHEDULER' },
  } as never;
}

function schedule(nextRunAt: Date | undefined, frequency = 'DAILY') {
  return new ReportSchedule({
    id: reportScheduleId,
    tenantId,
    reportDefinitionId,
    frequency,
    nextRunAt,
    status: 'ACTIVE',
    aggregateVersion: 1,
  });
}

describe('RecordReportScheduleRunHandler', () => {
  it('advances next_run_at from the schedule\'s previous next_run_at (not "now") so the job stops re-firing', async () => {
    const existing = schedule(new Date('2026-06-20T09:00:00.000Z'));
    const repo = { findByIdForTenant: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new RecordReportScheduleRunHandler(
      repo as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue(['RecordReportScheduleRun']) } as never,
      { publishFromAggregate: vi.fn(async () => undefined) } as never,
    );

    // Job fires late (09:14 instead of the scheduled 09:00).
    const ranAt = new Date('2026-06-20T09:14:00.000Z');
    const result = await handler.handle(command({ reportScheduleId: reportScheduleId.value, ranAt }));

    expect(repo.findByIdForTenant).toHaveBeenCalledWith(reportScheduleId, tenantId);
    expect(existing.lastRunAt).toEqual(ranAt);
    // Baseline is the previous nextRunAt (09:00 next day), not ranAt (09:14) -- no drift.
    expect(existing.nextRunAt).toEqual(new Date('2026-06-21T09:00:00.000Z'));
    expect(existing.status).toBe('ACTIVE');
    expect(result).toEqual(expect.objectContaining({
      success: true,
      newState: 'ACTIVE',
      eventsEmitted: ['ReportScheduleRunRecorded'],
    }));
    expect(result.data).toEqual(expect.objectContaining({
      reportScheduleId: reportScheduleId.value,
      status: 'ACTIVE',
      nextRunAt: new Date('2026-06-21T09:00:00.000Z'),
    }));
  });

  it('advances weekly and monthly schedules by the correct interval', async () => {
    const weekly = schedule(new Date('2026-06-20T09:00:00.000Z'), 'WEEKLY');
    const weeklyRepo = { findByIdForTenant: vi.fn(async () => weekly), save: vi.fn(async () => undefined) };
    await new RecordReportScheduleRunHandler(
      weeklyRepo as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
      { publishFromAggregate: vi.fn(async () => undefined) } as never,
    ).handle(command({ reportScheduleId: reportScheduleId.value, ranAt: new Date('2026-06-20T09:00:00.000Z') }));
    expect(weekly.nextRunAt).toEqual(new Date('2026-06-27T09:00:00.000Z'));

    const monthly = schedule(new Date('2026-06-20T09:00:00.000Z'), 'MONTHLY');
    const monthlyRepo = { findByIdForTenant: vi.fn(async () => monthly), save: vi.fn(async () => undefined) };
    await new RecordReportScheduleRunHandler(
      monthlyRepo as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
      { publishFromAggregate: vi.fn(async () => undefined) } as never,
    ).handle(command({ reportScheduleId: reportScheduleId.value, ranAt: new Date('2026-06-20T09:00:00.000Z') }));
    expect(monthly.nextRunAt).toEqual(new Date('2026-07-20T09:00:00.000Z'));
  });

  it('throws for a schedule that is not ACTIVE', async () => {
    const paused = schedule(new Date('2026-06-20T09:00:00.000Z'));
    paused.pause(correlationId);
    const repo = { findByIdForTenant: vi.fn(async () => paused), save: vi.fn(async () => undefined) };
    const handler = new RecordReportScheduleRunHandler(
      repo as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
      { publishFromAggregate: vi.fn(async () => undefined) } as never,
    );

    await expect(handler.handle(command({ reportScheduleId: reportScheduleId.value, ranAt: new Date() })))
      .rejects.toThrow(/Cannot record a run from state PAUSED/);
  });
});
