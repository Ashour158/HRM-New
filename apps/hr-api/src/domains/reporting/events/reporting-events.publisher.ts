import { Injectable } from '@nestjs/common';
import { OutboxPublisher } from '../../../platform/outbox-inbox/outbox-publisher.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  ReportDefinitionCreated, ReportDefinitionPublished, ReportDefinitionArchived,
  ReportExecutionPending, ReportExecutionQueued, ReportExecutionStarted, ReportExecutionCompleted, ReportExecutionFailed,
  ReportScheduleCreated, ReportScheduleActivated, ReportSchedulePaused, ReportScheduleExpired, ReportScheduleRunRecorded,
  CalculatedFieldCreated, CalculatedFieldActivated, CalculatedFieldDeprecated,
} from '../aggregates/index.js';

@Injectable()
export class ReportingEventsPublisher {
  constructor(private readonly outboxPublisher: OutboxPublisher) {}

  async publishFromAggregate(aggregate: {
    id: Uuid;
    tenantId: Uuid;
    status: string;
    domainEvents: DomainEvent[];
  }): Promise<void> {
    const events = aggregate.domainEvents
      .map((e) => this.toEnvelope(e, aggregate.id, aggregate.tenantId))
      .filter((e): e is HrEventEnvelope<unknown> => !!e);
    await Promise.all(events.map((e) => this.outboxPublisher.schedule(
      e,
      aggregate.tenantId,
      e.metadata.correlationId,
    )));
  }

  private toEnvelope(event: DomainEvent, aggregateId: Uuid, tenantId: Uuid): HrEventEnvelope<unknown> | undefined {
    const base = {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: event.aggregateType ?? 'Reporting',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof ReportDefinitionCreated:
        return { ...base, payload: { reportDefinitionId: aggregateId.value, reportName: event.reportName, reportType: event.reportType } };
      case event instanceof ReportDefinitionPublished:
        return { ...base, payload: { reportDefinitionId: aggregateId.value } };
      case event instanceof ReportDefinitionArchived:
        return { ...base, payload: { reportDefinitionId: aggregateId.value } };
      case event instanceof ReportExecutionPending:
        return { ...base, payload: { reportExecutionId: aggregateId.value } };
      case event instanceof ReportExecutionQueued:
        return { ...base, payload: { reportExecutionId: aggregateId.value } };
      case event instanceof ReportExecutionStarted:
        return { ...base, payload: { reportExecutionId: aggregateId.value } };
      case event instanceof ReportExecutionCompleted:
        return { ...base, payload: { reportExecutionId: aggregateId.value, rowCount: event.rowCount, resultUrl: event.resultUrl } };
      case event instanceof ReportExecutionFailed:
        return { ...base, payload: { reportExecutionId: aggregateId.value, reason: event.reason } };
      case event instanceof ReportScheduleCreated:
        return { ...base, payload: { reportScheduleId: aggregateId.value } };
      case event instanceof ReportScheduleActivated:
        return { ...base, payload: { reportScheduleId: aggregateId.value } };
      case event instanceof ReportSchedulePaused:
        return { ...base, payload: { reportScheduleId: aggregateId.value } };
      case event instanceof ReportScheduleExpired:
        return { ...base, payload: { reportScheduleId: aggregateId.value } };
      case event instanceof ReportScheduleRunRecorded:
        return { ...base, payload: { reportScheduleId: aggregateId.value, nextRunAt: event.nextRunAt } };
      case event instanceof CalculatedFieldCreated:
        return { ...base, payload: { calculatedFieldId: aggregateId.value, fieldName: event.fieldName } };
      case event instanceof CalculatedFieldActivated:
        return { ...base, payload: { calculatedFieldId: aggregateId.value } };
      case event instanceof CalculatedFieldDeprecated:
        return { ...base, payload: { calculatedFieldId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregateId.value, 'PROFILE');
  }
}
