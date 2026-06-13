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
    if (event.eventName === 'ReminderDue') {
      return this.buildReminderNotifications(event);
    }

    const notifications: PlatformNotificationInput[] = [];
    const subjectWorkerId = event.privacy.subjectWorkerId;
    const category = event.privacy.employeeDataCategory ?? event.aggregateType.toUpperCase();
    const eventId = uuidValue(event.eventId);
    const tenantId = uuidValue(event.tenantId);
    const aggregateId = uuidValue(event.aggregateId);
    const correlationId = uuidValue(event.metadata.correlationId);
    const occurredAt = dateValue(event.occurredAt);
    const base = {
      tenantId,
      category,
      title: humanizeEventName(event.eventName),
      body: `${humanizeEventName(event.eventName)} for ${event.aggregateType}.`,
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

  private async buildReminderNotifications(event: HrEventEnvelope<unknown>): Promise<PlatformNotificationInput[]> {
    const payload = isRecord(event.payload) ? event.payload : {};
    const audienceWorkerIds = stringArray(payload.audienceWorkerIds);
    const managerAudienceWorkerIds = stringArray(payload.managerAudienceWorkerIds);
    const title = stringValue(payload.title) ?? `${stringValue(payload.reminderType) ?? 'Reminder'} due`;
    const body = stringValue(payload.message) ?? stringValue(payload.body) ?? `${title} for ${event.aggregateType}.`;
    const category = event.privacy.employeeDataCategory ?? event.aggregateType.toUpperCase();
    const eventId = uuidValue(event.eventId);
    const tenantId = uuidValue(event.tenantId);
    const aggregateId = uuidValue(event.aggregateId);
    const correlationId = uuidValue(event.metadata.correlationId);
    const occurredAt = dateValue(event.occurredAt);
    const base = {
      tenantId,
      category,
      title,
      body,
      sourceEventId: eventId,
      sourceEventName: event.eventName,
      relatedAggregateType: event.aggregateType,
      relatedAggregateId: aggregateId,
      payload: {
        ...payload,
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId,
        correlationId,
        occurredAt: occurredAt.toISOString(),
      },
    };

    const notifications: PlatformNotificationInput[] = [];
    for (const workerId of audienceWorkerIds) {
      notifications.push({
        ...base,
        audience: 'EMPLOYEE',
        recipientWorkerId: workerId,
      });
    }
    for (const workerId of managerAudienceWorkerIds) {
      notifications.push({
        ...base,
        audience: 'MANAGER',
        recipientWorkerId: workerId,
      });
    }
    if (payload.notifyHrOperations === true) {
      notifications.push({
        ...base,
        audience: 'HR_OPERATIONS',
        recipientRole: HR_OPERATIONS_NOTIFICATION_ROLE,
      });
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
