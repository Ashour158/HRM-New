import { describe, expect, it } from 'vitest';
import { AttendanceCorrectionService, type AttendanceCorrectionRequestRecord } from './attendance-correction.service.js';

const baseRequest: AttendanceCorrectionRequestRecord = {
  id: 'correction-1',
  tenantId: 'tenant-1',
  workerId: 'worker-1',
  workDate: '2026-05-25',
  correctionType: 'ADD_CLOCK_EVENT',
  requestedEventType: 'CLOCK_OUT',
  requestedTimestamp: new Date('2026-05-25T14:00:00Z'),
  reason: 'Forgot to check out',
  status: 'PENDING_MANAGER_REVIEW',
  requestedBy: 'worker-1',
  requestedAt: new Date('2026-05-25T15:00:00Z'),
  auditTrail: [],
  createdAt: new Date('2026-05-25T15:00:00Z'),
  updatedAt: new Date('2026-05-25T15:00:00Z'),
};

describe('AttendanceCorrectionService', () => {
  const service = new AttendanceCorrectionService();

  it('moves a submitted correction through manager approval before application', () => {
    const reviewed = service.review(baseRequest, {
      reviewerId: 'manager-1',
      decision: 'APPROVE',
      note: 'Matches shift evidence',
      reviewedAt: new Date('2026-05-25T16:00:00Z'),
    });

    expect(reviewed.status).toBe('APPROVED');
    expect(reviewed.reviewedBy).toBe('manager-1');
    expect(reviewed.auditTrail).toContainEqual(expect.objectContaining({ action: 'APPROVED', actorId: 'manager-1' }));

    const applied = service.apply(reviewed, {
      appliedBy: 'hr-admin-1',
      appliedAt: new Date('2026-05-25T16:30:00Z'),
      appliedEventId: 'event-1',
    });

    expect(applied.request.status).toBe('APPLIED');
    expect(applied.request.appliedEventId).toBe('event-1');
    expect(applied.clockEvent).toMatchObject({
      id: 'event-1',
      tenantId: 'tenant-1',
      workerId: 'worker-1',
      eventType: 'CLOCK_OUT',
      timestamp: new Date('2026-05-25T14:00:00Z'),
      deviceId: 'attendance-correction',
    });
  });

  it('does not apply a correction before approval', () => {
    expect(() => service.apply(baseRequest, {
      appliedBy: 'hr-admin-1',
      appliedAt: new Date('2026-05-25T16:30:00Z'),
      appliedEventId: 'event-1',
    })).toThrow('Only approved correction requests can be applied');
  });

  it('builds an update mutation for an approved edit correction', () => {
    const reviewed = service.review({
      ...baseRequest,
      correctionType: 'EDIT_CLOCK_EVENT',
      targetEventId: 'target-event-1',
      requestedEventType: 'CLOCK_IN',
      requestedTimestamp: new Date('2026-05-25T06:45:00Z'),
    }, {
      reviewerId: 'manager-1',
      decision: 'APPROVE',
    });

    const applied = service.apply(reviewed, {
      appliedBy: 'hr-admin-1',
      appliedEventId: 'applied-event-1',
    });

    expect(applied.clockEventMutation).toEqual({
      operation: 'UPDATE',
      targetEventId: 'target-event-1',
      eventType: 'CLOCK_IN',
      timestamp: new Date('2026-05-25T06:45:00Z'),
      deviceId: 'attendance-correction',
    });
  });

  it('builds a delete mutation for an approved delete correction', () => {
    const reviewed = service.review({
      ...baseRequest,
      correctionType: 'DELETE_CLOCK_EVENT',
      targetEventId: 'target-event-2',
      requestedEventType: undefined,
      requestedTimestamp: undefined,
    }, {
      reviewerId: 'manager-1',
      decision: 'APPROVE',
    });

    const applied = service.apply(reviewed, {
      appliedBy: 'hr-admin-1',
      appliedEventId: 'applied-event-2',
    });

    expect(applied.clockEventMutation).toEqual({
      operation: 'DELETE',
      targetEventId: 'target-event-2',
    });
  });
});
