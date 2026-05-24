import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  EngagementSurveyCreated, EngagementSurveyPublished, EngagementSurveyActivated, EngagementSurveyClosed, EngagementSurveyAnalyzed,
  SurveyResponseStarted, SurveyResponseCompleted, SurveyResponseSubmitted,
  Feedback360CycleCreated, Feedback360CycleActivated, Feedback360CycleStarted, Feedback360CycleCompleted,
  RecognitionProgramCreated, RecognitionProgramActivated, RecognitionProgramSuspended, RecognitionProgramClosed,
  RecognitionSubmitted, RecognitionApproved, RecognitionAwarded, RecognitionCancelled, RecognitionRejected,
} from '../aggregates/index.js';

@Injectable()
export class EngagementEventsPublisher {
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
      aggregateType: event.aggregateType ?? 'Engagement',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof EngagementSurveyCreated:
        return { ...base, payload: { engagementSurveyId: aggregateId.value } };
      case event instanceof EngagementSurveyPublished:
        return { ...base, payload: { engagementSurveyId: aggregateId.value } };
      case event instanceof EngagementSurveyActivated:
        return { ...base, payload: { engagementSurveyId: aggregateId.value } };
      case event instanceof EngagementSurveyClosed:
        return { ...base, payload: { engagementSurveyId: aggregateId.value } };
      case event instanceof EngagementSurveyAnalyzed:
        return { ...base, payload: { engagementSurveyId: aggregateId.value } };
      case event instanceof SurveyResponseStarted:
        return { ...base, payload: { surveyResponseId: aggregateId.value } };
      case event instanceof SurveyResponseCompleted:
        return { ...base, payload: { surveyResponseId: aggregateId.value } };
      case event instanceof SurveyResponseSubmitted:
        return { ...base, payload: { surveyResponseId: aggregateId.value } };
      case event instanceof Feedback360CycleCreated:
        return { ...base, payload: { feedback360CycleId: aggregateId.value } };
      case event instanceof Feedback360CycleActivated:
        return { ...base, payload: { feedback360CycleId: aggregateId.value } };
      case event instanceof Feedback360CycleStarted:
        return { ...base, payload: { feedback360CycleId: aggregateId.value } };
      case event instanceof Feedback360CycleCompleted:
        return { ...base, payload: { feedback360CycleId: aggregateId.value } };
      case event instanceof RecognitionProgramCreated:
        return { ...base, payload: { recognitionProgramId: aggregateId.value } };
      case event instanceof RecognitionProgramActivated:
        return { ...base, payload: { recognitionProgramId: aggregateId.value } };
      case event instanceof RecognitionProgramSuspended:
        return { ...base, payload: { recognitionProgramId: aggregateId.value } };
      case event instanceof RecognitionProgramClosed:
        return { ...base, payload: { recognitionProgramId: aggregateId.value } };
      case event instanceof RecognitionSubmitted:
        return { ...base, payload: { recognitionRecordId: aggregateId.value } };
      case event instanceof RecognitionApproved:
        return { ...base, payload: { recognitionRecordId: aggregateId.value } };
      case event instanceof RecognitionAwarded:
        return { ...base, payload: { recognitionRecordId: aggregateId.value } };
      case event instanceof RecognitionCancelled:
        return { ...base, payload: { recognitionRecordId: aggregateId.value } };
      case event instanceof RecognitionRejected:
        return { ...base, payload: { recognitionRecordId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregateId.value, 'PROFILE');
  }
}
