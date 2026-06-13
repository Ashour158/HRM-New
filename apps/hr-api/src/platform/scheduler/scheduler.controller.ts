import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
import { PermissionGuard } from '../../guards/permission.guard.js';
import { Permissions } from '../../decorators/permissions.decorator.js';
import { JobRunner } from './job-runner.service.js';
import { SchedulerJobScheduleRepository } from './scheduler-job-schedule.repository.js';

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
  ) {}

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
