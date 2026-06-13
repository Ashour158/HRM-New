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
import { EventBus, InMemoryEventBus } from './event-bus/event-bus.js';
import { KafkaEventBus } from './event-bus/kafka-event-bus.js';
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
import { PlatformNotificationRepository } from './notifications/platform-notification.repository.js';
import { PlatformNotificationService } from './notifications/platform-notification.service.js';
import { EventNotificationBridge } from './notifications/event-notification-bridge.js';
import { PlatformNotificationsController } from './notifications/platform-notifications.controller.js';
import { EventContractsRegistryController } from './event-contracts-registry.controller.js';
import { EventContractsRegistryService } from './event-contracts-registry.service.js';
import { HcmSetupModule } from '../domains/hcm-setup/hcm-setup.module.js';
import { JobRunner } from './scheduler/job-runner.service.js';
import {
  AttendanceAnomalyAlertJob,
  AttendanceDailyFinalizationJob,
  HcmSchedulerReadRepository,
  LeaveAccrualRunJob,
  LeaveApprovalSlaJob,
  LeaveBalanceExpiryAlertJob,
  LeaveCarryoverRunJob,
  PayrollCutoffReminderJob,
  PayrollCycleOpenJob,
  PayrollReadinessCheckJob,
  ReturnToWorkReminderJob,
  TimesheetApprovalSlaJob,
  TimesheetSubmissionReminderJob,
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

const eventBusProvider = {
  provide: EventBus,
  useFactory: (): EventBus => {
    const brokers = process.env.KAFKA_BROKERS?.split(',') ?? [];
    if (brokers.length > 0 && brokers[0]) {
      return new KafkaEventBus(brokers);
    }
    return new InMemoryEventBus();
  },
};

@Global()
@Module({
  imports: [ConfigModule, DiscoveryModule, ScheduleModule.forRoot(), HcmSetupModule, ObservabilityModule],
  controllers: [
    PlatformNotificationsController,
    DeadLetterOperationsController,
    EventContractsRegistryController,
    SchedulerController,
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
    PlatformNotificationRepository,
    PlatformNotificationService,
    EventNotificationBridge,
    EventContractsRegistryService,
    TenantDirectoryService,
    SystemActorFactory,
    HcmSchedulerReadRepository,
    LeaveAccrualRunJob,
    LeaveCarryoverRunJob,
    LeaveBalanceExpiryAlertJob,
    LeaveApprovalSlaJob,
    ReturnToWorkReminderJob,
    AttendanceDailyFinalizationJob,
    TimesheetSubmissionReminderJob,
    TimesheetApprovalSlaJob,
    AttendanceAnomalyAlertJob,
    PayrollCycleOpenJob,
    PayrollCutoffReminderJob,
    PayrollReadinessCheckJob,
    {
      provide: SCHEDULED_JOBS,
      useFactory: (
        leaveAccrualRun: LeaveAccrualRunJob,
        leaveCarryoverRun: LeaveCarryoverRunJob,
        leaveBalanceExpiryAlert: LeaveBalanceExpiryAlertJob,
        leaveApprovalSla: LeaveApprovalSlaJob,
        returnToWorkReminder: ReturnToWorkReminderJob,
        attendanceDailyFinalization: AttendanceDailyFinalizationJob,
        timesheetSubmissionReminder: TimesheetSubmissionReminderJob,
        timesheetApprovalSla: TimesheetApprovalSlaJob,
        attendanceAnomalyAlert: AttendanceAnomalyAlertJob,
        payrollCycleOpen: PayrollCycleOpenJob,
        payrollCutoffReminder: PayrollCutoffReminderJob,
        payrollReadinessCheck: PayrollReadinessCheckJob,
      ): ScheduledJob[] => [
        leaveAccrualRun,
        leaveCarryoverRun,
        leaveBalanceExpiryAlert,
        leaveApprovalSla,
        returnToWorkReminder,
        attendanceDailyFinalization,
        timesheetSubmissionReminder,
        timesheetApprovalSla,
        attendanceAnomalyAlert,
        payrollCycleOpen,
        payrollCutoffReminder,
        payrollReadinessCheck,
      ],
      inject: [
        LeaveAccrualRunJob,
        LeaveCarryoverRunJob,
        LeaveBalanceExpiryAlertJob,
        LeaveApprovalSlaJob,
        ReturnToWorkReminderJob,
        AttendanceDailyFinalizationJob,
        TimesheetSubmissionReminderJob,
        TimesheetApprovalSlaJob,
        AttendanceAnomalyAlertJob,
        PayrollCycleOpenJob,
        PayrollCutoffReminderJob,
        PayrollReadinessCheckJob,
      ],
    },
    ScheduledJobRegistry,
    SchedulerJobRunRepository,
    SchedulerJobScheduleRepository,
    ReminderDispatchLogRepository,
    ReminderEmitter,
    EffectiveDatingActivationLogRepository,
    EffectiveDatingActivator,
    JobRunner,
  ],
  exports: [
    CommandBus,
    EventBus,
    OutboxPublisher,
    InboxConsumer,
    FsmFramework,
    WorkflowEngine,
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
