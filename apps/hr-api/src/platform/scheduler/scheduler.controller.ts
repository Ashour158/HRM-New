import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
import { PermissionGuard } from '../../guards/permission.guard.js';
import { Permissions } from '../../decorators/permissions.decorator.js';
import { JobRunner } from './job-runner.service.js';
import { SchedulerJobScheduleRepository } from './scheduler-job-schedule.repository.js';
import { SchedulerJobRunRepository } from './scheduler-job-run.repository.js';
import { ScheduledJobRegistry } from './scheduled-job.registry.js';
import type { SchedulerJobRunRecord, SchedulerJobScheduleOverride } from './scheduled-job.js';

interface RunJobBody {
  tenantId?: string;
  now?: string;
}

interface ScheduleOverrideBody {
  tenantId: string;
  cron: string;
  enabled: boolean;
}

@ApiTags('Platform Scheduler')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('platform/scheduler')
export class SchedulerController {
  constructor(
    private readonly runner: JobRunner,
    private readonly schedules: SchedulerJobScheduleRepository,
    private readonly registry: ScheduledJobRegistry,
    private readonly runs: SchedulerJobRunRepository,
  ) {}

  @Get('jobs')
  @Permissions('SCHEDULER_MANAGE')
  async listJobs(@Req() req: Request) {
    const tenantId = readTenantId(req);
    const [overrides, latestRuns] = await Promise.all([
      this.schedules.listOverridesForTenant(tenantId),
      this.runs.findLatestRunsByTenant(tenantId),
    ]);
    const overrideByJob = new Map(overrides.map((override) => [override.jobName, override]));
    const runByJob = new Map(latestRuns.map((run) => [run.jobName, run]));
    const jobs = this.registry.list()
      .map((job) => {
        const tenantOverride = overrideByJob.get(job.name);
        const lastRun = runByJob.get(job.name);
        return {
          name: job.name,
          defaultCron: job.cron,
          effectiveCron: tenantOverride?.cron ?? job.cron,
          enabled: tenantOverride?.enabled ?? true,
          concurrency: job.concurrency ?? 'per-tenant',
          permissions: job.permissions ?? [],
          tenantOverride: tenantOverride ? serializeOverride(tenantOverride) : null,
          lastRun: lastRun ? serializeRun(lastRun) : null,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
    return {
      tenantId: tenantId.value,
      generatedAt: new Date().toISOString(),
      jobs,
    };
  }

  @Post('jobs/:name/run')
  @Permissions('SCHEDULER_MANAGE')
  async runJob(@Param('name') name: string, @Body() body: RunJobBody = {}) {
    const tenantId = body.tenantId ? new Uuid(body.tenantId) : undefined;
    const now = body.now ? new Date(body.now) : new Date();
    return this.runner.runJobAcrossTenants(name, now, tenantId);
  }

  @Post('jobs/:name/schedule')
  @Permissions('SCHEDULER_MANAGE')
  async retuneJob(@Param('name') name: string, @Body() body: ScheduleOverrideBody, @Req() req: Request) {
    const actorId = readActorId(req);
    return this.schedules.upsertSchedule({
      tenantId: new Uuid(body.tenantId),
      jobName: name,
      cron: body.cron,
      enabled: body.enabled,
      updatedBy: actorId,
    });
  }
}

function readActorId(req: Request): Uuid {
  const actorId = req.actor?.actorId;
  if (actorId instanceof Uuid) return actorId;
  const value = (actorId as { value?: unknown } | undefined)?.value;
  if (typeof value === 'string' && Uuid.isValid(value)) return new Uuid(value);
  throw new Error('Authenticated actor is required to manage scheduler jobs');
}

function readTenantId(req: Request): Uuid {
  const tenantId = req.tenantId;
  if (!tenantId || !Uuid.isValid(tenantId)) {
    throw new BadRequestException('Tenant ID missing');
  }
  return new Uuid(tenantId);
}

function serializeOverride(override: SchedulerJobScheduleOverride) {
  return {
    tenantId: override.tenantId.value,
    jobName: override.jobName,
    cron: override.cron,
    enabled: override.enabled,
  };
}

function serializeRun(run: SchedulerJobRunRecord) {
  return {
    id: run.id.value,
    tenantId: run.tenantId.value,
    jobName: run.jobName,
    periodKey: run.periodKey,
    status: run.status,
    itemsProcessed: run.itemsProcessed,
    error: run.error ?? null,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}
