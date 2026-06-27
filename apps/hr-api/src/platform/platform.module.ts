import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { Redis } from 'ioredis';
import { AuditLedgerService, RedisCacheService } from '@hcm/platform-core';
import { createKyselyInstance, getPool } from '@hcm/database';
import { AccessControlService } from '@hcm/access-control';
import { ObservabilityModule } from '../observability/observability.module.js';
import { CommandBus } from './command-bus/command-bus.js';
import { EventBus } from './event-bus/event-bus.js';
import { createEventBus } from './event-bus/event-bus.factory.js';
import { OutboxPublisher } from './outbox-inbox/outbox-publisher.js';
import { OutboxPublisherWorker } from './outbox-inbox/outbox-publisher.worker.js';
import { InboxConsumer } from './outbox-inbox/inbox-consumer.js';
import { InboxDeduplicator } from './outbox-inbox/inbox-deduplicator.js';
import { InboxRecoveryWorker } from './outbox-inbox/inbox-recovery.worker.js';
import { DeadLetterOperationsController } from './outbox-inbox/dead-letter-operations.controller.js';
import { DeadLetterOperationsService } from './outbox-inbox/dead-letter-operations.service.js';
import { FsmFramework } from './workflow/fsm-framework.js';
import { TransitionLedgerService } from './workflow/transition-ledger.js';
import { GuardLibrary } from './workflow/guard-library.js';
import { WorkflowEngine } from './workflow/workflow-engine.js';
import { ApprovalChainController } from './workflow/approval-chain.controller.js';
import { ApprovalChainRepository } from './workflow/approval-chain.repository.js';
import { ApprovalWorkflowService } from './workflow/approval-workflow.service.js';
import {
  ApproveApprovalStepHandler,
  DelegateApprovalStepHandler,
  EscalateApprovalChainOverdueHandler,
  RejectApprovalStepHandler,
} from './workflow/approval-chain.handlers.js';
import { PlatformNotificationRepository } from './notifications/platform-notification.repository.js';
import { PlatformNotificationService } from './notifications/platform-notification.service.js';
import { EventNotificationBridge } from './notifications/event-notification-bridge.js';
import { PlatformNotificationsController } from './notifications/platform-notifications.controller.js';
import { EventContractsRegistryController } from './event-contracts-registry.controller.js';
import { EventContractsRegistryService } from './event-contracts-registry.service.js';
import { HcmSetupModule } from '../domains/hcm-setup/hcm-setup.module.js';
import { WorkerRepository } from '../domains/hr-core/repositories/worker.repository.js';
import { HrCaseTaskRepository } from '../domains/hr-service-delivery/repositories/hr-case-task.repository.js';
import { HrServiceCaseRepository } from '../domains/hr-service-delivery/repositories/hr-service-case.repository.js';
import { IntelligenceRepository } from '../domains/intelligence/repositories/intelligence.repository.js';
import { LearningAssignmentRepository } from '../domains/learning/repositories/learning-assignment.repository.js';
import { OnboardingTaskRepository } from '../domains/onboarding/repositories/onboarding-task.repository.js';
import { JobRunner } from './scheduler/job-runner.service.js';
import { PersonalDataRetentionReadRepository } from './scheduler/personal-data-retention-job.js';
import {
  HCM_SCHEDULED_JOB_PROVIDERS,
  HcmDomainSchedulerReadRepository,
  HcmGovernanceSchedulerReadRepository,
  HcmSchedulerReadRepository,
} from './scheduler/hcm-scheduled-jobs.js';
import { SchedulerController } from './scheduler/scheduler.controller.js';
import { EffectiveDatingActivationLogRepository } from './scheduler/effective-dating-activation-log.repository.js';
import { EffectiveDatingActivator } from './scheduler/effective-dating-activator.js';
import { ReminderDispatchLogRepository } from './scheduler/reminder-dispatch-log.repository.js';
import { ReminderEmitter } from './scheduler/reminder-emitter.js';
import { SchedulerJobRunRepository } from './scheduler/scheduler-job-run.repository.js';
import { SchedulerJobScheduleRepository } from './scheduler/scheduler-job-schedule.repository.js';
import { ScheduledJobRegistry } from './scheduler/scheduled-job.registry.js';
import { SCHEDULED_JOBS } from './scheduler/scheduled-job.js';
import type { ScheduledJob } from './scheduler/scheduled-job.js';
import { SystemActorFactory } from './scheduler/system-actor.factory.js';
import { TenantDirectoryService } from './scheduler/tenant-directory.service.js';
import { MeInboxController } from './me/me-inbox.controller.js';
import { MeInboxService } from './me/me-inbox.service.js';

const eventBusProvider = {
  provide: EventBus,
  useFactory: (): EventBus => createEventBus(),
};

@Global()
@Module({
  imports: [ConfigModule, DiscoveryModule, ScheduleModule.forRoot(), HcmSetupModule, ObservabilityModule],
  controllers: [
    PlatformNotificationsController,
    DeadLetterOperationsController,
    EventContractsRegistryController,
    SchedulerController,
    ApprovalChainController,
    MeInboxController,
  ],
  providers: [
    eventBusProvider,
    {
      provide: RedisCacheService,
      useFactory: (): RedisCacheService => {
        const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
        return new RedisCacheService(redis);
      },
    },
    {
      provide: AuditLedgerService,
      useFactory: (): AuditLedgerService => new AuditLedgerService(createKyselyInstance(getPool())),
    },
    AccessControlService,
    CommandBus,
    OutboxPublisher,
    OutboxPublisherWorker,
    InboxConsumer,
    InboxDeduplicator,
    InboxRecoveryWorker,
    DeadLetterOperationsService,
    FsmFramework,
    TransitionLedgerService,
    GuardLibrary,
    WorkflowEngine,
    ApprovalChainRepository,
    ApprovalWorkflowService,
    ApproveApprovalStepHandler,
    RejectApprovalStepHandler,
    DelegateApprovalStepHandler,
    EscalateApprovalChainOverdueHandler,
    PlatformNotificationRepository,
    PlatformNotificationService,
    EventNotificationBridge,
    EventContractsRegistryService,
    OnboardingTaskRepository,
    HrCaseTaskRepository,
    HrServiceCaseRepository,
    LearningAssignmentRepository,
    IntelligenceRepository,
    WorkerRepository,
    TenantDirectoryService,
    SystemActorFactory,
    HcmSchedulerReadRepository,
    HcmDomainSchedulerReadRepository,
    HcmGovernanceSchedulerReadRepository,
    PersonalDataRetentionReadRepository,
    ...HCM_SCHEDULED_JOB_PROVIDERS,
    {
      provide: SCHEDULED_JOBS,
      useFactory: (...jobs: ScheduledJob[]): ScheduledJob[] => jobs,
      inject: HCM_SCHEDULED_JOB_PROVIDERS,
    },
    ScheduledJobRegistry,
    SchedulerJobRunRepository,
    SchedulerJobScheduleRepository,
    ReminderDispatchLogRepository,
    ReminderEmitter,
    EffectiveDatingActivationLogRepository,
    EffectiveDatingActivator,
    JobRunner,
    MeInboxService,
  ],
  exports: [
    CommandBus,
    EventBus,
    OutboxPublisher,
    InboxConsumer,
    FsmFramework,
    WorkflowEngine,
    ApprovalChainRepository,
    ApprovalWorkflowService,
    GuardLibrary,
    TransitionLedgerService,
    RedisCacheService,
    AuditLedgerService,
    PlatformNotificationRepository,
    PlatformNotificationService,
    TenantDirectoryService,
    SystemActorFactory,
    ScheduledJobRegistry,
    SchedulerJobRunRepository,
    SchedulerJobScheduleRepository,
    ReminderDispatchLogRepository,
    ReminderEmitter,
    EffectiveDatingActivationLogRepository,
    EffectiveDatingActivator,
    JobRunner,
  ],
})
export class PlatformModule {}
