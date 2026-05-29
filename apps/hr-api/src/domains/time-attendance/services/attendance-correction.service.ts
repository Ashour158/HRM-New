import { Injectable } from '@nestjs/common';
import type { TimeClockEventType } from '../aggregates/time-clock-event.aggregate.js';

export type AttendanceCorrectionStatus =
  | 'PENDING_MANAGER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPLIED'
  | 'CANCELLED';

export type AttendanceCorrectionType = 'ADD_CLOCK_EVENT' | 'EDIT_CLOCK_EVENT' | 'DELETE_CLOCK_EVENT';

export interface AttendanceCorrectionAuditEntry {
  action: string;
  actorId: string;
  note?: string;
  timestamp: string;
}

export interface AttendanceCorrectionRequestRecord {
  id: string;
  tenantId: string;
  workerId: string;
  workDate: string;
  correctionType: AttendanceCorrectionType;
  requestedEventType?: TimeClockEventType;
  requestedTimestamp?: Date;
  targetEventId?: string;
  reason: string;
  status: AttendanceCorrectionStatus;
  requestedBy: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  appliedBy?: string;
  appliedAt?: Date;
  appliedEventId?: string;
  auditTrail: AttendanceCorrectionAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceCorrectionClockEventDraft {
  id: string;
  tenantId: string;
  workerId: string;
  eventType: TimeClockEventType;
  timestamp: Date;
  location?: string;
  deviceId: 'attendance-correction';
}

export type AttendanceCorrectionClockEventMutation =
  | {
    operation: 'CREATE';
    event: AttendanceCorrectionClockEventDraft;
  }
  | {
    operation: 'UPDATE';
    targetEventId: string;
    eventType: TimeClockEventType;
    timestamp: Date;
    deviceId: 'attendance-correction';
  }
  | {
    operation: 'DELETE';
    targetEventId: string;
  };

@Injectable()
export class AttendanceCorrectionService {
  review(request: AttendanceCorrectionRequestRecord, input: {
    reviewerId: string;
    decision: 'APPROVE' | 'REJECT';
    note?: string;
    reviewedAt?: Date;
  }): AttendanceCorrectionRequestRecord {
    if (request.status !== 'PENDING_MANAGER_REVIEW') {
      throw new Error('Only pending correction requests can be reviewed');
    }

    const reviewedAt = input.reviewedAt ?? new Date();
    const status: AttendanceCorrectionStatus = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    return {
      ...request,
      status,
      reviewedBy: input.reviewerId,
      reviewedAt,
      updatedAt: reviewedAt,
      auditTrail: [
        ...request.auditTrail,
        {
          action: status,
          actorId: input.reviewerId,
          note: input.note,
          timestamp: reviewedAt.toISOString(),
        },
      ],
    };
  }

  apply(request: AttendanceCorrectionRequestRecord, input: {
    appliedBy: string;
    appliedAt?: Date;
    appliedEventId: string;
  }): {
    request: AttendanceCorrectionRequestRecord;
    clockEvent?: AttendanceCorrectionClockEventDraft;
    clockEventMutation?: AttendanceCorrectionClockEventMutation;
  } {
    if (request.status !== 'APPROVED') {
      throw new Error('Only approved correction requests can be applied');
    }

    const appliedAt = input.appliedAt ?? new Date();
    const nextRequest: AttendanceCorrectionRequestRecord = {
      ...request,
      status: 'APPLIED',
      appliedBy: input.appliedBy,
      appliedAt,
      appliedEventId: input.appliedEventId,
      updatedAt: appliedAt,
      auditTrail: [
        ...request.auditTrail,
        {
          action: 'APPLIED',
          actorId: input.appliedBy,
          timestamp: appliedAt.toISOString(),
        },
      ],
    };

    if (request.correctionType === 'ADD_CLOCK_EVENT') {
      if (!request.requestedEventType || !request.requestedTimestamp) {
        throw new Error('A clock event correction requires event type and timestamp');
      }
      const event = {
        id: input.appliedEventId,
        tenantId: request.tenantId,
        workerId: request.workerId,
        eventType: request.requestedEventType,
        timestamp: request.requestedTimestamp,
        deviceId: 'attendance-correction',
      } satisfies AttendanceCorrectionClockEventDraft;
      return {
        request: nextRequest,
        clockEvent: event,
        clockEventMutation: { operation: 'CREATE', event },
      };
    }

    if (request.correctionType === 'EDIT_CLOCK_EVENT') {
      if (!request.targetEventId) throw new Error('An edit correction requires a target clock event');
      if (!request.requestedEventType || !request.requestedTimestamp) {
        throw new Error('An edit correction requires event type and timestamp');
      }
      return {
        request: nextRequest,
        clockEventMutation: {
          operation: 'UPDATE',
          targetEventId: request.targetEventId,
          eventType: request.requestedEventType,
          timestamp: request.requestedTimestamp,
          deviceId: 'attendance-correction',
        },
      };
    }

    if (!request.targetEventId) throw new Error('A delete correction requires a target clock event');
    return {
      request: nextRequest,
      clockEventMutation: {
        operation: 'DELETE',
        targetEventId: request.targetEventId,
      },
    };
  }
}
