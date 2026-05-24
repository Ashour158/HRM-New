import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  ShiftScheduleCreated, ShiftSchedulePublished, ShiftScheduleActivated, ShiftScheduleArchived,
  OpenShiftCreated, OpenShiftBidPending, OpenShiftFilled, OpenShiftClosed, OpenShiftCancelled,
  ShiftBidSubmitted, ShiftBidApproved, ShiftBidRejected, ShiftBidCancelled,
  ShiftSwapRequested, ShiftSwapApproved, ShiftSwapRejected, ShiftSwapCancelled,
  WfmOvertimeRequested, WfmOvertimeApproved, WfmOvertimeRejected, WfmOvertimeCancelled,
  CoverageGapDetected, CoverageGapNotified, CoverageGapFilled, CoverageGapClosed,
} from '../aggregates/index.js';

@Injectable()
export class WorkforceManagementEventsPublisher {
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
      aggregateType: event.aggregateType ?? 'WorkforceManagement',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof ShiftScheduleCreated:
        return { ...base, payload: { shiftScheduleId: aggregateId.value } };
      case event instanceof ShiftSchedulePublished:
        return { ...base, payload: { shiftScheduleId: aggregateId.value } };
      case event instanceof ShiftScheduleActivated:
        return { ...base, payload: { shiftScheduleId: aggregateId.value } };
      case event instanceof ShiftScheduleArchived:
        return { ...base, payload: { shiftScheduleId: aggregateId.value } };
      case event instanceof OpenShiftCreated:
        return { ...base, payload: { openShiftId: aggregateId.value } };
      case event instanceof OpenShiftBidPending:
        return { ...base, payload: { openShiftId: aggregateId.value } };
      case event instanceof OpenShiftFilled:
        return { ...base, payload: { openShiftId: aggregateId.value, filledByWorkerId: (event as unknown as Record<string, unknown>).filledByWorkerId } };
      case event instanceof OpenShiftClosed:
        return { ...base, payload: { openShiftId: aggregateId.value } };
      case event instanceof OpenShiftCancelled:
        return { ...base, payload: { openShiftId: aggregateId.value } };
      case event instanceof ShiftBidSubmitted:
        return { ...base, payload: { shiftBidId: aggregateId.value } };
      case event instanceof ShiftBidApproved:
        return { ...base, payload: { shiftBidId: aggregateId.value, approvedBy: event.approvedBy } };
      case event instanceof ShiftBidRejected:
        return { ...base, payload: { shiftBidId: aggregateId.value } };
      case event instanceof ShiftBidCancelled:
        return { ...base, payload: { shiftBidId: aggregateId.value } };
      case event instanceof ShiftSwapRequested:
        return { ...base, payload: { shiftSwapRequestId: aggregateId.value } };
      case event instanceof ShiftSwapApproved:
        return { ...base, payload: { shiftSwapRequestId: aggregateId.value, approvedBy: event.approvedBy } };
      case event instanceof ShiftSwapRejected:
        return { ...base, payload: { shiftSwapRequestId: aggregateId.value } };
      case event instanceof ShiftSwapCancelled:
        return { ...base, payload: { shiftSwapRequestId: aggregateId.value } };
      case event instanceof WfmOvertimeRequested:
        return { ...base, payload: { overtimeApprovalId: aggregateId.value } };
      case event instanceof WfmOvertimeApproved:
        return { ...base, payload: { overtimeApprovalId: aggregateId.value, approvedBy: event.approvedBy } };
      case event instanceof WfmOvertimeRejected:
        return { ...base, payload: { overtimeApprovalId: aggregateId.value } };
      case event instanceof WfmOvertimeCancelled:
        return { ...base, payload: { overtimeApprovalId: aggregateId.value } };
      case event instanceof CoverageGapDetected:
        return { ...base, payload: { coverageGapId: aggregateId.value } };
      case event instanceof CoverageGapNotified:
        return { ...base, payload: { coverageGapId: aggregateId.value } };
      case event instanceof CoverageGapFilled:
        return { ...base, payload: { coverageGapId: aggregateId.value, filledByWorkerId: (event as unknown as Record<string, unknown>).filledByWorkerId } };
      case event instanceof CoverageGapClosed:
        return { ...base, payload: { coverageGapId: aggregateId.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(_event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    return createPrivacyForEvent('NONE', aggregateId.value, 'PROFILE');
  }
}
