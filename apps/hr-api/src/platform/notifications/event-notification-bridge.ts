import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AllHrTopics, type HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus, type EventHandler } from '../event-bus/event-bus.js';
import { InboxConsumer } from '../outbox-inbox/inbox-consumer.js';
import { PlatformNotificationService } from './platform-notification.service.js';

export const PLATFORM_NOTIFICATION_CONSUMER = 'platform-notifications';
export const PLATFORM_NOTIFICATION_CONSUMER_VERSION = '1';

@Injectable()
export class EventNotificationBridge implements OnModuleInit {
  private readonly logger = new Logger(EventNotificationBridge.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly notificationService: PlatformNotificationService,
  ) {}

  onModuleInit(): void {
    const handler: EventHandler = {
      consumerGroup: PLATFORM_NOTIFICATION_CONSUMER,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(
          event,
          PLATFORM_NOTIFICATION_CONSUMER,
          PLATFORM_NOTIFICATION_CONSUMER_VERSION,
          {
            handle: async (dedupedEvent) => {
              const created = await this.notificationService.createFromEvent(dedupedEvent);
              this.logger.log({
                type: 'PLATFORM_NOTIFICATIONS_PROJECTED',
                eventId: dedupedEvent.eventId.value,
                eventName: dedupedEvent.eventName,
                created,
              });
            },
          },
        );
      },
    };

    for (const topic of AllHrTopics) {
      this.eventBus.subscribe(topic, PLATFORM_NOTIFICATION_CONSUMER, handler);
    }
  }
}
