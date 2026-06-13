import { Injectable } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import {
  HR_OPERATIONS_NOTIFICATION_ROLE,
  PlatformNotificationRepository,
  type PlatformNotificationInput,
} from './platform-notification.repository.js';
import { buildNotificationTemplate } from './notification-template.js';

@Injectable()
export class PlatformNotificationService {
  constructor(private readonly repository: PlatformNotificationRepository) {}

  async createFromEvent(event: HrEventEnvelope<unknown>): Promise<number> {
    const notifications = await this.buildNotifications(event);
    if (notifications.length === 0) return 0;
    await this.repository.createMany(notifications);
    return notifications.length;
  }

  private async buildNotifications(event: HrEventEnvelope<unknown>): Promise<PlatformNotificationInput[]> {
    const notifications: PlatformNotificationInput[] = [];
    const subjectWorkerId = event.privacy.subjectWorkerId;
    const category = event.privacy.employeeDataCategory ?? event.aggregateType.toUpperCase();
    const eventId = uuidValue(event.eventId);
    const tenantId = uuidValue(event.tenantId);
    const aggregateId = uuidValue(event.aggregateId);
    const correlationId = uuidValue(event.metadata.correlationId);
    const occurredAt = dateValue(event.occurredAt);
    const template = buildNotificationTemplate(event);
    const base = {
      tenantId,
      category,
      title: template.title,
      body: template.body,
      sourceEventId: eventId,
      sourceEventName: event.eventName,
      relatedAggregateType: event.aggregateType,
      relatedAggregateId: aggregateId,
      payload: {
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId,
        correlationId,
        occurredAt: occurredAt.toISOString(),
        templateKey: template.templateKey,
        templateVersion: template.templateVersion,
      },
    };

    if (subjectWorkerId && event.privacy.employeeVisible && !event.privacy.hrRestricted) {
      notifications.push({
        ...base,
        audience: 'EMPLOYEE',
        recipientWorkerId: subjectWorkerId,
      });
    }

    if (subjectWorkerId && event.privacy.managerVisible && !event.privacy.hrRestricted) {
      const managerWorkerId = await this.repository.findManagerWorkerIdForWorker(event.tenantId.value, subjectWorkerId);
      if (managerWorkerId && managerWorkerId !== subjectWorkerId) {
        notifications.push({
          ...base,
          audience: 'MANAGER',
          recipientWorkerId: managerWorkerId,
        });
      }
    }

    notifications.push({
      ...base,
      audience: 'HR_OPERATIONS',
      recipientRole: HR_OPERATIONS_NOTIFICATION_ROLE,
      body: `${template.body} Recorded for HR operations review.`,
    });

    return notifications;
  }
}

function uuidValue(value: unknown): string {
  if (typeof value === 'string') return value;
  const uuidLike = value as { value?: unknown } | undefined;
  if (typeof uuidLike?.value === 'string') return uuidLike.value;
  throw new Error('Event envelope is missing a UUID value');
}

function dateValue(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('Event envelope is missing an occurredAt date value');
}
