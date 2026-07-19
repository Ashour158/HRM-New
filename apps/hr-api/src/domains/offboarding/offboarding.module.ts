import { Module } from '@nestjs/common';
import { OffboardingController } from './api/offboarding.controller.js';
import { OffboardingPlanFsmRegistrar } from './fsm/offboarding-plan.fsm.js';
import { OffboardingTaskFsmRegistrar } from './fsm/offboarding-task.fsm.js';
import { OffboardingPlanRepository } from './repositories/offboarding-plan.repository.js';
import { OffboardingTaskRepository } from './repositories/offboarding-task.repository.js';
import { CreateOffboardingPlanHandler } from './commands/create-offboarding-plan.handler.js';
import { StartOffboardingHandler } from './commands/start-offboarding.handler.js';
import { CompleteOffboardingHandler } from './commands/complete-offboarding.handler.js';
import { CreateOffboardingTaskHandler } from './commands/create-offboarding-task.handler.js';
import { CompleteOffboardingTaskHandler } from './commands/complete-offboarding-task.handler.js';
import { SkipOffboardingTaskHandler } from './commands/skip-offboarding-task.handler.js';
import { RecordOffboardingTaskEvidenceHandler } from './commands/record-offboarding-task-evidence.handler.js';
import { OffboardingEventsPublisher } from './events/offboarding-events.publisher.js';
import { OffboardingTemplateService } from './services/offboarding-template.service.js';
import { OffboardingProgressService } from './services/offboarding-progress.service.js';
import { OffboardingInitiationSaga } from './sagas/offboarding-initiation.saga.js';

/**
 * Offboarding domain module.
 *
 * Owns OffboardingPlan and OffboardingTask aggregates.
 * Provides command handlers, repositories, FSM registrations, event
 * publishing, and the saga that auto-creates an offboarding plan from
 * WorkerTerminated.
 */
@Module({
  controllers: [OffboardingController],
  providers: [
    // FSM registrars
    OffboardingPlanFsmRegistrar,
    OffboardingTaskFsmRegistrar,
    // Repositories
    OffboardingPlanRepository,
    OffboardingTaskRepository,
    // Command handlers
    CreateOffboardingPlanHandler,
    StartOffboardingHandler,
    CompleteOffboardingHandler,
    CreateOffboardingTaskHandler,
    CompleteOffboardingTaskHandler,
    SkipOffboardingTaskHandler,
    RecordOffboardingTaskEvidenceHandler,
    // Event publisher
    OffboardingEventsPublisher,
    OffboardingTemplateService,
    OffboardingProgressService,
    // Saga: auto-creates a plan on WorkerTerminated
    OffboardingInitiationSaga,
  ],
  exports: [OffboardingPlanRepository, OffboardingTaskRepository, OffboardingTemplateService, OffboardingProgressService],
})
export class OffboardingModule {}
