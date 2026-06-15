import { describe, expect, it, vi } from 'vitest';
import { getCurrentTenantId } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';
import type { CommandBus } from '../../platform/command-bus/command-bus.js';
import type { EventBus } from '../../platform/event-bus/event-bus.js';
import type { HcmSetupService } from '../hcm-setup/hcm-setup.service.js';
import { SchedulerEngineService } from './scheduler-engine.service.js';
import type { SchedulerJob, SchedulerJobRun, SchedulerJobRepositoryPort, SchedulerJobRunRepositoryPort } from './scheduler.types.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const jobId = new Uuid('00000000-0000-0000-0000-000000000901');
const aggregateId = new Uuid('00000000-0000-0000-0000-000000000701');

function commandJob(overrides: Partial<SchedulerJob> = {}): SchedulerJob {
  return {
    id: jobId,
    tenantId,
    jobKey: 'daily-absence-submit',
    label: 'Daily absence submit',
    description: undefined,
    jobType: 'COMMAND',
    scheduleKind: 'DAILY',
    status: 'ACTIVE',
    enabled: true,
    commandName: 'SubmitAbsenceRequest',
    aggregateType: 'AbsenceRequest',
    aggregateId,
    payloadTemplate: { absenceRequestId: aggregateId.value },
    eventName: undefined,
    eventPayloadTemplate: undefined,
    nextRunAt: new Date('2026-06-13T00:00:00.000Z'),
    lastRunAt: undefined,
    aggregateVersion: 0,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function fakeRun(status: SchedulerJobRun['status'] = 'STARTED'): SchedulerJobRun {
  return {
    id: new Uuid('00000000-0000-0000-0000-000000000902'),
    tenantId,
    jobId,
    jobKey: 'daily-absence-submit',
    periodKey: '2026-06-13',
    runKind: 'COMMAND',
    status,
    idempotencyKey: `scheduler:${tenantId.value}:daily-absence-submit:2026-06-13`,
    commandId: undefined,
    correlationId: new Uuid('00000000-0000-0000-0000-000000000903'),
    eventId: undefined,
    startedAt: new Date('2026-06-12T22:30:00.000Z'),
    finishedAt: status === 'STARTED' ? undefined : new Date('2026-06-12T22:30:01.000Z'),
    errorMessage: undefined,
    resultPayload: {},
    aggregateVersion: 0,
    createdAt: new Date('2026-06-12T22:30:00.000Z'),
    updatedAt: new Date('2026-06-12T22:30:00.000Z'),
  };
}

function buildService(runRepo: SchedulerJobRunRepositoryPort, eventBus?: Partial<EventBus>) {
  let tenantContextDuringCommand: string | undefined;
  const commandBus = {
    execute: vi.fn(async () => {
      tenantContextDuringCommand = getCurrentTenantId()?.value;
      return { success: true, data: { ok: true } };
    }),
  } as unknown as CommandBus;
  const jobs = {
    findDueJobs: vi.fn(async () => []),
    markRunCompleted: vi.fn(async () => undefined),
  } satisfies SchedulerJobRepositoryPort;
  const bus = {
    publish: vi.fn(async () => undefined),
    ...(eventBus ?? {}),
  } as unknown as EventBus;
  const hcmSetup = {
    getSetup: vi.fn(async () => ({
      timezone: 'Africa/Cairo',
      attendancePolicy: { timezoneOffsetMinutes: 180 },
    })),
  } as unknown as Pick<HcmSetupService, 'getSetup'>;
  const service = new SchedulerEngineService(commandBus, bus, jobs, runRepo, hcmSetup);
  return { service, commandBus, eventBus: bus, jobs, hcmSetup, getTenantContextDuringCommand: () => tenantContextDuringCommand };
}

describe('SchedulerEngineService', () => {
  it('runs command jobs through CommandBus inside tenant context and records the job-run ledger', async () => {
    const runRepo = {
      tryStartRun: vi.fn(async () => ({ started: true, run: fakeRun() })),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    } satisfies SchedulerJobRunRepositoryPort;
    const { service, commandBus, getTenantContextDuringCommand } = buildService(runRepo);

    const result = await service.runJob(tenantId, commandJob(), new Date('2026-06-12T22:30:00.000Z'));

    expect(result.status).toBe('SUCCEEDED');
    expect(getTenantContextDuringCommand()).toBe(tenantId.value);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'SubmitAbsenceRequest',
      aggregateType: 'AbsenceRequest',
      tenantId,
      idempotencyKey: `scheduler:${tenantId.value}:daily-absence-submit:2026-06-13`,
      payload: expect.objectContaining({ absenceRequestId: aggregateId }),
      metadata: { requestHash: expect.any(String), clientType: 'SYSTEM' },
    }));
    expect(runRepo.markSucceeded).toHaveBeenCalledWith(expect.objectContaining({
      runId: expect.any(Uuid),
      commandId: expect.any(Uuid),
      resultPayload: expect.objectContaining({ success: true }),
    }));
  });

  it('does not re-execute a duplicate tenant/job/period run', async () => {
    const runRepo = {
      tryStartRun: vi.fn(async () => ({ started: false, run: fakeRun('SUCCEEDED') })),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    } satisfies SchedulerJobRunRepositoryPort;
    const { service, commandBus } = buildService(runRepo);

    const result = await service.runJob(tenantId, commandJob(), new Date('2026-06-12T22:30:00.000Z'));

    expect(result.status).toBe('SKIPPED_DUPLICATE');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('publishes reminder events through EventBus without writing notifications directly', async () => {
    const runRepo = {
      tryStartRun: vi.fn(async () => ({ started: true, run: fakeRun() })),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    } satisfies SchedulerJobRunRepositoryPort;
    const { service, eventBus } = buildService(runRepo);

    const result = await service.runJob(
      tenantId,
      commandJob({
        jobType: 'REMINDER_EVENT',
        jobKey: 'policy-review-reminder',
        label: 'Policy review reminder',
        commandName: undefined,
        aggregateType: 'SchedulerJob',
        aggregateId: jobId,
        eventName: 'SchedulerReminderDue',
        eventPayloadTemplate: { audience: 'HR_OPERATIONS', reminderType: 'POLICY_REVIEW' },
      }),
      new Date('2026-06-12T22:30:00.000Z'),
    );

    expect(result.status).toBe('SUCCEEDED');
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'SchedulerReminderDue',
      aggregateType: 'SchedulerJob',
      tenantId,
      payload: expect.objectContaining({
        jobKey: 'policy-review-reminder',
        periodKey: '2026-06-13',
        reminderType: 'POLICY_REVIEW',
      }),
      metadata: expect.objectContaining({ clientType: 'SYSTEM' }),
    }));
  });

  it('rejects a job from another tenant before creating a run', async () => {
    const runRepo = {
      tryStartRun: vi.fn(async () => ({ started: true, run: fakeRun() })),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    } satisfies SchedulerJobRunRepositoryPort;
    const { service } = buildService(runRepo);

    await expect(service.runJob(tenantId, commandJob({
      tenantId: new Uuid('00000000-0000-0000-0000-000000000002'),
    }))).rejects.toThrow(/does not belong to tenant/);
    expect(runRepo.tryStartRun).not.toHaveBeenCalled();
  });
});
