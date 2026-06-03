import { Injectable } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import {
  HR_OPERATIONS_NOTIFICATION_ROLE,
  PlatformNotificationRepository,
  type PlatformNotificationInput,
} from './platform-notification.repository.js';

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
    const base = {
      tenantId: event.tenantId.value,
      category,
      title: humanizeEventName(event.eventName),
      body: `${humanizeEventName(event.eventName)} for ${event.aggregateType}.`,
      sourceEventId: event.eventId.value,
      sourceEventName: event.eventName,
      relatedAggregateType: event.aggregateType,
      relatedAggregateId: event.aggregateId.value,
      payload: {
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId.value,
        correlationId: event.metadata.correlationId.value,
        occurredAt: event.occurredAt.toISOString(),
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
      body: `${humanizeEventName(event.eventName)} was recorded in the HCM event stream.`,
    });

    return notifications;
  }
}

function humanizeEventName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
