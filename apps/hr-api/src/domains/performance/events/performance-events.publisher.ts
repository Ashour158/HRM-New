import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  PerformanceReviewCycleCreated, PerformanceReviewCycleSetup, PerformanceReviewCycleActivated, PerformanceReviewCycleStarted, PerformanceReviewCycleCalibration, PerformanceReviewCycleReview, PerformanceReviewCycleClosed,
  PerformanceReviewDrafted, PerformanceReviewSelfReviewed, PerformanceReviewManagerReviewed, PerformanceReviewCalibrated, PerformanceReviewFinalized, PerformanceReviewAcknowledged, PerformanceReviewDisputed,
  GoalCreated, GoalActivated, GoalProgressUpdated, GoalAchieved, GoalMissed, GoalCancelled,
  CalibrationSessionCreated, CalibrationSessionScheduled, CalibrationSessionStarted, CalibrationSessionCompleted, CalibrationSessionFinalized,
  PIPCreated, PIPActivated, PIPReviewPending, PIPCompleted, PIPClosed, PIPExtended, PIPTerminated,
} from '../aggregates/index.js';

@Injectable()
export class PerformanceEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: {
    id: Uuid;
    tenantId: Uuid;
    status: string;
    domainEvents: DomainEvent[];
    workerId?: Uuid;
    revieweeId?: Uuid;
    reviewerId?: Uuid;
    ownerId?: Uuid;
  }): Promise<void> {
    const events = aggregate.domainEvents
      .map((e) => this.toEnvelope(e, aggregate))
      .filter((e): e is HrEventEnvelope<unknown> => !!e);
    await Promise.all(events.map((e) => this.eventBus.publish(e)));
  }

  private toEnvelope(
    event: DomainEvent,
    aggregate: {
      id: Uuid;
      tenantId: Uuid;
      workerId?: Uuid;
      revieweeId?: Uuid;
      reviewerId?: Uuid;
      ownerId?: Uuid;
    },
  ): HrEventEnvelope<unknown> | undefined {
    const aggregateId = aggregate.id;
    const tenantId = aggregate.tenantId;
    const base = {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: event.aggregateType ?? 'Performance',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(aggregate),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof PerformanceReviewCycleCreated:
        return { ...base, payload: { performanceReviewCycleId: aggregateId.value } };
      case event instanceof PerformanceReviewCycleSetup:
        return { ...base, payload: { performanceReviewCycleId: aggregateId.value } };
      case event instanceof PerformanceReviewCycleActivated:
        return { ...base, payload: { performanceReviewCycleId: aggregateId.value } };
      case event instanceof PerformanceReviewCycleStarted:
        return { ...base, payload: { performanceReviewCycleId: aggregateId.value } };
      case event instanceof PerformanceReviewCycleCalibration:
        return { ...base, payload: { performanceReviewCycleId: aggregateId.value } };
      case event instanceof PerformanceReviewCycleReview:
        return { ...base, payload: { performanceReviewCycleId: aggregateId.value } };
      case event instanceof PerformanceReviewCycleClosed:
        return { ...base, payload: { performanceReviewCycleId: aggregateId.value } };
      case event instanceof PerformanceReviewDrafted:
        return { ...base, payload: { performanceReviewId: aggregateId.value } };
      case event instanceof PerformanceReviewSelfReviewed:
        return { ...base, payload: { performanceReviewId: aggregateId.value } };
      case event instanceof PerformanceReviewManagerReviewed:
        return { ...base, payload: { performanceReviewId: aggregateId.value } };
      case event instanceof PerformanceReviewCalibrated:
        return { ...base, payload: { performanceReviewId: aggregateId.value } };
      case event instanceof PerformanceReviewFinalized:
        return { ...base, payload: { performanceReviewId: aggregateId.value } };
      case event instanceof PerformanceReviewAcknowledged:
        return { ...base, payload: { performanceReviewId: aggregateId.value } };
      case event instanceof PerformanceReviewDisputed:
        return { ...base, payload: { performanceReviewId: aggregateId.value } };
      case event instanceof GoalCreated:
        return { ...base, payload: { goalId: aggregateId.value } };
      case event instanceof GoalActivated:
        return { ...base, payload: { goalId: aggregateId.value } };
      case event instanceof GoalProgressUpdated:
        return { ...base, payload: { goalId: aggregateId.value } };
      case event instanceof GoalAchieved:
        return { ...base, payload: { goalId: aggregateId.value } };
      case event instanceof GoalMissed:
        return { ...base, payload: { goalId: aggregateId.value } };
      case event instanceof GoalCancelled:
        return { ...base, payload: { goalId: aggregateId.value } };
      case event instanceof CalibrationSessionCreated:
        return { ...base, payload: { calibrationSessionId: aggregateId.value } };
      case event instanceof CalibrationSessionScheduled:
        return { ...base, payload: { calibrationSessionId: aggregateId.value } };
      case event instanceof CalibrationSessionStarted:
        return { ...base, payload: { calibrationSessionId: aggregateId.value } };
      case event instanceof CalibrationSessionCompleted:
        return { ...base, payload: { calibrationSessionId: aggregateId.value } };
      case event instanceof CalibrationSessionFinalized:
        return { ...base, payload: { calibrationSessionId: aggregateId.value } };
      case event instanceof PIPCreated:
        return { ...base, payload: { performanceImprovementPlanId: aggregateId.value } };
      case event instanceof PIPActivated:
        return { ...base, payload: { performanceImprovementPlanId: aggregateId.value } };
      case event instanceof PIPReviewPending:
        return { ...base, payload: { performanceImprovementPlanId: aggregateId.value } };
      case event instanceof PIPCompleted:
        return { ...base, payload: { performanceImprovementPlanId: aggregateId.value } };
      case event instanceof PIPClosed:
        return { ...base, payload: { performanceImprovementPlanId: aggregateId.value } };
      case event instanceof PIPExtended:
        return { ...base, payload: { performanceImprovementPlanId: aggregateId.value } };
      case event instanceof PIPTerminated:
        return { ...base, payload: { performanceImprovementPlanId: aggregateId.value } };
      default:
        return { ...base, payload: { [this.payloadIdField(base.aggregateType)]: aggregateId.value } };
    }
  }

  private payloadIdField(aggregateType: string): string {
    const fields: Record<string, string> = {
      PerformanceFeedback360Cycle: 'feedback360CycleId',
      PerformanceFeedback360Response: 'feedback360ResponseId',
      Objective: 'objectiveId',
      KeyResult: 'keyResultId',
      KeyPerformanceIndicator: 'kpiId',
      KpiMeasurement: 'kpiMeasurementId',
      ReviewTemplate: 'reviewTemplateId',
      Competency: 'competencyId',
      DevelopmentPlan: 'developmentPlanId',
    };
    return fields[aggregateType] ?? `${aggregateType.charAt(0).toLowerCase()}${aggregateType.slice(1)}Id`;
  }

  private buildPrivacy(aggregate: {
    workerId?: Uuid;
    revieweeId?: Uuid;
    reviewerId?: Uuid;
    ownerId?: Uuid;
  }): HrEventPrivacy {
    const subjectWorkerId = aggregate.workerId?.value
      ?? aggregate.revieweeId?.value
      ?? aggregate.ownerId?.value
      ?? undefined;
    return createPrivacyForEvent('HIGH', subjectWorkerId, 'PERFORMANCE');
  }
}
