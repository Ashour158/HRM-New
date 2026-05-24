import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { Redis } from 'ioredis';
import { RedisCacheService } from '@hcm/platform-core';
import { CommandBus } from './command-bus/command-bus.js';
import { EventBus, InMemoryEventBus } from './event-bus/event-bus.js';
import { KafkaEventBus } from './event-bus/kafka-event-bus.js';
import { OutboxPublisher } from './outbox-inbox/outbox-publisher.js';
import { InboxConsumer } from './outbox-inbox/inbox-consumer.js';
import { InboxDeduplicator } from './outbox-inbox/inbox-deduplicator.js';
import { FsmFramework } from './workflow/fsm-framework.js';
import { TransitionLedgerService } from './workflow/transition-ledger.js';
import { GuardLibrary } from './workflow/guard-library.js';
import { WorkflowEngine } from './workflow/workflow-engine.js';

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
  providers: [
    eventBusProvider,
    {
      provide: RedisCacheService,
      useFactory: (): RedisCacheService => {
        const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
        return new RedisCacheService(redis);
      },
    },
    CommandBus,
    OutboxPublisher,
    InboxConsumer,
    InboxDeduplicator,
    FsmFramework,
    TransitionLedgerService,
    GuardLibrary,
    WorkflowEngine,
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
  ],
})
export class PlatformModule {}
