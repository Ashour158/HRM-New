import { afterEach, describe, expect, it, vi } from 'vitest';
import { AllHrTopics, HR_ONBOARDING, type HrEventEnvelope } from '@hcm/event-schemas';
import { Uuid } from '@hcm/shared-kernel';
import type { EventBus, EventHandler } from '../../platform/event-bus/event-bus.js';
import type { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import type { IntegrationOrchestrator } from '../integration-orchestrator.service.js';
import {
  EmailNotificationEventConsumer,
  type EmailNotificationRecipient,
  type EmailNotificationRecipientResolver,
} from './email-notification.consumer.js';

function event(overrides: Partial<HrEventEnvelope<Record<string, never>>> = {}): HrEventEnvelope<Record<string, never>> {
  return {
    eventId: Uuid.generate(),
    eventName: 'LeaveRequestApproved',
    eventSchemaVersion: 1,
    tenantId: Uuid.generate(),
    aggregateType: 'AbsenceRequest',
    aggregateId: Uuid.generate(),
    payload: {},
    metadata: {
      correlationId: Uuid.generate(),
      requestHash: 'email-notification-consumer-test',
      clientType: 'SYSTEM',
    },
    privacy: {
      piiClassification: 'LOW',
      employeeDataCategory: 'ABSENCE',
      subjectWorkerId: Uuid.generate().value,
      managerVisible: true,
      employeeVisible: true,
      hrRestricted: false,
      redactionApplied: false,
    },
    occurredAt: new Date(),
    version: 1,
    ...overrides,
  };
}

function consumerWith(recipients: EmailNotificationRecipient[]) {
  let handler: EventHandler | undefined;
  const eventBus = {
    subscribe: vi.fn((_topic: string, _consumerGroup: string, registered: EventHandler) => {
      handler = registered;
    }),
  } as unknown as EventBus;
  const inboxConsumer = {
    consume: vi.fn(async (eventArg: HrEventEnvelope<unknown>, _consumerName: string, _version: string, dedupeHandler: { handle(event: HrEventEnvelope<unknown>): Promise<void> }) => {
      await dedupeHandler.handle(eventArg);
    }),
    registerReplayHandler: vi.fn(),
  } as unknown as InboxConsumer;
  const orchestrator = {
    send: vi.fn().mockResolvedValue({ success: true, adapterName: 'email-notification', operationId: 'op-1', timestamp: new Date() }),
  } as unknown as IntegrationOrchestrator;
  const resolver = {
    resolve: vi.fn().mockResolvedValue(recipients),
  } as unknown as EmailNotificationRecipientResolver;

  const consumer = new EmailNotificationEventConsumer(eventBus, inboxConsumer, orchestrator, resolver);
  return { consumer, eventBus, inboxConsumer, orchestrator, resolver, getHandler: () => handler };
}

describe('EmailNotificationEventConsumer', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not subscribe when email notifications and provider credentials are disabled', () => {
    delete process.env.HR_EMAIL_NOTIFICATIONS_ENABLED;
    delete process.env.HR_EMAIL_DELIVERY_MODE;
    const { consumer, eventBus, inboxConsumer } = consumerWith([]);

    consumer.onModuleInit();

    expect(eventBus.subscribe).not.toHaveBeenCalled();
    expect(inboxConsumer.registerReplayHandler).not.toHaveBeenCalled();
  });

  it('routes eligible recipients through inbox deduplication and the email adapter', async () => {
    process.env.HR_EMAIL_NOTIFICATIONS_ENABLED = 'true';
    const { consumer, eventBus, inboxConsumer, orchestrator, resolver, getHandler } = consumerWith([
      { audience: 'EMPLOYEE', to: 'employee@example.com' },
      { audience: 'MANAGER', to: 'manager@example.com' },
      { audience: 'HR_OPERATIONS', to: 'hr-ops@example.com' },
    ]);

    consumer.onModuleInit();
    expect(eventBus.subscribe).toHaveBeenCalledTimes(AllHrTopics.length);
    expect(eventBus.subscribe).toHaveBeenCalledWith(HR_ONBOARDING, 'email-notifications', expect.any(Object));
    expect(inboxConsumer.registerReplayHandler).toHaveBeenCalledWith(
      'email-notifications',
      '1',
      expect.objectContaining({ handle: expect.any(Function) }),
    );

    const envelope = event();
    await getHandler()?.handle(envelope);

    expect(inboxConsumer.consume).toHaveBeenCalledWith(
      envelope,
      'email-notifications',
      '1',
      expect.objectContaining({ handle: expect.any(Function) }),
    );
    expect(resolver.resolve).toHaveBeenCalledWith(envelope);
    expect(orchestrator.send).toHaveBeenCalledTimes(3);
    expect(orchestrator.send).toHaveBeenCalledWith('email-notification', expect.objectContaining({
      to: 'employee@example.com',
      subject: '[HRM Nexus] Leave Request Approved',
      correlationId: envelope.metadata.correlationId.value,
    }));
    expect(orchestrator.send).toHaveBeenCalledWith('email-notification', expect.objectContaining({ to: 'manager@example.com' }));
    expect(orchestrator.send).toHaveBeenCalledWith('email-notification', expect.objectContaining({ to: 'hr-ops@example.com' }));
  });
});
