import { describe, expect, it, vi } from 'vitest';
import { AllHrTopics, HR_ONBOARDING, type HrEventEnvelope } from '@hcm/event-schemas';
import { Uuid } from '@hcm/shared-kernel';
import type { EventBus, EventHandler } from '../event-bus/event-bus.js';
import type { InboxConsumer } from '../outbox-inbox/inbox-consumer.js';
import { EventNotificationBridge } from './event-notification-bridge.js';
import type { PlatformNotificationService } from './platform-notification.service.js';

function event(): HrEventEnvelope<Record<string, never>> {
  return {
    eventId: Uuid.generate(),
    eventName: 'OnboardingPlanStarted',
    eventSchemaVersion: 1,
    tenantId: Uuid.generate(),
    aggregateType: 'OnboardingPlan',
    aggregateId: Uuid.generate(),
    payload: {},
    metadata: {
      correlationId: Uuid.generate(),
      requestHash: 'event-notification-bridge-test',
      clientType: 'SYSTEM',
    },
    privacy: {
      piiClassification: 'LOW',
      employeeDataCategory: 'PROFILE',
      subjectWorkerId: Uuid.generate().value,
      managerVisible: true,
      employeeVisible: true,
      hrRestricted: false,
      redactionApplied: false,
    },
    occurredAt: new Date(),
    version: 1,
  };
}

describe('EventNotificationBridge', () => {
  it('subscribes the notification consumer to every canonical HR topic', () => {
    const subscribe = vi.fn();
    const bridge = new EventNotificationBridge(
      { subscribe } as unknown as EventBus,
      { consume: vi.fn(), skipOrphanedEventsWithoutOutbox: vi.fn(), registerReplayHandler: vi.fn() } as unknown as InboxConsumer,
      { createFromEvent: vi.fn() } as unknown as PlatformNotificationService,
    );

    bridge.onModuleInit();

    expect(subscribe).toHaveBeenCalledTimes(AllHrTopics.length);
    expect(subscribe.mock.calls.map((call) => call[0])).toContain(HR_ONBOARDING);
  });

  it('processes bus events through inbox deduplication before notification projection', async () => {
    let registeredHandler: EventHandler | undefined;
    const inboxConsumer = {
      consume: vi.fn(async (eventArg: HrEventEnvelope<unknown>, consumerName: string, version: string, handler: { handle(event: HrEventEnvelope<unknown>): Promise<void> }) => {
        await handler.handle(eventArg);
      }),
      skipOrphanedEventsWithoutOutbox: vi.fn().mockResolvedValue(0),
      registerReplayHandler: vi.fn(),
    };
    const notificationService = {
      createFromEvent: vi.fn().mockResolvedValue(2),
    };
    const bridge = new EventNotificationBridge(
      {
        subscribe: vi.fn((_topic: string, _consumerGroup: string, handler: EventHandler) => {
          registeredHandler = handler;
        }),
      } as unknown as EventBus,
      inboxConsumer as unknown as InboxConsumer,
      notificationService as unknown as PlatformNotificationService,
    );
    bridge.onModuleInit();

    const envelope = event();
    await registeredHandler?.handle(envelope);

    expect(inboxConsumer.consume).toHaveBeenCalledWith(
      envelope,
      'platform-notifications',
      '1',
      expect.objectContaining({ handle: expect.any(Function) }),
    );
    expect(notificationService.createFromEvent).toHaveBeenCalledWith(envelope);
    expect(inboxConsumer.registerReplayHandler).toHaveBeenCalledWith(
      'platform-notifications',
      '1',
      expect.objectContaining({ handle: expect.any(Function) }),
    );
  });

  it('marks orphaned legacy notification inbox rows as skipped during startup', async () => {
    const inboxConsumer = {
      consume: vi.fn(),
      skipOrphanedEventsWithoutOutbox: vi.fn().mockResolvedValue(14),
      registerReplayHandler: vi.fn(),
    };
    const bridge = new EventNotificationBridge(
      { subscribe: vi.fn() } as unknown as EventBus,
      inboxConsumer as unknown as InboxConsumer,
      { createFromEvent: vi.fn() } as unknown as PlatformNotificationService,
    );

    bridge.onModuleInit();
    await Promise.resolve();

    expect(inboxConsumer.skipOrphanedEventsWithoutOutbox).toHaveBeenCalledWith(
      'platform-notifications',
      '1',
    );
  });
});
