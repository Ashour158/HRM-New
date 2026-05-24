import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  LearningCourseCreated, LearningCoursePublished, LearningCourseArchived, LearningCourseRetired,
  LearningAssignmentAssigned, LearningAssignmentStarted, LearningAssignmentCompleted, LearningAssignmentExpired, LearningAssignmentCancelled,
  CertificationGranted, CertificationRenewed, CertificationExpired, CertificationRevoked,
  ContentPackageUploaded, ContentPackageParsed, ContentPackageValidated, ContentPackagePublished, ContentPackageDeprecated,
} from '../aggregates/index.js';

@Injectable()
export class LearningEventsPublisher {
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
      aggregateType: event.aggregateType ?? 'Learning',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof LearningCourseCreated:
        return { ...base, payload: { learningCourseId: aggregateId.value } };
      case event instanceof LearningCoursePublished:
        return { ...base, payload: { learningCourseId: aggregateId.value } };
      case event instanceof LearningCourseArchived:
        return { ...base, payload: { learningCourseId: aggregateId.value } };
      case event instanceof LearningCourseRetired:
        return { ...base, payload: { learningCourseId: aggregateId.value } };
      case event instanceof LearningAssignmentAssigned:
        return { ...base, payload: { learningAssignmentId: aggregateId.value } };
      case event instanceof LearningAssignmentStarted:
        return { ...base, payload: { learningAssignmentId: aggregateId.value } };
      case event instanceof LearningAssignmentCompleted:
        return { ...base, payload: { learningAssignmentId: aggregateId.value } };
      case event instanceof LearningAssignmentExpired:
        return { ...base, payload: { learningAssignmentId: aggregateId.value } };
      case event instanceof LearningAssignmentCancelled:
        return { ...base, payload: { learningAssignmentId: aggregateId.value } };
      case event instanceof CertificationGranted:
        return { ...base, payload: { certificationId: aggregateId.value } };
      case event instanceof CertificationRenewed:
        return { ...base, payload: { certificationId: aggregateId.value } };
      case event instanceof CertificationExpired:
        return { ...base, payload: { certificationId: aggregateId.value } };
      case event instanceof CertificationRevoked:
        return { ...base, payload: { certificationId: aggregateId.value } };
      case event instanceof ContentPackageUploaded:
        return { ...base, payload: { learningContentPackageId: aggregateId.value } };
      case event instanceof ContentPackageParsed:
        return { ...base, payload: { learningContentPackageId: aggregateId.value } };
      case event instanceof ContentPackageValidated:
        return { ...base, payload: { learningContentPackageId: aggregateId.value } };
      case event instanceof ContentPackagePublished:
        return { ...base, payload: { learningContentPackageId: aggregateId.value } };
      case event instanceof ContentPackageDeprecated:
        return { ...base, payload: { learningContentPackageId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregateId.value, 'PROFILE');
  }
}
