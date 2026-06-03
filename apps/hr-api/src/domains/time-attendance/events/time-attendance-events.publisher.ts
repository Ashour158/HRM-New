import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  WorkScheduleCreated, WorkScheduleActivated, WorkScheduleExpired,
  TimesheetCreated, TimesheetSubmitted, TimesheetApproved, TimesheetRejected, TimesheetCorrected,
  TimeClockEventRecorded, TimeClockEventValidated, AttendanceExceptionCreated, AttendanceExceptionResolved,
  AttendanceExceptionCreatedEvent, AttendanceExceptionReviewed, AttendanceExceptionResolvedEvent, AttendanceExceptionEscalated,
  OvertimeRequested, OvertimeApproved, OvertimeRejected, OvertimeCancelled,
} from '../aggregates/index.js';

type TimeAttendanceEventAggregate = {
  id: Uuid;
  tenantId: Uuid;
  status: string;
  workerId?: Uuid;
  totalHours?: number;
  requestedHours?: number;
  domainEvents: DomainEvent[];
};

@Injectable()
export class TimeAttendanceEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: TimeAttendanceEventAggregate): Promise<void> {
    const events = aggregate.domainEvents
      .map((e) => this.toEnvelope(e, aggregate))
      .filter((e): e is HrEventEnvelope<unknown> => !!e);
    await Promise.all(events.map((e) => this.eventBus.publish(e)));
  }

  private toEnvelope(event: DomainEvent, aggregate: TimeAttendanceEventAggregate): HrEventEnvelope<unknown> | undefined {
    const aggregateId = aggregate.id;
    const base = {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId: aggregate.tenantId,
      aggregateType: event.aggregateType ?? 'TimeAttendance',
      aggregateId,
      metadata: { correlationId: event.correlationId, causationId: event.causationId, requestHash: '', clientType: 'HR_ADMIN' as const },
      privacy: this.buildPrivacy(aggregate),
      occurredAt: event.occurredAt,
      version: event.version,
    };
    switch (true) {
      case event instanceof WorkScheduleCreated:
        return { ...base, payload: { workScheduleId: aggregateId.value } };
      case event instanceof WorkScheduleActivated:
        return { ...base, payload: { workScheduleId: aggregateId.value } };
      case event instanceof WorkScheduleExpired:
        return { ...base, payload: { workScheduleId: aggregateId.value } };
      case event instanceof TimesheetCreated:
        return { ...base, payload: { timesheetId: aggregateId.value, workerId: aggregate.workerId?.value } };
      case event instanceof TimesheetSubmitted:
        return { ...base, payload: { timesheetId: aggregateId.value, workerId: aggregate.workerId?.value } };
      case event instanceof TimesheetApproved:
        return { ...base, payload: { timesheetId: aggregateId.value, workerId: aggregate.workerId?.value, approvedBy: event.approvedBy, amount: aggregate.totalHours } };
      case event instanceof TimesheetRejected:
        return { ...base, payload: { timesheetId: aggregateId.value, workerId: aggregate.workerId?.value } };
      case event instanceof TimesheetCorrected:
        return { ...base, payload: { timesheetId: aggregateId.value, workerId: aggregate.workerId?.value } };
      case event instanceof TimeClockEventRecorded:
        return { ...base, payload: { timeClockEventId: aggregateId.value, workerId: aggregate.workerId?.value } };
      case event instanceof TimeClockEventValidated:
        return { ...base, payload: { timeClockEventId: aggregateId.value, workerId: aggregate.workerId?.value } };
      case event instanceof AttendanceExceptionCreated:
        return { ...base, payload: { timeClockEventId: aggregateId.value } };
      case event instanceof AttendanceExceptionResolved:
        return { ...base, payload: { timeClockEventId: aggregateId.value } };
      case event instanceof AttendanceExceptionCreatedEvent:
        return { ...base, payload: { attendanceExceptionId: aggregateId.value } };
      case event instanceof AttendanceExceptionReviewed:
        return { ...base, payload: { attendanceExceptionId: aggregateId.value } };
      case event instanceof AttendanceExceptionResolvedEvent:
        return { ...base, payload: { attendanceExceptionId: aggregateId.value, resolvedBy: event.resolvedBy } };
      case event instanceof AttendanceExceptionEscalated:
        return { ...base, payload: { attendanceExceptionId: aggregateId.value } };
      case event instanceof OvertimeRequested:
        return { ...base, payload: { overtimeRequestId: aggregateId.value, overtimeApprovalId: aggregateId.value, workerId: aggregate.workerId?.value, amount: aggregate.requestedHours } };
      case event instanceof OvertimeApproved:
        return { ...base, payload: { overtimeRequestId: aggregateId.value, overtimeApprovalId: aggregateId.value, workerId: aggregate.workerId?.value, approvedBy: event.approvedBy, amount: aggregate.requestedHours } };
      case event instanceof OvertimeRejected:
        return { ...base, payload: { overtimeRequestId: aggregateId.value, overtimeApprovalId: aggregateId.value, workerId: aggregate.workerId?.value } };
      case event instanceof OvertimeCancelled:
        return { ...base, payload: { overtimeRequestId: aggregateId.value, overtimeApprovalId: aggregateId.value, workerId: aggregate.workerId?.value } };
      default:
        return undefined;
    }
  }

  private buildPrivacy(aggregate: TimeAttendanceEventAggregate): HrEventPrivacy {
    return createPrivacyForEvent('LOW', aggregate.workerId?.value, 'PROFILE');
  }
}
