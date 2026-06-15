import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { HcmSetupModule } from '../hcm-setup/hcm-setup.module.js';
import { SchedulerEngineService } from './scheduler-engine.service.js';
import { SchedulerJobRepository } from './repositories/scheduler-job.repository.js';
import { SchedulerJobRunRepository } from './repositories/scheduler-job-run.repository.js';
import { SCHEDULER_JOB_REPOSITORY, SCHEDULER_JOB_RUN_REPOSITORY } from './scheduler.types.js';

@Module({
  imports: [PlatformModule, HcmSetupModule],
  providers: [
    SchedulerEngineService,
    SchedulerJobRepository,
    SchedulerJobRunRepository,
    { provide: SCHEDULER_JOB_REPOSITORY, useExisting: SchedulerJobRepository },
    { provide: SCHEDULER_JOB_RUN_REPOSITORY, useExisting: SchedulerJobRunRepository },
  ],
  exports: [SchedulerEngineService],
})
export class SchedulerModule {}
