import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AllHrTopics, type HrEventEnvelope } from '@hcm/event-schemas';
import { createKyselyInstance, getPool } from '@hcm/database';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { IntegrationOrchestrator } from '../integration-orchestrator.service.js';
import { isEmailNotificationConfigured, type EmailNotificationPayload } from '../adapters/email-notification.adapter.js';
import { buildNotificationTemplate } from '../../platform/notifications/notification-template.js';

const EMAIL_NOTIFICATION_CONSUMER = 'email-notifications';
const EMAIL_NOTIFICATION_CONSUMER_VERSION = '1';
const EMAIL_ADAPTER_NAME = 'email-notification';

export interface EmailNotificationRecipient {
  to: string;
  audience: 'EMPLOYEE' | 'MANAGER' | 'HR_OPERATIONS';
}

@Injectable()
export class EmailNotificationRecipientResolver {
  private readonly db = createKyselyInstance(getPool());

  async resolve(event: HrEventEnvelope<unknown>): Promise<EmailNotificationRecipient[]> {
    const tenantId = event.tenantId.value;
    const subjectWorkerId = event.privacy.subjectWorkerId;
    const recipients: EmailNotificationRecipient[] = [];

    if (subjectWorkerId && event.privacy.employeeVisible && !event.privacy.hrRestricted) {
      const employeeEmail = await this.findWorkerEmail(tenantId, subjectWorkerId);
      if (employeeEmail) recipients.push({ audience: 'EMPLOYEE', to: employeeEmail });
    }

    if (subjectWorkerId && event.privacy.managerVisible && !event.privacy.hrRestricted) {
      const managerEmail = await this.findManagerEmail(tenantId, subjectWorkerId);
      if (managerEmail) recipients.push({ audience: 'MANAGER', to: managerEmail });
    }

    for (const to of parseEmailCsv(process.env.HR_OPERATIONS_EMAILS)) {
      recipients.push({ audience: 'HR_OPERATIONS', to });
    }

    return dedupeRecipients(recipients);
  }

  private async findWorkerEmail(tenantId: string, workerId: string): Promise<string | undefined> {
    const row = await this.db
      .selectFrom('workers')
      .select('email')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', workerId)
      .executeTakeFirst();
    return row?.email ?? undefined;
  }

  private async findManagerEmail(tenantId: string, workerId: string): Promise<string | undefined> {
    const worker = await this.db
      .selectFrom('workers')
      .select('manager_id')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', workerId)
      .executeTakeFirst();

    if (!worker?.manager_id) return undefined;
    return this.findWorkerEmail(tenantId, worker.manager_id);
  }
}

@Injectable()
export class EmailNotificationEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(EmailNotificationEventConsumer.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly orchestrator: IntegrationOrchestrator,
    private readonly recipients: EmailNotificationRecipientResolver,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log({ type: 'EMAIL_NOTIFICATIONS_DISABLED' });
      return;
    }

    this.inboxConsumer.registerReplayHandler(EMAIL_NOTIFICATION_CONSUMER, EMAIL_NOTIFICATION_CONSUMER_VERSION, {
      handle: async (event) => this.handle(event),
    });

    for (const topic of AllHrTopics) {
      this.eventBus.subscribe(topic, EMAIL_NOTIFICATION_CONSUMER, {
        consumerGroup: EMAIL_NOTIFICATION_CONSUMER,
        handle: async (event: HrEventEnvelope<unknown>) => {
          await this.inboxConsumer.consume(event, EMAIL_NOTIFICATION_CONSUMER, EMAIL_NOTIFICATION_CONSUMER_VERSION, {
            handle: async (dedupedEvent) => this.handle(dedupedEvent),
          });
        },
      });
    }
  }

  private isEnabled(): boolean {
    return process.env.HR_EMAIL_NOTIFICATIONS_ENABLED === 'true' || isEmailNotificationConfigured();
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    const recipients = await this.recipients.resolve(event);
    if (recipients.length === 0) {
      this.logger.warn({
        type: 'EMAIL_NOTIFICATION_NO_RECIPIENTS',
        eventId: event.eventId.value,
        eventName: event.eventName,
      });
      return;
    }

    const template = buildNotificationTemplate(event);
    const subject = `[HRM Nexus] ${template.emailSubject}`;
    const bodyText = template.emailBodyText;
    const correlationId = event.metadata.correlationId.value;

    for (const recipient of recipients) {
      const payload: EmailNotificationPayload = {
        to: recipient.to,
        subject,
        bodyText,
        correlationId,
      };
      await this.orchestrator.send(EMAIL_ADAPTER_NAME, payload);
    }

    this.logger.log({
      type: 'EMAIL_NOTIFICATIONS_SENT',
      eventId: event.eventId.value,
      eventName: event.eventName,
      recipientCount: recipients.length,
    });
  }
}

function parseEmailCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.includes('@'));
}

function dedupeRecipients(recipients: EmailNotificationRecipient[]): EmailNotificationRecipient[] {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const key = `${recipient.audience}:${recipient.to.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
