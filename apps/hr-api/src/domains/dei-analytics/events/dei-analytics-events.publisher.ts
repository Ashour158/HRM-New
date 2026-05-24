import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  DeiReportCreated, DeiReportGenerated, DeiReportReviewed, DeiReportPublished,
  PayGapReportCreated, PayGapReportCalculated, PayGapReportReviewed, PayGapReportPublished,
  PayEquityReviewPlanned, PayEquityReviewStarted, PayEquityReviewFindings, PayEquityReviewRemediation, PayEquityReviewClosed,
  AttritionSegmentReportCreated, AttritionSegmentReportGenerated, AttritionSegmentReportPublished,
} from '../aggregates/index.js';

@Injectable()
export class DeiAnalyticsEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: {
    id: Uuid;
    tenantId: Uuid;
    status: string;
    domainEvents: DomainEvent[];
  }): Promise<void> {
    const events = aggregate.domainEvents
      .map((e) => this.toEnvelope(e, aggregate.id, aggregate.tenantId))
      .filter((e): e is HrEventEnvelope<unknown> => !!e);
    await Promise.all(events.map((e) => this.eventBus.publish(e)));
  }

  private toEnvelope(event: DomainEvent, aggregateId: Uuid, tenantId: Uuid): HrEventEnvelope<unknown> | undefined {
    const base = {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: event.aggregateType ?? 'DeiAnalytics',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof DeiReportCreated:
        return { ...base, payload: { deiReportId: aggregateId.value } };
      case event instanceof DeiReportGenerated:
        return { ...base, payload: { deiReportId: aggregateId.value } };
      case event instanceof DeiReportReviewed:
        return { ...base, payload: { deiReportId: aggregateId.value } };
      case event instanceof DeiReportPublished:
        return { ...base, payload: { deiReportId: aggregateId.value } };
      case event instanceof PayGapReportCreated:
        return { ...base, payload: { payGapReportId: aggregateId.value } };
      case event instanceof PayGapReportCalculated:
        return { ...base, payload: { payGapReportId: aggregateId.value } };
      case event instanceof PayGapReportReviewed:
        return { ...base, payload: { payGapReportId: aggregateId.value } };
      case event instanceof PayGapReportPublished:
        return { ...base, payload: { payGapReportId: aggregateId.value } };
      case event instanceof PayEquityReviewPlanned:
        return { ...base, payload: { payEquityReviewId: aggregateId.value } };
      case event instanceof PayEquityReviewStarted:
        return { ...base, payload: { payEquityReviewId: aggregateId.value } };
      case event instanceof PayEquityReviewFindings:
        return { ...base, payload: { payEquityReviewId: aggregateId.value } };
      case event instanceof PayEquityReviewRemediation:
        return { ...base, payload: { payEquityReviewId: aggregateId.value } };
      case event instanceof PayEquityReviewClosed:
        return { ...base, payload: { payEquityReviewId: aggregateId.value } };
      case event instanceof AttritionSegmentReportCreated:
        return { ...base, payload: { attritionSegmentReportId: aggregateId.value } };
      case event instanceof AttritionSegmentReportGenerated:
        return { ...base, payload: { attritionSegmentReportId: aggregateId.value } };
      case event instanceof AttritionSegmentReportPublished:
        return { ...base, payload: { attritionSegmentReportId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('HIGH', aggregateId.value, 'PROFILE');
  }
}
