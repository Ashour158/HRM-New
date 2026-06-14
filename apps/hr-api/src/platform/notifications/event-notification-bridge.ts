import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
    @Inject(EventBus) private readonly eventBus: EventBus,
    @Inject(InboxConsumer) private readonly inboxConsumer: InboxConsumer,
    @Inject(PlatformNotificationService) private readonly notificationService: PlatformNotificationService,
  ) {}

  onModuleInit(): void {
    void this.skipOrphanedLegacyInboxRows();

    const handler: EventHandler = {
      consumerGroup: PLATFORM_NOTIFICATION_CONSUMER,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(
          event,
          PLATFORM_NOTIFICATION_CONSUMER,
          PLATFORM_NOTIFICATION_CONSUMER_VERSION,
          {
            handle: async (dedupedEvent) => this.projectNotification(dedupedEvent),
          },
        );
      },
    };
    this.inboxConsumer.registerReplayHandler(
      PLATFORM_NOTIFICATION_CONSUMER,
      PLATFORM_NOTIFICATION_CONSUMER_VERSION,
      {
        handle: async (dedupedEvent) => this.projectNotification(dedupedEvent),
      },
    );

    for (const topic of AllHrTopics) {
      this.eventBus.subscribe(topic, PLATFORM_NOTIFICATION_CONSUMER, handler);
    }
  }

  private async projectNotification(dedupedEvent: HrEventEnvelope<unknown>): Promise<void> {
    const created = await this.notificationService.createFromEvent(dedupedEvent);
    this.logger.log({
      type: 'PLATFORM_NOTIFICATIONS_PROJECTED',
      eventId: dedupedEvent.eventId.value,
      eventName: dedupedEvent.eventName,
      created,
    });
  }

  private async skipOrphanedLegacyInboxRows(): Promise<void> {
    try {
      const skipped = await this.inboxConsumer.skipOrphanedEventsWithoutOutbox(
        PLATFORM_NOTIFICATION_CONSUMER,
        PLATFORM_NOTIFICATION_CONSUMER_VERSION,
      );
      if (skipped > 0) {
        this.logger.warn({
          type: 'PLATFORM_NOTIFICATIONS_ORPHANED_INBOX_SKIPPED',
          skipped,
        });
      }
    } catch (err) {
      this.logger.error({
        type: 'PLATFORM_NOTIFICATIONS_ORPHANED_INBOX_CLEANUP_FAILED',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
