import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { Redis } from 'ioredis';
import { AuditLedgerService, RedisCacheService } from '@hcm/platform-core';
import { createKyselyInstance, getPool } from '@hcm/database';
import { AccessControlService } from '@hcm/access-control';
import { CommandBus } from './command-bus/command-bus.js';
import { EventBus, InMemoryEventBus } from './event-bus/event-bus.js';
import { KafkaEventBus } from './event-bus/kafka-event-bus.js';
import { OutboxPublisher } from './outbox-inbox/outbox-publisher.js';
import { OutboxPublisherWorker } from './outbox-inbox/outbox-publisher.worker.js';
import { InboxConsumer } from './outbox-inbox/inbox-consumer.js';
import { InboxDeduplicator } from './outbox-inbox/inbox-deduplicator.js';
import { FsmFramework } from './workflow/fsm-framework.js';
import { TransitionLedgerService } from './workflow/transition-ledger.js';
import { GuardLibrary } from './workflow/guard-library.js';
import { WorkflowEngine } from './workflow/workflow-engine.js';
import { PlatformNotificationRepository } from './notifications/platform-notification.repository.js';
import { PlatformNotificationService } from './notifications/platform-notification.service.js';
import { EventNotificationBridge } from './notifications/event-notification-bridge.js';
import { PlatformNotificationsController } from './notifications/platform-notifications.controller.js';

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
  imports: [ConfigModule, DiscoveryModule],
  controllers: [PlatformNotificationsController],
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
    FsmFramework,
    TransitionLedgerService,
    GuardLibrary,
    WorkflowEngine,
    PlatformNotificationRepository,
    PlatformNotificationService,
    EventNotificationBridge,
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
  ],
})
export class PlatformModule {}
