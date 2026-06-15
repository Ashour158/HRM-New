import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { SchedulerController } from './scheduler.controller.js';
import type { ScheduledJob, SchedulerJobRunRecord, SchedulerJobScheduleOverride } from './scheduled-job.js';
import type { JobRunner } from './job-runner.service.js';
import type { ScheduledJobRegistry } from './scheduled-job.registry.js';
import type { SchedulerJobRunRepository } from './scheduler-job-run.repository.js';
import type { SchedulerJobScheduleRepository } from './scheduler-job-schedule.repository.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000000001');
const actorId = new Uuid('00000000-0000-4000-8000-000000000099');

function job(name: string, cron: string, concurrency: ScheduledJob['concurrency'] = 'per-tenant'): ScheduledJob {
  return {
    name,
    cron,
    concurrency,
    permissions: ['SCHEDULER_RUN'],
    async runForTenant() {
      return { itemsProcessed: 0 };
    },
  };
}

function request() {
  return {
    tenantId: tenantId.value,
    actor: { actorId, actorType: 'USER', roles: ['APP_ADMIN'], permissions: ['SCHEDULER_MANAGE'] },
  } as never;
}

describe('SchedulerController', () => {
  it('lists scheduler jobs with tenant override and latest run state', async () => {
    const runs: SchedulerJobRunRecord[] = [{
      id: Uuid.generate(),
      tenantId,
      jobName: 'leave-accrual-run',
      periodKey: '2026-06',
      status: 'FAILED',
      itemsProcessed: 3,
      error: 'policy missing',
      startedAt: new Date('2026-06-14T01:00:00.000Z'),
      finishedAt: new Date('2026-06-14T01:01:00.000Z'),
    }];
    const overrides: SchedulerJobScheduleOverride[] = [{
      tenantId,
      jobName: 'leave-accrual-run',
      cron: '0 6 1 * *',
      enabled: false,
    }];
    const controller = new SchedulerController(
      { runJobAcrossTenants: vi.fn() } as unknown as JobRunner,
      {
        getScheduleOverride: vi.fn(),
        upsertSchedule: vi.fn(),
        listOverridesForTenant: vi.fn(async () => overrides),
      } as unknown as SchedulerJobScheduleRepository,
      {
        list: vi.fn(() => [job('leave-accrual-run', '0 5 1 * *'), job('scheduled-report-generation', '*/15 * * * *', 'global')]),
      } as unknown as ScheduledJobRegistry,
      {
        findLatestRunsByTenant: vi.fn(async () => runs),
      } as unknown as SchedulerJobRunRepository,
    );

    const result = await controller.listJobs(request());

    expect(result).toMatchObject({
      tenantId: tenantId.value,
      jobs: [
        {
          name: 'leave-accrual-run',
          defaultCron: '0 5 1 * *',
          effectiveCron: '0 6 1 * *',
          enabled: false,
          tenantOverride: { cron: '0 6 1 * *', enabled: false },
          lastRun: {
            status: 'FAILED',
            periodKey: '2026-06',
            itemsProcessed: 3,
            error: 'policy missing',
          },
        },
        {
          name: 'scheduled-report-generation',
          defaultCron: '*/15 * * * *',
          effectiveCron: '*/15 * * * *',
          enabled: true,
          tenantOverride: null,
          lastRun: null,
        },
      ],
    });
  });

  it('requires a tenant context for scheduler job listing', async () => {
    const controller = new SchedulerController(
      { runJobAcrossTenants: vi.fn() } as unknown as JobRunner,
      {} as SchedulerJobScheduleRepository,
      { list: vi.fn() } as unknown as ScheduledJobRegistry,
      {} as SchedulerJobRunRepository,
    );

    await expect(controller.listJobs({ actor: { actorId } } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});
